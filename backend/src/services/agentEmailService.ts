import nodemailer from 'nodemailer';
import logger from '../config/logger';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error('SMTP not configured');
  transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  return transporter;
}

interface ReminderPayload {
  userName: string;
  userEmail: string;
  serverName: string;
  endDate: Date;
  daysLeft: number;
  purpose: string;
  aiInsight?: string;
}

export async function sendAgentReminderEmail(p: ReminderPayload): Promise<void> {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const aiBlock = p.aiInsight
    ? `<div style="background:#f0f4ff;border-left:4px solid #3b5bdb;padding:14px 18px;border-radius:4px;margin:18px 0;">
        <strong style="color:#3b5bdb;">🤖 AI Agent Note:</strong>
        <p style="margin:8px 0 0;color:#444;font-size:14px;">${p.aiInsight}</p>
      </div>`
    : '';

  await t.sendMail({
    from: `"LabOps Agent" <${from}>`,
    to: p.userEmail,
    subject: `⏰ Booking Expiring in ${p.daysLeft} day${p.daysLeft !== 1 ? 's' : ''}: ${p.serverName}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;">
<div style="max-width:560px;margin:32px auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#e67e22,#f39c12);padding:24px 32px;">
    <h1 style="color:white;margin:0;font-size:20px;">⏰ Booking Expiry Reminder</h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">Automated alert from LabOps Agent</p>
  </div>
  <div style="padding:28px 32px;">
    <p style="color:#333;">Hi <strong>${p.userName}</strong>,</p>
    <p style="color:#555;">Your booking for <strong>${p.serverName}</strong> expires <strong>${p.daysLeft === 0 ? 'today' : `in ${p.daysLeft} day${p.daysLeft !== 1 ? 's' : ''}`}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:8px 0;color:#888;width:120px;">Server</td><td style="padding:8px 0;font-weight:600;">${p.serverName}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Expires</td><td style="padding:8px 0;font-weight:600;color:#e67e22;">${p.endDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Purpose</td><td style="padding:8px 0;">${p.purpose}</td></tr>
    </table>
    ${aiBlock}
    <p style="color:#555;font-size:14px;">To continue using this server, please extend your booking before it expires.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${appUrl}" style="display:inline-block;background:#1a1a2e;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:500;">Extend Booking →</a>
    </div>
  </div>
  <div style="background:#f8f9fa;padding:14px 32px;text-align:center;border-top:1px solid #eee;">
    <p style="color:#999;font-size:11px;margin:0;">🤖 Sent automatically by LabOps Sentinel Agent</p>
  </div>
</div></body></html>`,
  });
  logger.info(`Agent reminder email sent to ${p.userEmail} for ${p.serverName}`);
}

interface ExpiredPayload {
  userName: string;
  userEmail: string;
  serverName: string;
  endDate: Date;
  purpose: string;
  daysOverdue: number;
}

export async function sendBookingExpiredEmail(p: ExpiredPayload): Promise<void> {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  await t.sendMail({
    from: `"LabOps Agent" <${from}>`,
    to: p.userEmail,
    subject: `✅ Booking Completed: ${p.serverName}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;">
<div style="max-width:560px;margin:32px auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#27ae60,#2ecc71);padding:24px 32px;">
    <h1 style="color:white;margin:0;font-size:20px;">✅ Booking Completed</h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">Your reservation has ended</p>
  </div>
  <div style="padding:28px 32px;">
    <p style="color:#333;">Hi <strong>${p.userName}</strong>,</p>
    <p style="color:#555;">Your booking for <strong>${p.serverName}</strong> has been automatically completed. The server is now available for other engineers.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:8px 0;color:#888;width:120px;">Server</td><td style="padding:8px 0;font-weight:600;">${p.serverName}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Ended</td><td style="padding:8px 0;">${p.endDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Purpose</td><td style="padding:8px 0;">${p.purpose}</td></tr>
    </table>
    <p style="color:#555;font-size:14px;">Need to book again? Visit the dashboard to reserve a new server.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${appUrl}" style="display:inline-block;background:#1a1a2e;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:500;">Book a Server →</a>
    </div>
  </div>
  <div style="background:#f8f9fa;padding:14px 32px;text-align:center;border-top:1px solid #eee;">
    <p style="color:#999;font-size:11px;margin:0;">🤖 Sent automatically by LabOps Sentinel Agent</p>
  </div>
</div></body></html>`,
  });
  logger.info(`Booking expired email sent to ${p.userEmail} for ${p.serverName}`);
}

