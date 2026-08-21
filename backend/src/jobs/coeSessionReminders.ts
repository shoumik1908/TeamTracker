import cron from 'node-cron';
import prisma from '../lib/prisma';

async function createReminderNotifications(type: 'COE_SESSION_REMINDER_DAY' | 'COE_SESSION_REMINDER_30_MIN', title: string, message: string) {
  const members = await prisma.teamMember.findMany({ select: { id: true } });
  await prisma.notification.createMany({ data: [
    ...members.map(member => ({ memberId: member.id, type: type as any, title, message })),
    { targetRole: 'Admin', type: type as any, title, message },
  ] });
}

export async function sendCoeSessionReminders() {
  try {
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    const [daySessions, thirtyMinuteSessions] = await Promise.all([
      prisma.coeKnowledgeSession.findMany({ where: { status: 'SCHEDULED', dayReminderSentAt: null, scheduledAt: { gte: now, lte: oneDayFromNow } }, include: { organizer: { select: { name: true } } } }),
      prisma.coeKnowledgeSession.findMany({ where: { status: 'SCHEDULED', thirtyMinuteReminderSentAt: null, scheduledAt: { gte: now, lte: thirtyMinutesFromNow } }, include: { organizer: { select: { name: true } } } }),
    ]);

    for (const session of daySessions) {
      await createReminderNotifications('COE_SESSION_REMINDER_DAY', `Tomorrow: ${session.topic}`, `${session.organizer.name}'s knowledge-sharing session starts in less than 24 hours.`);
      await prisma.coeKnowledgeSession.update({ where: { id: session.id }, data: { dayReminderSentAt: new Date() } });
    }
    for (const session of thirtyMinuteSessions) {
      await createReminderNotifications('COE_SESSION_REMINDER_30_MIN', `Starting soon: ${session.topic}`, `${session.organizer.name}'s knowledge-sharing session starts within 30 minutes.`);
      await prisma.coeKnowledgeSession.update({ where: { id: session.id }, data: { thirtyMinuteReminderSentAt: new Date() } });
    }
  } catch (error) {
    console.error('[COE Session Reminders] Failed to send reminders:', error);
  }
}

export function initCoeSessionReminderJob() {
  setTimeout(sendCoeSessionReminders, 5000);
  cron.schedule('* * * * *', sendCoeSessionReminders);
}
