import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// GET /api/dashboard/stats
router.get('/stats', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const isAdmin = user?.permissions?.manageTeam;
  const teamMemberId = user?.teamMemberId;

  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);

  const projectWhere: any = isAdmin ? {} : { members: { some: { memberId: teamMemberId as string } } };
  const certWhere: any = isAdmin ? {} : { memberId: teamMemberId as string };

  const [
    totalMembers,
    activeProjects,
    completedProjects,
    totalCerts,
    completedCerts,
    pendingCerts,
    overdueCerts,
    expiredCerts,
    upcomingDeadlines,
  ] = await Promise.all([
    prisma.teamMember.count(), // Open to all, just a count
    prisma.project.count({ where: { ...projectWhere, status: { in: ['PLANNING', 'IN_PROGRESS', 'ON_HOLD'] } } }),
    prisma.project.count({ where: { ...projectWhere, status: 'COMPLETED' } }),
    prisma.assignedCertification.count({ where: certWhere }),
    prisma.assignedCertification.count({ where: { ...certWhere, status: 'COMPLETED' } }),
    prisma.assignedCertification.count({ where: { ...certWhere, status: { in: ['NOT_STARTED', 'IN_PROGRESS'] } } }),
    prisma.assignedCertification.count({ where: { ...certWhere, status: 'OVERDUE' } }),
    prisma.assignedCertification.count({ where: { ...certWhere, status: 'EXPIRED' } }),
    prisma.assignedCertification.count({
      where: { ...certWhere, deadline: { gte: today, lt: nextWeek }, status: { not: 'COMPLETED' } },
    }),
  ]);

  res.json({
    totalMembers,
    activeProjects,
    completedProjects,
    totalCertifications: totalCerts,
    completedCertifications: completedCerts,
    pendingCertifications: pendingCerts,
    overdueCertifications: overdueCerts,
    expiredCertifications: expiredCerts,
    upcomingDeadlines,
  });
});

// GET /api/dashboard/certification-status
router.get('/certification-status', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const isAdmin = user?.permissions?.manageTeam;
  const teamMemberId = user?.teamMemberId;

  const certWhere = isAdmin ? {} : { memberId: teamMemberId as string };

  const statusCounts = await prisma.assignedCertification.groupBy({
    by: ['status'],
    where: certWhere,
    _count: { status: true },
  });

  const data = statusCounts.map(item => ({
    status: item.status,
    count: (item._count as any)?.status || 0,
  }));

  res.json(data);
});

// GET /api/dashboard/project-progress
router.get('/project-progress', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const isAdmin = user?.permissions?.manageTeam;
  const teamMemberId = user?.teamMemberId;

  const projectWhere: any = isAdmin ? {} : { members: { some: { memberId: teamMemberId as string } } };

  const projects = await prisma.project.findMany({
    where: projectWhere,
    select: { name: true, progress: true, status: true },
    orderBy: { progress: 'desc' },
    take: 8,
  });
  res.json(projects);
});

// GET /api/dashboard/monthly-completions
router.get('/monthly-completions', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const isAdmin = user?.permissions?.manageTeam;
  const teamMemberId = user?.teamMemberId;

  const certWhere = isAdmin ? {} : { memberId: teamMemberId as string };

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const completions = await prisma.assignedCertification.findMany({
    where: {
      ...certWhere,
      status: 'COMPLETED',
      completionDate: { gte: sixMonthsAgo },
    },
    select: { completionDate: true },
  });

  // Group by month
  const monthlyData: Record<string, number> = {};
  completions.forEach(c => {
    if (c.completionDate) {
      const key = c.completionDate.toISOString().substring(0, 7); // YYYY-MM
      monthlyData[key] = (monthlyData[key] || 0) + 1;
    }
  });

  // Build last 6 months
  const result = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().substring(0, 7);
    const month = d.toLocaleString('default', { month: 'short', year: 'numeric' });
    result.push({ month, count: monthlyData[key] || 0 });
  }

  res.json(result);
});

// GET /api/dashboard/recent-activities
router.get('/recent-activities', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const isAdmin = user?.permissions?.manageTeam;
  const teamMemberId = user?.teamMemberId;

  // Activities don't have a direct member association in all cases except when memberId is set
  // For scoping, if not admin, show notifications for their own profile.
  // Actually Notification table has `memberId`.
  const notificationWhere = isAdmin ? {} : { memberId: teamMemberId as string };

  const notifications = await prisma.notification.findMany({
    where: notificationWhere,
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      member: { select: { name: true, profilePictureUrl: true } },
    },
  });
  res.json(notifications);
});

// GET /api/dashboard/upcoming-deadlines
router.get('/upcoming-deadlines', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const isAdmin = user?.permissions?.manageTeam;
  const teamMemberId = user?.teamMemberId;

  const certWhere = isAdmin ? {} : { memberId: teamMemberId as string };
  const projectWhere = isAdmin ? {} : { members: { some: { memberId: teamMemberId as string } } };

  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setDate(nextMonth.getDate() + 30);

  const [certDeadlines, projectDeadlines] = await Promise.all([
    prisma.assignedCertification.findMany({
      where: {
        ...certWhere,
        deadline: { gte: now, lte: nextMonth },
        status: { not: 'COMPLETED' },
      },
      orderBy: { deadline: 'asc' },
      take: 5,
      include: {
        member: { select: { name: true, profilePictureUrl: true } },
        certification: { select: { name: true, provider: true } },
      },
    }),
    prisma.project.findMany({
      where: {
        ...projectWhere,
        endDate: { gte: now, lte: nextMonth },
        status: { not: 'COMPLETED' },
      },
      orderBy: { endDate: 'asc' },
      take: 5,
      select: { id: true, name: true, endDate: true, status: true, progress: true, priority: true },
    }),
  ]);

  res.json({ certifications: certDeadlines, projects: projectDeadlines });
});

export default router;