interface AISummaryPayload {
  adminName: string;
  adminEmail: string;
  analysis: string;
  stats: {
    totalServers: number; available: number; activeBookings: number;
    actionsTaken: number; warningsRaised: number; errorsEncountered: number;
  };
  topActions: Array<{ title: string; detail: string; createdAt: Date }>;
}

export async function sendAIWeeklySummaryEmail(p: AISummaryPayload): Promise<void> {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const analysisHtml = p.analysis.split('\n').map(line => {
    if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*'))
      return `<li style="margin:6px 0;color:#444;">${line.replace(/^[•\-*]\s*/, '')}</li>`;
    return `<p style="margin:6px 0;color:#444;">${line}</p>`;
  }).join('');

  const actionsHtml = p.topActions.map(a =>
    `<li style="margin:4px 0;font-size:13px;"><strong>${a.title}</strong> <span style="color:#999;">— ${new Date(a.createdAt).toLocaleString()}</span></li>`
  ).join('');

  await t.sendMail({
    from: `"LabOps Agent" <${from}>`,
    to: p.adminEmail,
    subject: `🤖 Weekly Agent Report — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;">
<div style="max-width:600px;margin:32px auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:24px 32px;">
    <h1 style="color:white;margin:0;font-size:20px;">🤖 LabOps Agent — Weekly Report</h1>
    <p style="color:#a0aec0;margin:4px 0 0;font-size:13px;">AI-powered lab operations summary</p>
  </div>
  <div style="padding:28px 32px;">
    <p style="color:#333;">Hi <strong>${p.adminName}</strong>,</p>
    <div style="display:flex;gap:12px;margin:20px 0;">
      <div style="flex:1;background:#f0f4ff;border-radius:6px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:bold;color:#3b5bdb;">${p.stats.actionsTaken}</div>
        <div style="font-size:11px;color:#666;">Actions Taken</div>
      </div>
      <div style="flex:1;background:#fff7e6;border-radius:6px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:bold;color:#e67e22;">${p.stats.warningsRaised}</div>
        <div style="font-size:11px;color:#666;">Warnings</div>
      </div>
      <div style="flex:1;background:#f0fff4;border-radius:6px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:bold;color:#2f9e44;">${p.stats.available}</div>
        <div style="font-size:11px;color:#666;">Available</div>
      </div>
    </div>
    <h3 style="font-size:15px;color:#1a1a2e;">🧠 AI Analysis</h3>
    <div style="background:#f8f9fa;border-radius:6px;padding:16px;margin:12px 0;">
      <ul style="padding-left:20px;margin:0;">${analysisHtml}</ul>
    </div>
    ${p.topActions.length > 0 ? `
    <h3 style="font-size:15px;color:#1a1a2e;">⚡ Recent Agent Actions</h3>
    <ul style="padding-left:20px;">${actionsHtml}</ul>` : ''}
    <div style="text-align:center;margin:24px 0;">
      <a href="${appUrl}" style="display:inline-block;background:#1a1a2e;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:500;">Open Agent Dashboard →</a>
    </div>
  </div>
  <div style="background:#f8f9fa;padding:14px 32px;text-align:center;border-top:1px solid #eee;">
    <p style="color:#999;font-size:11px;margin:0;">🤖 LabOps Sentinel Agent — Automated Intelligence</p>
  </div>
</div></body></html>`,
  });
  logger.info(`Weekly AI summary sent to ${p.adminEmail}`);
}
