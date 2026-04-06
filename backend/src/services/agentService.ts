import prisma from '../config/database';
import logger from '../config/logger';
import { MS_PER_DAY } from '../config/constants';
import { sendWeeklyDigest, isEmailConfigured } from './emailService';
import { sendAgentReminderEmail, sendBookingExpiredEmail, sendAIWeeklySummaryEmail } from './agentEmailService';

// ── LLM Integration ────────────────────────────────────────────────

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callLLM(messages: LLMMessage[]): Promise<string | null> {
  const endpoint = process.env.AGENT_LLM_ENDPOINT;
  const apiKey = process.env.AGENT_LLM_API_KEY;
  const model = process.env.AGENT_LLM_MODEL || 'gpt-4o';

  if (!endpoint || !apiKey) {
    return null; // LLM not configured — rule-based only
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: 1000, temperature: 0.3 }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn(`LLM API returned ${res.status}: ${await res.text()}`);
      return null;
    }

    const data: any = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    logger.warn(`LLM call failed: ${(err as Error).message}`);
    return null;
  }
}

export function isLLMConfigured(): boolean {
  return !!(process.env.AGENT_LLM_ENDPOINT && process.env.AGENT_LLM_API_KEY);
}

export function isAgentEnabled(): boolean {
  return process.env.AGENT_ENABLED !== 'false'; // enabled by default
}

// ── Helper ─────────────────────────────────────────────────────────

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / MS_PER_DAY);
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);
}

async function logAgent(
  taskType: 'booking_expiry_check' | 'booking_reminder' | 'booking_completed' | 'server_status_sync' | 'weekly_summary' | 'utilization_analysis' | 'agent_cycle',
  severity: 'info' | 'warning' | 'action' | 'error',
  title: string,
  detail?: string,
  aiInsight?: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.agentLog.create({
    data: { taskType, severity, title, detail, aiInsight, metadata: (metadata ?? undefined) as any },
  });
}

// ── Task 1: Check Expiring Bookings (≤3 days) → Send Reminder ─────

async function checkExpiringBookings(): Promise<{ reminded: number; errors: number }> {
  const threeDaysFromNow = new Date(Date.now() + 3 * MS_PER_DAY);

  const expiring = await prisma.booking.findMany({
    where: {
      status: { in: ['active', 'pending_renewal'] },
      endDate: { lte: threeDaysFromNow, gt: new Date() },
      renewalNotificationSent: false,
    },
    include: { user: true, server: true },
  });

  let reminded = 0;
  let errors = 0;

  for (const booking of expiring) {
    try {
      const daysLeft = daysUntil(booking.endDate);

      // Generate AI insight if LLM available
      let aiInsight: string | null = null;
      if (isLLMConfigured()) {
        aiInsight = await callLLM([
          { role: 'system', content: 'You are a lab booking assistant. Write a brief, helpful 1-2 sentence reminder for a user whose server booking is expiring soon. Be professional and concise.' },
          { role: 'user', content: `User ${booking.user.name} has server "${booking.server.name}" (${booking.server.cpuSpec}) booked for "${booking.purpose}". The booking expires in ${daysLeft} day(s) on ${booking.endDate.toLocaleDateString()}. They have been using it for ${daysSince(booking.startDate)} days.` },
        ]);
      }

      // Send email if SMTP configured
      if (isEmailConfigured()) {
        await sendAgentReminderEmail({
          userName: booking.user.name,
          userEmail: booking.user.email,
          serverName: booking.server.name,
          endDate: booking.endDate,
          daysLeft,
          purpose: booking.purpose,
          aiInsight: aiInsight || undefined,
        });
      }

      // Mark notification sent + set pending_renewal
      await prisma.booking.update({
        where: { id: booking.id },
        data: { renewalNotificationSent: true, status: 'pending_renewal' },
      });

      await logAgent('booking_reminder', 'action', `Reminder sent: ${booking.server.name}`,
        `Sent ${daysLeft}-day expiry reminder to ${booking.user.email} for server ${booking.server.name}`,
        aiInsight || undefined,
        { bookingId: booking.id, userId: booking.userId, serverId: booking.serverId, daysLeft });

      reminded++;
    } catch (err) {
      errors++;
      await logAgent('booking_reminder', 'error', `Failed to remind: ${booking.server.name}`,
        (err as Error).message, undefined, { bookingId: booking.id });
    }
  }

  return { reminded, errors };
}

