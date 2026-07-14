import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const cleanupExpiredLogs = async () => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // EXACT Deletion query that targets ONLY activity_logs
    const result = await prisma.activityLog.deleteMany({
      where: {
        createdAt: {
          lt: sevenDaysAgo,
        },
      },
    });

    if (result.count > 0) {
      console.log(`[Log Cleanup] Purged ${result.count} expired activity logs.`);
    } else {
      console.log(`[Log Cleanup] No expired activity logs found.`);
    }
  } catch (error) {
    console.error('[Log Cleanup] Error during cleanup job:', error);
  }
};

export const initLogCleanupJob = () => {
  // 1. Run immediately on server startup (handles Render waking up from sleep)
  cleanupExpiredLogs();

  // 2. Schedule to run daily at midnight (if server stays awake)
  cron.schedule('0 0 * * *', () => {
    console.log('[Log Cleanup] Running scheduled daily cleanup...');
    cleanupExpiredLogs();
  });
};
