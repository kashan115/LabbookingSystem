import nodemailer, { Transporter } from 'nodemailer';
import logger from '../config/logger';

export interface BookingSummary {
  serverName: string;
  startDate: Date;
  endDate: Date;
  daysRemaining: number;
  purpose: string;
  status: string;
}

export interface UserDigestPayload {
  name: string;
  email: string;
  activeBookings: BookingSummary[];
  expiringBookings: BookingSummary[]; // expiring within 7 days
  totalServersAvailable: number;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASS must be set to send emails');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

function htmlTemplate(payload: UserDigestPayload): string {
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@lab-booking.com';
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const bookingRows = payload.activeBookings.map(b => {
    const expiring = b.daysRemaining <= 7;
    const rowStyle = expiring ? 'background:#fff7e6;' : '';
    const badge = expiring
      ? `<span style="color:#e67e22;font-weight:bold;">⚠ Expires in ${b.daysRemaining} day${b.daysRemaining !== 1 ? 's' : ''}</span>`
      : `<span style="color:#27ae60;">${b.daysRemaining} days left</span>`;
    return `
      <tr style="${rowStyle}">
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:500;">${b.serverName}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">${b.purpose}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">${new Date(b.endDate).toLocaleDateString()}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">${badge}</td>
      </tr>`;
  }).join('');

  const expiryAlert = payload.expiringBookings.length > 0
    ? `<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:16px;margin:20px 0;">
        <strong>⚠ Action Required:</strong> You have ${payload.expiringBookings.length} booking${payload.expiringBookings.length > 1 ? 's' : ''} expiring within 7 days:
        <ul style="margin:8px 0 0 0;padding-left:20px;">
          ${payload.expiringBookings.map(b => `<li><strong>${b.serverName}</strong> — expires ${new Date(b.endDate).toLocaleDateString()} (${b.daysRemaining} day${b.daysRemaining !== 1 ? 's' : ''})</li>`).join('')}
        </ul>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;">
  <div style="max-width:600px;margin:32px auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:#1a1a2e;padding:28px 32px;">
      <h1 style="color:white;margin:0;font-size:22px;">🖥 Lab Booking — Weekly Digest</h1>
      <p style="color:#a0aec0;margin:6px 0 0 0;font-size:13px;">Week of ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="color:#333;font-size:15px;">Hi <strong>${payload.name}</strong>,</p>
      <p style="color:#555;font-size:14px;">Here's your weekly summary from the Lab Booking System.</p>

      ${expiryAlert}

      <!-- Stats row -->
      <div style="display:flex;gap:12px;margin:20px 0;">
        <div style="flex:1;background:#f0f4ff;border-radius:6px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:bold;color:#3b5bdb;">${payload.activeBookings.length}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">Active Booking${payload.activeBookings.length !== 1 ? 's' : ''}</div>
        </div>
        <div style="flex:1;background:#f0fff4;border-radius:6px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:bold;color:#2f9e44;">${payload.totalServersAvailable}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">Servers Available</div>
        </div>
        <div style="flex:1;background:${payload.expiringBookings.length > 0 ? '#fff7e6' : '#f8f9fa'};border-radius:6px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:bold;color:${payload.expiringBookings.length > 0 ? '#e67e22' : '#868e96'};">${payload.expiringBookings.length}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">Expiring Soon</div>
        </div>
      </div>

      ${payload.activeBookings.length > 0 ? `
      <!-- Bookings table -->
      <h3 style="font-size:15px;color:#333;margin:20px 0 12px 0;">Your Active Bookings</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f8f9fa;">
            <th style="padding:10px 12px;text-align:left;color:#555;font-weight:600;border-bottom:2px solid #eee;">Server</th>
            <th style="padding:10px 12px;text-align:left;color:#555;font-weight:600;border-bottom:2px solid #eee;">Purpose</th>
            <th style="padding:10px 12px;text-align:left;color:#555;font-weight:600;border-bottom:2px solid #eee;">Expires</th>
            <th style="padding:10px 12px;text-align:left;color:#555;font-weight:600;border-bottom:2px solid #eee;">Status</th>
          </tr>
        </thead>
        <tbody>${bookingRows}</tbody>
      </table>` : `
      <div style="text-align:center;padding:32px;color:#999;">
        <div style="font-size:40px;">📋</div>
        <p>You have no active bookings this week.</p>
        <a href="${appUrl}" style="color:#3b5bdb;text-decoration:none;font-weight:500;">Browse available servers →</a>
      </div>`}

      <!-- CTA -->
      ${payload.activeBookings.length > 0 ? `
      <div style="margin-top:24px;text-align:center;">
        <a href="${appUrl}" style="display:inline-block;background:#1a1a2e;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">View My Bookings</a>
      </div>` : ''}
    </div>

    <!-- Footer -->
    <div style="background:#f8f9fa;padding:16px 32px;border-top:1px solid #eee;text-align:center;">
      <p style="color:#999;font-size:12px;margin:0;">You're receiving this because you have an account on the Lab Booking System.</p>
      <p style="color:#999;font-size:12px;margin:4px 0 0 0;">Sent from ${fromEmail}</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendWeeklyDigest(payload: UserDigestPayload): Promise<void> {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await t.sendMail({
    from: `"Lab Booking System" <${from}>`,
    to: payload.email,
    subject: `📋 Your Weekly Lab Digest — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    html: htmlTemplate(payload),
  });

  logger.info(`Weekly digest sent to ${payload.email}`);
}

export async function sendTestEmail(to: string): Promise<void> {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await t.sendMail({
    from: `"Lab Booking System" <${from}>`,
    to,
    subject: '✅ Lab Booking — Email Test',
    html: `<div style="font-family:Arial,sans-serif;padding:32px;max-width:480px;margin:auto;">
      <h2>Email is working! 🎉</h2>
      <p>Your SMTP configuration is correct. Weekly digests will be sent every Monday at 8:00 AM.</p>
      <p style="color:#999;font-size:12px;">Sent: ${new Date().toISOString()}</p>
    </div>`,
  });
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}