// ── Task 2: Auto-Complete Expired Bookings → Free Servers ──────────

async function completeExpiredBookings(): Promise<{ completed: number; errors: number }> {
  const now = new Date();

  const expired = await prisma.booking.findMany({
    where: {
      status: { in: ['active', 'pending_renewal'] },
      endDate: { lt: now },
    },
    include: { user: true, server: true },
  });

  let completed = 0;
  let errors = 0;

  for (const booking of expired) {
    try {
      // Mark booking completed
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'completed' },
      });

      // Check if server has other active bookings
      const otherActive = await prisma.booking.count({
        where: {
          serverId: booking.serverId,
          status: { in: ['active', 'pending_renewal'] },
          id: { not: booking.id },
        },
      });

      // Free the server if no other active bookings
      if (otherActive === 0) {
        await prisma.server.update({
          where: { id: booking.serverId },
          data: { status: 'available' },
        });
      }

      // Send expiration email
      if (isEmailConfigured()) {
        await sendBookingExpiredEmail({
          userName: booking.user.name,
          userEmail: booking.user.email,
          serverName: booking.server.name,
          endDate: booking.endDate,
          purpose: booking.purpose,
          daysOverdue: daysSince(booking.endDate),
        });
      }

      await logAgent('booking_completed', 'action', `Auto-completed: ${booking.server.name}`,
        `Booking by ${booking.user.name} for "${booking.purpose}" expired on ${booking.endDate.toLocaleDateString()}. Server ${otherActive === 0 ? 'freed' : 'still has other bookings'}.`,
        undefined,
        { bookingId: booking.id, serverId: booking.serverId, serverFreed: otherActive === 0 });

      completed++;
    } catch (err) {
      errors++;
      await logAgent('booking_completed', 'error', `Failed to complete: ${booking.server.name}`,
        (err as Error).message, undefined, { bookingId: booking.id });
    }
  }

  return { completed, errors };
}

// ── Task 3: Sync Server Statuses ───────────────────────────────────

async function syncServerStatuses(): Promise<{ fixed: number }> {
  // Find servers marked 'booked' but with no active bookings
  const bookedServers = await prisma.server.findMany({
    where: { status: 'booked' },
    include: { bookings: { where: { status: { in: ['active', 'pending_renewal'] } } } },
  });

  let fixed = 0;
  for (const server of bookedServers) {
    if (server.bookings.length === 0) {
      await prisma.server.update({ where: { id: server.id }, data: { status: 'available' } });
      await logAgent('server_status_sync', 'warning', `Server freed: ${server.name}`,
        `Server "${server.name}" was marked booked but had no active bookings. Status corrected to available.`);
      fixed++;
    }
  }

  // Find servers marked 'available' but with active bookings
  const availableServers = await prisma.server.findMany({
    where: { status: 'available' },
    include: { bookings: { where: { status: { in: ['active', 'pending_renewal'] } } } },
  });

  for (const server of availableServers) {
    if (server.bookings.length > 0) {
      await prisma.server.update({ where: { id: server.id }, data: { status: 'booked' } });
      await logAgent('server_status_sync', 'warning', `Server status corrected: ${server.name}`,
        `Server "${server.name}" was marked available but has ${server.bookings.length} active booking(s). Status corrected to booked.`);
      fixed++;
    }
  }

  return { fixed };
}

// ── Task 4: AI Utilization Analysis ────────────────────────────────

