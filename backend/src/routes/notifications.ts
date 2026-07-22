import prisma from '../lib/prisma';
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// GET /api/notifications
router.get('/', async (req: Request, res: Response) => {
  const { unreadOnly, page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const user = (req as AuthRequest).user;
  const where: any = {};
  
  const orConditions: any[] = [];
  
  if (user?.teamMemberId) {
    orConditions.push({ memberId: user.teamMemberId });
  }
  
  if (user?.permissions?.manageTeam) {
    orConditions.push({ targetRole: 'Admin' });
  }

  // Only fetch targeted notifications

  if (orConditions.length > 0) {
    where.OR = orConditions;
  } else {
    where.id = 'NO_RESULTS';
  }

  if (unreadOnly === 'true') where.read = false;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: { member: { select: { name: true, profilePictureUrl: true } } },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, read: false } }),
  ]);

  res.json({
    data: notifications,
    unreadCount,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  });
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notif) throw new AppError('Notification not found', 404);

  if (!user?.permissions?.manageTeam && !notif.memberId) {
    // If team member tries to read a global notification, just return success without modifying
    return res.json(notif);
  }

  if (user?.teamMemberId && notif.memberId && notif.memberId !== user.teamMemberId) {
    throw new AppError('Forbidden', 403);
  }

  const updated = await prisma.notification.update({
    where: { id: req.params.id },
    data: { read: true },
  });
  res.json(updated);
});

// PUT /api/notifications/read-all - Mark all as read
router.put('/read-all/mark', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const where: any = { read: false };
  
  const orConditions: any[] = [];
  if (user?.teamMemberId) {
    orConditions.push({ memberId: user.teamMemberId });
  }
  if (user?.permissions?.manageTeam) {
    orConditions.push({ targetRole: 'Admin' });
  }
  
  if (orConditions.length > 0) {
    where.OR = orConditions;
    await prisma.notification.updateMany({ where, data: { read: true } });
  }
  
  res.json({ message: 'All notifications marked as read' });
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notif) throw new AppError('Notification not found', 404);

  if (!user?.permissions?.manageTeam && !notif.memberId) {
    throw new AppError('Forbidden: Cannot delete global notifications', 403);
  }

  if (user?.teamMemberId && notif.memberId && notif.memberId !== user.teamMemberId) {
    throw new AppError('Forbidden', 403);
  }

  await prisma.notification.delete({ where: { id: req.params.id } });
  res.json({ message: 'Notification deleted' });
});

export default router;
