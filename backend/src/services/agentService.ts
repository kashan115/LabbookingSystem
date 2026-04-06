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