async function analyzeUtilization(): Promise<string | null> {
  const [totalServers, available, booked, maintenance, offline] = await Promise.all([
    prisma.server.count(),
    prisma.server.count({ where: { status: 'available' } }),
    prisma.server.count({ where: { status: 'booked' } }),
    prisma.server.count({ where: { status: 'maintenance' } }),
    prisma.server.count({ where: { status: 'offline' } }),
  ]);

  const activeBookings = await prisma.booking.findMany({
    where: { status: { in: ['active', 'pending_renewal'] } },
    include: { server: true, user: true },
  });

  const recentCompleted = await prisma.booking.count({
    where: { status: 'completed', updatedAt: { gte: new Date(Date.now() - 7 * MS_PER_DAY) } },
  });

  const expiringIn7Days = activeBookings.filter(b => daysUntil(b.endDate) <= 7).length;

  // Group by team
  const teamCounts: Record<string, number> = {};
  for (const b of activeBookings) {
    const team = b.teamAssigned || 'Unassigned';
    teamCounts[team] = (teamCounts[team] || 0) + 1;
  }

  // Group by architecture
  const archCounts: Record<string, number> = {};
  for (const b of activeBookings) {
    const cpu = b.server.cpuSpec.toLowerCase();
    const arch = cpu.includes('arm') || cpu.includes('neoverse') || cpu.includes('cobalt') || cpu.includes('ampere') || cpu.includes('graviton') || cpu.includes('kunpeng')
      ? 'ARM64'
      : cpu.includes('epyc') || cpu.includes('ryzen') || cpu.includes('amd')
      ? 'AMD'
      : 'Intel';
    archCounts[arch] = (archCounts[arch] || 0) + 1;
  }

  const summary = {
    totalServers, available, booked, maintenance, offline,
    activeBookings: activeBookings.length,
    expiringIn7Days,
    recentCompleted,
    utilizationRate: totalServers > 0 ? Math.round((booked / totalServers) * 100) : 0,
    teamBreakdown: teamCounts,
    archBreakdown: archCounts,
  };

  let aiAnalysis: string | null = null;

  if (isLLMConfigured()) {
    aiAnalysis = await callLLM([
      { role: 'system', content: 'You are a lab operations analyst AI. Analyze the lab server utilization data and provide 3-5 actionable insights. Be specific, use numbers, and highlight risks or optimization opportunities. Format with bullet points. Keep it under 200 words.' },
      { role: 'user', content: `Lab Status Report:\n${JSON.stringify(summary, null, 2)}` },
    ]);
  }

  // Fallback rule-based analysis if no LLM
  if (!aiAnalysis) {
    const insights: string[] = [];
    if (summary.utilizationRate > 80) insights.push(`⚠️ High utilization at ${summary.utilizationRate}% — consider adding more servers or freeing maintenance machines.`);
    else if (summary.utilizationRate < 30) insights.push(`📊 Low utilization at ${summary.utilizationRate}% — ${available} of ${totalServers} servers are idle.`);
    else insights.push(`📊 Utilization is at ${summary.utilizationRate}% (${booked} of ${totalServers} servers booked).`);

    if (expiringIn7Days > 0) insights.push(`⏰ ${expiringIn7Days} booking(s) expiring within 7 days — users have been notified.`);
    if (maintenance > 0) insights.push(`🔧 ${maintenance} server(s) in maintenance — review if they can be brought back online.`);
    if (offline > 0) insights.push(`🔴 ${offline} server(s) offline — investigate connectivity or hardware issues.`);
    if (recentCompleted > 0) insights.push(`✅ ${recentCompleted} booking(s) completed this week.`);

    const topTeam = Object.entries(teamCounts).sort((a, b) => b[1] - a[1])[0];
    if (topTeam) insights.push(`👥 Top team by usage: ${topTeam[0]} (${topTeam[1]} active bookings).`);

    aiAnalysis = insights.join('\n');
  }

  await logAgent('utilization_analysis', 'info', `Utilization: ${summary.utilizationRate}%`,
    `Servers: ${available} available, ${booked} booked, ${maintenance} maintenance, ${offline} offline. ${activeBookings.length} active bookings.`,
    aiAnalysis, summary);

  return aiAnalysis;
}

// ── Master Agent Cycle ─────────────────────────────────────────────

export interface AgentCycleResult {
  timestamp: string;
  reminders: { reminded: number; errors: number };
  completions: { completed: number; errors: number };
  statusSync: { fixed: number };
  analysis: string | null;
  duration: number;
}

