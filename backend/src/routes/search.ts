import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/search?q=...
router.get('/', async (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q || (q as string).trim().length < 2) {
    return res.json({ members: [], certifications: [], projects: [] });
  }

  const query = (q as string).trim();

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
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { client: { contains: query, mode: 'insensitive' } },
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
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);

  const [overdue, dueToday, dueThisWeek, upcoming] = await Promise.all([
    // Overdue certs
    prisma.assignedCertification.findMany({
      where: { deadline: { lt: today }, status: { not: 'COMPLETED' } },
      include: { member: { select: { name: true } }, certification: { select: { name: true, provider: true } } },
      orderBy: { deadline: 'asc' },
    }),
    // Due today
    prisma.assignedCertification.findMany({
      where: { deadline: { gte: today, lt: tomorrow }, status: { not: 'COMPLETED' } },
      include: { member: { select: { name: true } }, certification: { select: { name: true, provider: true } } },
    }),
    // Due this week
    prisma.assignedCertification.findMany({
      where: { deadline: { gte: tomorrow, lt: nextWeek }, status: { not: 'COMPLETED' } },
      include: { member: { select: { name: true } }, certification: { select: { name: true, provider: true } } },
      orderBy: { deadline: 'asc' },
    }),
    // Upcoming (next 30 days)
    prisma.assignedCertification.findMany({
      where: {
        deadline: { gte: nextWeek, lte: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) },
        status: { not: 'COMPLETED' },
      },
      include: { member: { select: { name: true } }, certification: { select: { name: true, provider: true } } },
      orderBy: { deadline: 'asc' },
    }),
  ]);

  res.json({ overdue, dueToday, dueThisWeek, upcoming });
});

export default router;
