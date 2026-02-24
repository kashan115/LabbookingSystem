import { Router, Response, NextFunction } from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { runWeeklyDigest } from '../services/scheduler';
import { sendTestEmail, isEmailConfigured } from '../services/emailService';
import { AppError } from '../middleware/errorHandler';
import { EMAIL_DIGEST_SCHEDULE_DESC } from '../config/constants';

const router = Router();

// GET /api/admin/email-status
router.get('/email-status', authenticate, requireAdmin, (_req: AuthRequest, res: Response) => {
  res.json({
    status: 'success',
    data: {
      configured: isEmailConfigured(),
      schedule: EMAIL_DIGEST_SCHEDULE_DESC,
    },
  });
});

// POST /api/admin/send-weekly-digest — manually trigger digest
router.post('/send-weekly-digest', authenticate, requireAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!isEmailConfigured()) throw new AppError(400, 'SMTP not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.');
    const result = await runWeeklyDigest();
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/send-test-email — test the SMTP connection
router.post('/send-test-email', authenticate, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!isEmailConfigured()) throw new AppError(400, 'SMTP not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.');
    const email = req.user!.email;
    await sendTestEmail(email);
    res.json({ status: 'success', data: { message: `Test email sent to ${email}` } });
  } catch (error) {
    next(error);
  }
});

export default router;