export async function runAgentCycle(): Promise<AgentCycleResult> {
  const start = Date.now();
  logger.info('🤖 Agent cycle starting...');

  const reminders = await checkExpiringBookings();
  const completions = await completeExpiredBookings();
  const statusSync = await syncServerStatuses();
  const analysis = await analyzeUtilization();

  const duration = Date.now() - start;

  const result: AgentCycleResult = {
    timestamp: new Date().toISOString(),
    reminders,
    completions,
    statusSync,
    analysis,
    duration,
  };

  const totalActions = reminders.reminded + completions.completed + statusSync.fixed;
  const totalErrors = reminders.errors + completions.errors;

  await logAgent('agent_cycle', totalErrors > 0 ? 'warning' : 'info',
    `Cycle complete: ${totalActions} actions, ${totalErrors} errors (${duration}ms)`,
    JSON.stringify(result, null, 2), analysis || undefined,
    { totalActions, totalErrors, duration });

  logger.info(`🤖 Agent cycle complete: ${totalActions} actions in ${duration}ms`);
  return result;
}

// ── Weekly AI Summary (for admins) ─────────────────────────────────

export async function runWeeklyAISummary(): Promise<void> {
  logger.info('🤖 Agent weekly AI summary starting...');

  const analysis = await analyzeUtilization();

  // Get week's agent activity
  const weekAgo = new Date(Date.now() - 7 * MS_PER_DAY);
  const weekLogs = await prisma.agentLog.findMany({
    where: { createdAt: { gte: weekAgo } },
    orderBy: { createdAt: 'desc' },
  });

  const actionsTaken = weekLogs.filter(l => l.severity === 'action').length;
  const warningsRaised = weekLogs.filter(l => l.severity === 'warning').length;
  const errorsEncountered = weekLogs.filter(l => l.severity === 'error').length;

  // Get stats
  const [totalServers, available, activeBookings] = await Promise.all([
    prisma.server.count(),
    prisma.server.count({ where: { status: 'available' } }),
    prisma.booking.count({ where: { status: { in: ['active', 'pending_renewal'] } } }),
  ]);

  // If email is configured, send to all admins
  if (isEmailConfigured()) {
    const admins = await prisma.user.findMany({ where: { isAdmin: true } });
    for (const admin of admins) {
      try {
        await sendAIWeeklySummaryEmail({
          adminName: admin.name,
          adminEmail: admin.email,
          analysis: analysis || 'No AI analysis available.',
          stats: { totalServers, available, activeBookings, actionsTaken, warningsRaised, errorsEncountered },
          topActions: weekLogs
            .filter(l => l.severity === 'action')
            .slice(0, 10)
            .map(l => ({ title: l.title, detail: l.detail || '', createdAt: l.createdAt })),
        });
      } catch (err) {
        logger.error(`Failed to send AI summary to ${admin.email}: ${(err as Error).message}`);
      }
    }
  }

  await logAgent('weekly_summary', 'info', 'Weekly AI summary generated',
    `Actions: ${actionsTaken}, Warnings: ${warningsRaised}, Errors: ${errorsEncountered}`,
    analysis || undefined);
}

// ── Get Agent Status ───────────────────────────────────────────────

export async function getAgentStatus() {
  const lastCycle = await prisma.agentLog.findFirst({
    where: { taskType: 'agent_cycle' },
    orderBy: { createdAt: 'desc' },
  });

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [actions24h, warnings24h, errors24h] = await Promise.all([
    prisma.agentLog.count({ where: { severity: 'action', createdAt: { gte: last24h } } }),
    prisma.agentLog.count({ where: { severity: 'warning', createdAt: { gte: last24h } } }),
    prisma.agentLog.count({ where: { severity: 'error', createdAt: { gte: last24h } } }),
  ]);

  // Current system snapshot
  const [totalServers, available, booked, maintenance, offline, activeBookings] = await Promise.all([
    prisma.server.count(),
    prisma.server.count({ where: { status: 'available' } }),
    prisma.server.count({ where: { status: 'booked' } }),
    prisma.server.count({ where: { status: 'maintenance' } }),
    prisma.server.count({ where: { status: 'offline' } }),
    prisma.booking.count({ where: { status: { in: ['active', 'pending_renewal'] } } }),
  ]);

  const expiringIn3Days = await prisma.booking.count({
    where: {
      status: { in: ['active', 'pending_renewal'] },
      endDate: { lte: new Date(Date.now() + 3 * MS_PER_DAY), gt: new Date() },
    },
  });

  const overdueBookings = await prisma.booking.count({
    where: {
      status: { in: ['active', 'pending_renewal'] },
      endDate: { lt: new Date() },
    },
  });

  return {
    enabled: isAgentEnabled(),
    llmConfigured: isLLMConfigured(),
    emailConfigured: isEmailConfigured(),
    lastCycle: lastCycle ? {
      timestamp: lastCycle.createdAt,
      title: lastCycle.title,
      aiInsight: lastCycle.aiInsight,
    } : null,
    activity24h: { actions: actions24h, warnings: warnings24h, errors: errors24h },
    systemSnapshot: {
      totalServers, available, booked, maintenance, offline,
      activeBookings, expiringIn3Days, overdueBookings,
      utilizationRate: totalServers > 0 ? Math.round((booked / totalServers) * 100) : 0,
    },
  };
}

