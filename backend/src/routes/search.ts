import prisma from '../lib/prisma';
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Search reads across the roster, catalog and portfolio, so it is never public.
router.use(authenticateToken);

// Deadline queries were unbounded findMany calls; cap them so a single request
// cannot pull the whole assignment table.
const DEADLINE_LIMIT = 200;

// GET /api/search?q=...
router.get('/', async (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q || (q as string).trim().length < 2) {
    return res.json({ members: [], certifications: [], projects: [] });
  }

  const query = (q as string).trim();
  const user = (req as AuthRequest).user;
  const isAdmin = !!user?.permissions?.manageTeam;

  // Mirror the RBAC in projects.ts: a non-admin only ever sees projects they are
  // assigned to, so search must not become a way around that.
  const projectScope: any = isAdmin
    ? {}
    : { members: { some: { memberId: user?.teamMemberId ?? '__no_team_member__' } } };

  const [members, certifications, projects] = await Promise.all([
    prisma.teamMember.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { designation: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, name: true, designation: true, profilePictureUrl: true },
    }),
    prisma.certification.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { provider: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, name: true, provider: true },
    }),
    prisma.project.findMany({
      where: {
        AND: [
          projectScope,
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { client: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
      },
      take: 5,
      select: { id: true, name: true, status: true, progress: true, client: true },
    }),
  ]);

  res.json({ members, certifications, projects });
});

// GET /api/search/deadlines
router.get('/deadlines', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const isAdmin = !!user?.permissions?.manageTeam;

  // Same scoping as dashboard.ts: a non-admin sees only their own deadlines.
  const scope: any = isAdmin ? {} : { memberId: user?.teamMemberId ?? '__no_team_member__' };

  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);

  const [overdue, dueToday, dueThisWeek, upcoming] = await Promise.all([
    // Overdue certs
    prisma.assignedCertification.findMany({
      where: { ...scope, deadline: { lt: today }, status: { not: 'COMPLETED' } },
      include: { member: { select: { name: true } }, certification: { select: { name: true, provider: true } } },
      orderBy: { deadline: 'asc' },
      take: DEADLINE_LIMIT,
    }),
    // Due today
    prisma.assignedCertification.findMany({
      where: { ...scope, deadline: { gte: today, lt: tomorrow }, status: { not: 'COMPLETED' } },
      include: { member: { select: { name: true } }, certification: { select: { name: true, provider: true } } },
      take: DEADLINE_LIMIT,
    }),
    // Due this week
    prisma.assignedCertification.findMany({
      where: { ...scope, deadline: { gte: tomorrow, lt: nextWeek }, status: { not: 'COMPLETED' } },
      include: { member: { select: { name: true } }, certification: { select: { name: true, provider: true } } },
      orderBy: { deadline: 'asc' },
      take: DEADLINE_LIMIT,
    }),
    // Upcoming (next 30 days)
    prisma.assignedCertification.findMany({
      where: {
        ...scope,
        deadline: { gte: nextWeek, lte: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) },
        status: { not: 'COMPLETED' },
      },
      include: { member: { select: { name: true } }, certification: { select: { name: true, provider: true } } },
      orderBy: { deadline: 'asc' },
      take: DEADLINE_LIMIT,
    }),
  ]);

  res.json({ overdue, dueToday, dueThisWeek, upcoming });
});

export default router;
