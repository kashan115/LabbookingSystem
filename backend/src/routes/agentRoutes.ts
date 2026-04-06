import { Router, Response, NextFunction } from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { runAgentCycle, runWeeklyAISummary, getAgentStatus, getAgentLogs, isAgentEnabled, isLLMConfigured, handleAgentChat } from '../services/agentService';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// GET /api/agent/status — agent health + system snapshot
router.get('/status', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = await getAgentStatus();
    res.json({ status: 'success', data: status });
  } catch (error) {
    next(error);
  }
});

// GET /api/agent/logs — agent activity log
router.get('/logs', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const taskType = req.query.taskType as string | undefined;
    const logs = await getAgentLogs(limit, taskType);
    res.json({ status: 'success', data: logs });
  } catch (error) {
    next(error);
  }
});

// POST /api/agent/run-cycle — manually trigger a full agent cycle (admin only)
router.post('/run-cycle', authenticate, requireAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!isAgentEnabled()) throw new AppError(400, 'Agent is disabled. Set AGENT_ENABLED=true to enable.');
    const result = await runAgentCycle();
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
});

// POST /api/agent/weekly-summary — manually trigger weekly AI summary (admin only)
router.post('/weekly-summary', authenticate, requireAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!isAgentEnabled()) throw new AppError(400, 'Agent is disabled.');
    await runWeeklyAISummary();
    res.json({ status: 'success', data: { message: 'Weekly AI summary generated and sent to admins.' } });
  } catch (error) {
    next(error);
  }
});

// POST /api/agent/chat — conversational agent messenger
router.post("/chat", authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      throw new AppError(400, "Message is required.");
    }
    if (message.length > 500) throw new AppError(400, "Message too long (max 500 chars).");
    const reply = await handleAgentChat(message.trim(), req.user!.id);
    res.json({ status: "success", data: { reply } });
  } catch (error) {
    next(error);
  }
});

export default router;