// ── Get Agent Logs ─────────────────────────────────────────────────

export async function getAgentLogs(limit = 50, taskType?: string) {
  return prisma.agentLog.findMany({
    where: taskType ? { taskType: taskType as any } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ── Agent Chat ─────────────────────────────────────────────────────

interface ChatContext {
  servers: { name: string; status: string; cpuSpec: string; memorySpec: string; gpuSpec: string | null; location: string; pool: string | null }[];
  activeBookings: { serverName: string; userName: string; purpose: string; endDate: Date; daysLeft: number; teamAssigned: string | null }[];
  stats: { total: number; available: number; booked: number; maintenance: number; offline: number; utilizationRate: number };
}

async function gatherChatContext(): Promise<ChatContext> {
  const servers = await prisma.server.findMany({
    select: { name: true, status: true, cpuSpec: true, memorySpec: true, gpuSpec: true, location: true, pool: true },
    orderBy: { name: 'asc' },
  });

  const bookings = await prisma.booking.findMany({
    where: { status: { in: ['active', 'pending_renewal'] } },
    include: { server: { select: { name: true } }, user: { select: { name: true } } },
    orderBy: { endDate: 'asc' },
  });

  const total = servers.length;
  const available = servers.filter(s => s.status === 'available').length;
  const booked = servers.filter(s => s.status === 'booked').length;
  const maintenance = servers.filter(s => s.status === 'maintenance').length;
  const offline = servers.filter(s => s.status === 'offline').length;

  return {
    servers,
    activeBookings: bookings.map(b => ({
      serverName: b.server.name,
      userName: b.user.name,
      purpose: b.purpose,
      endDate: b.endDate,
      daysLeft: daysUntil(b.endDate),
      teamAssigned: b.teamAssigned,
    })),
    stats: { total, available, booked, maintenance, offline, utilizationRate: total > 0 ? Math.round((booked / total) * 100) : 0 },
  };
}

function buildRuleBasedResponse(question: string, ctx: ChatContext): string {
  const q = question.toLowerCase();

  // Available servers
  if (q.includes('available') || q.includes('free') || q.includes('open') || q.includes('not booked')) {
    const avail = ctx.servers.filter(s => s.status === 'available');
    if (avail.length === 0) return '❌ No servers are currently available. All servers are either booked, in maintenance, or offline.';
    const list = avail.map(s => {
      const gpu = s.gpuSpec ? ` | GPU: ${s.gpuSpec}` : '';
      return `• **${s.name}** — ${s.cpuSpec}, ${s.memorySpec}${gpu} (${s.location})`;
    }).join('\n');
    return `✅ **${avail.length} server(s) available:**\n\n${list}\n\nYou can book any of these from the Dashboard or Servers page.`;
  }

  // Booked servers / who booked
  if (q.includes('booked') || q.includes('reserved') || q.includes('in use') || q.includes('who is using')) {
    const active = ctx.activeBookings;
    if (active.length === 0) return '📋 No active bookings at the moment. All servers are free!';
    const list = active.map(b => {
      const days = b.daysLeft > 0 ? `${b.daysLeft}d left` : '⚠️ overdue';
      return `• **${b.serverName}** — ${b.userName} (${b.purpose}) [${days}]`;
    }).join('\n');
    return `📋 **${active.length} active booking(s):**\n\n${list}`;
  }

  // Expiring soon
  if (q.includes('expir') || q.includes('ending') || q.includes('due') || q.includes('renew')) {
    const expiring = ctx.activeBookings.filter(b => b.daysLeft <= 7);
    if (expiring.length === 0) return '✅ No bookings expiring within the next 7 days.';
    const list = expiring.map(b => {
      const urgency = b.daysLeft <= 0 ? '🚨 OVERDUE' : b.daysLeft <= 3 ? '⚠️ Urgent' : '⏰ Soon';
      return `• ${urgency} **${b.serverName}** — ${b.userName} (${b.daysLeft <= 0 ? 'expired' : `${b.daysLeft}d left`})`;
    }).join('\n');
    return `⏰ **${expiring.length} booking(s) expiring within 7 days:**\n\n${list}\n\nUsers have been notified to renew or release.`;
  }

  // Status / overview / utilization
  if (q.includes('status') || q.includes('overview') || q.includes('utilization') || q.includes('summary') || q.includes('how many')) {
    const s = ctx.stats;
    return `📊 **Lab Status Overview:**\n\n` +
      `• Total Servers: **${s.total}**\n` +
      `• ✅ Available: **${s.available}**\n` +
      `• 🔵 Booked: **${s.booked}**\n` +
      `• 🔧 Maintenance: **${s.maintenance}**\n` +
      `• 🔴 Offline: **${s.offline}**\n` +
      `• Utilization: **${s.utilizationRate}%**\n\n` +
      `Active bookings: ${ctx.activeBookings.length} | Expiring ≤7d: ${ctx.activeBookings.filter(b => b.daysLeft <= 7).length}`;
  }

  // GPU servers
  if (q.includes('gpu') || q.includes('nvidia') || q.includes('h100') || q.includes('a100') || q.includes('graphics')) {
    const gpuServers = ctx.servers.filter(s => s.gpuSpec);
    if (gpuServers.length === 0) return '❌ No GPU-equipped servers found.';
    const list = gpuServers.map(s => {
      const status = s.status === 'available' ? '✅' : s.status === 'booked' ? '🔵' : '⚪';
      return `• ${status} **${s.name}** — ${s.gpuSpec} (${s.status})`;
    }).join('\n');
    return `🎮 **${gpuServers.length} GPU server(s):**\n\n${list}`;
  }

  // ARM servers
  if (q.includes('arm') || q.includes('cobalt') || q.includes('neoverse') || q.includes('graviton') || q.includes('ampere')) {
    const armServers = ctx.servers.filter(s => {
      const cpu = s.cpuSpec.toLowerCase();
      return cpu.includes('arm') || cpu.includes('neoverse') || cpu.includes('cobalt') || cpu.includes('ampere') || cpu.includes('graviton') || cpu.includes('kunpeng');
    });
    const list = armServers.map(s => {
      const status = s.status === 'available' ? '✅' : s.status === 'booked' ? '🔵' : '⚪';
      return `• ${status} **${s.name}** — ${s.cpuSpec} (${s.status})`;
    }).join('\n');
    return `🔧 **${armServers.length} ARM server(s):**\n\n${list}`;
  }

  // Intel servers
  if (q.includes('intel') || q.includes('xeon') || q.includes('sapphire') || q.includes('emerald') || q.includes('ice lake')) {
    const intelServers = ctx.servers.filter(s => s.cpuSpec.toLowerCase().includes('intel') || s.cpuSpec.toLowerCase().includes('xeon'));
    const list = intelServers.map(s => {
      const status = s.status === 'available' ? '✅' : s.status === 'booked' ? '🔵' : '⚪';
      return `• ${status} **${s.name}** — ${s.cpuSpec} (${s.status})`;
    }).join('\n');
    return `🔷 **${intelServers.length} Intel server(s):**\n\n${list}`;
  }

  // AMD servers
  if (q.includes('amd') || q.includes('epyc') || q.includes('ryzen') || q.includes('genoa') || q.includes('turin')) {
    const amdServers = ctx.servers.filter(s => s.cpuSpec.toLowerCase().includes('amd') || s.cpuSpec.toLowerCase().includes('epyc') || s.cpuSpec.toLowerCase().includes('ryzen'));
    const list = amdServers.map(s => {
      const status = s.status === 'available' ? '✅' : s.status === 'booked' ? '🔵' : '⚪';
      return `• ${status} **${s.name}** — ${s.cpuSpec} (${s.status})`;
    }).join('\n');
    return `🔶 **${amdServers.length} AMD server(s):**\n\n${list}`;
  }

  // Specific server lookup
  const serverMatch = ctx.servers.find(s => q.includes(s.name.toLowerCase()));
  if (serverMatch) {
    const booking = ctx.activeBookings.find(b => b.serverName === serverMatch.name);
    const gpu = serverMatch.gpuSpec ? `\n• GPU: ${serverMatch.gpuSpec}` : '';
    let info = `🖥️ **${serverMatch.name}**\n\n` +
      `• CPU: ${serverMatch.cpuSpec}\n• Memory: ${serverMatch.memorySpec}${gpu}\n` +
      `• Location: ${serverMatch.location}\n• Status: **${serverMatch.status}**`;
    if (booking) {
      info += `\n\n📋 Currently booked by **${booking.userName}** for "${booking.purpose}" (${booking.daysLeft > 0 ? `${booking.daysLeft}d left` : 'overdue'})`;
    }
    return info;
  }

  // Maintenance / offline
  if (q.includes('maintenance') || q.includes('offline') || q.includes('down')) {
    const down = ctx.servers.filter(s => s.status === 'maintenance' || s.status === 'offline');
    if (down.length === 0) return '✅ All servers are online! None in maintenance or offline.';
    const list = down.map(s => `• **${s.name}** — ${s.status} (${s.location})`).join('\n');
    return `⚠️ **${down.length} server(s) currently unavailable:**\n\n${list}`;
  }

  // Teams
  if (q.includes('team') || q.includes('who')) {
    const teams: Record<string, string[]> = {};
    for (const b of ctx.activeBookings) {
      const team = b.teamAssigned || 'Unassigned';
      if (!teams[team]) teams[team] = [];
      teams[team].push(b.serverName);
    }
    if (Object.keys(teams).length === 0) return 'No active team assignments at the moment.';
    const list = Object.entries(teams).map(([team, servers]) =>
      `• **${team}**: ${servers.join(', ')} (${servers.length} server${servers.length > 1 ? 's' : ''})`
    ).join('\n');
    return `👥 **Team allocations:**\n\n${list}`;
  }

  // Help / fallback
  return `🤖 I'm the LabOps Agent! I can help you with:\n\n` +
    `• **"What servers are available?"** — see free servers\n` +
    `• **"Show booked servers"** — who's using what\n` +
    `• **"Lab status"** — utilization overview\n` +
    `• **"Expiring bookings"** — what's due soon\n` +
    `• **"Show GPU servers"** — filter by GPU\n` +
    `• **"Show ARM / Intel / AMD servers"** — filter by architecture\n` +
    `• **"Show maintenance servers"** — what's offline\n` +
    `• **"Team allocations"** — who has what\n` +
    `• Or ask about a specific server by name!\n\n` +
    `Try asking a question about the lab.`;
}

export async function handleAgentChat(message: string, userId: string): Promise<string> {
  const ctx = await gatherChatContext();

  // If LLM is configured, use it for intelligent responses
  if (isLLMConfigured()) {
    const systemPrompt = `You are LabOps Sentinel, an AI assistant for a lab server booking system. Answer questions about server availability, bookings, and lab operations.

CURRENT LAB DATA:
${JSON.stringify({
  stats: ctx.stats,
  servers: ctx.servers.map(s => ({ name: s.name, status: s.status, cpu: s.cpuSpec, memory: s.memorySpec, gpu: s.gpuSpec, location: s.location })),
  activeBookings: ctx.activeBookings.map(b => ({ server: b.serverName, user: b.userName, purpose: b.purpose, daysLeft: b.daysLeft, team: b.teamAssigned })),
}, null, 0)}

INSTRUCTIONS:
- Be concise and helpful. Use markdown formatting with bold for emphasis.
- Reference real server names and data from above.
- If asked about availability, list actual available servers.
- If asked about specific hardware (GPU, ARM, Intel, AMD), filter from the data.
- Use emoji sparingly for visual clarity.
- If the question is unrelated to the lab, politely redirect to lab topics.`;

    const llmResponse = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ]);

    if (llmResponse) return llmResponse;
  }

  // Fallback to rule-based
  return buildRuleBasedResponse(message, ctx);
}
