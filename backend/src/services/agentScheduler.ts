import cron from 'node-cron';
import logger from '../config/logger';
import { runAgentCycle, runWeeklyAISummary, isAgentEnabled } from './agentService';

export function startAgentScheduler(): void {
  if (!isAgentEnabled()) {
    logger.warn('🤖 Agent scheduler disabled (AGENT_ENABLED=false)');
    return;
  }

  // Agent monitoring cycle: every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    logger.info('🤖 Cron: agent monitoring cycle');
    try {
      await runAgentCycle();
    } catch (err) {
      logger.error('🤖 Agent cycle cron failed:', err);
    }
  }, { timezone: 'UTC' });

  // Weekly AI summary: every Monday at 09:00 UTC (1 hour after regular digest)
  cron.schedule('0 9 * * 1', async () => {
    logger.info('🤖 Cron: weekly AI summary');
    try {
      await runWeeklyAISummary();
    } catch (err) {
      logger.error('🤖 Agent weekly summary cron failed:', err);
    }
  }, { timezone: 'UTC' });

  logger.info('🤖 Agent scheduler started (monitoring every 4h, AI summary Mondays 09:00 UTC)');
}
