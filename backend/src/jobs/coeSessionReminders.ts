import cron from 'node-cron';
import prisma from '../lib/prisma';

async function createReminderNotifications(type: 'COE_SESSION_REMINDER_DAY' | 'COE_SESSION_REMINDER_30_MIN', title: string, message: string) {
  const members = await prisma.teamMember.findMany({ select: { id: true } });
  await prisma.notification.createMany({ data: [
    ...members.map(member => ({ memberId: member.id, type: type as any, title, message })),
    { targetRole: 'Admin', type: type as any, title, message },
  ] });
}

// TT-096: this cron fires every minute and fanned out one notification per team member
// *before* marking the session reminded. If the update failed, or if a run took longer
// than 60 seconds and the next tick started, every member was notified again for the
// same session. A run that overlaps itself is the common case, not the edge case.
let isRunning = false;

export async function sendCoeSessionReminders() {
  if (isRunning) {
    console.log('[COE Session Reminders] Previous run still in progress — skipping this tick.');
    return;
  }
  isRunning = true;
  try {
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    const [daySessions, thirtyMinuteSessions] = await Promise.all([
      prisma.coeKnowledgeSession.findMany({ where: { status: 'SCHEDULED', dayReminderSentAt: null, scheduledAt: { gte: now, lte: oneDayFromNow } }, include: { organizer: { select: { name: true } } } }),
      prisma.coeKnowledgeSession.findMany({ where: { status: 'SCHEDULED', thirtyMinuteReminderSentAt: null, scheduledAt: { gte: now, lte: thirtyMinutesFromNow } }, include: { organizer: { select: { name: true } } } }),
    ]);

    // Claim first, then send. The conditional updateMany only matches while the column is
    // still null, so exactly one run wins the claim and a duplicate fan-out is impossible.
    // The trade is the opposite failure: if the send fails after the claim, that reminder
    // is skipped rather than repeated — which is the right way round for a notification
    // that goes to every member of the team.
    for (const session of daySessions) {
      const claimed = await prisma.coeKnowledgeSession.updateMany({
        where: { id: session.id, dayReminderSentAt: null },
        data: { dayReminderSentAt: new Date() },
      });
      if (claimed.count !== 1) continue;
      await createReminderNotifications('COE_SESSION_REMINDER_DAY', `Tomorrow: ${session.topic}`, `${session.organizer.name}'s knowledge-sharing session starts in less than 24 hours.`);
    }
    for (const session of thirtyMinuteSessions) {
      const claimed = await prisma.coeKnowledgeSession.updateMany({
        where: { id: session.id, thirtyMinuteReminderSentAt: null },
        data: { thirtyMinuteReminderSentAt: new Date() },
      });
      if (claimed.count !== 1) continue;
      await createReminderNotifications('COE_SESSION_REMINDER_30_MIN', `Starting soon: ${session.topic}`, `${session.organizer.name}'s knowledge-sharing session starts within 30 minutes.`);
    }
  } catch (error) {
    console.error('[COE Session Reminders] Failed to send reminders:', error);
  } finally {
    isRunning = false;
  }
}

export function initCoeSessionReminderJob() {
  setTimeout(sendCoeSessionReminders, 5000);
  cron.schedule('* * * * *', sendCoeSessionReminders);
}
