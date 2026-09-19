import prisma from '../lib/prisma';
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { parseEditRequestNotificationMessage } from '../services/certificateEditRequest';

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

  // TT-088: `read` is a single column shared by every recipient, so an admin marking a
  // role-targeted notification read cleared it for all the others. Unread now means:
  // the legacy flag is not set AND this particular person has no read row. Keeping the
  // flag in the condition is what preserves the state already in the database — nothing
  // currently marked read comes back as unread on deploy.
  const unreadForThisUser = user?.id
    ? [{ read: false }, { reads: { none: { userId: user.id } } }]
    : [{ read: false }];

  if (unreadOnly === 'true') where.AND = unreadForThisUser;

  const unreadWhere = { ...where, AND: unreadForThisUser };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        member: { select: { name: true, profilePictureUrl: true } },
        // Only this caller's row: whether anyone else has read it is not their business.
        reads: user?.id ? { where: { userId: user.id }, select: { id: true } } : false,
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: unreadWhere }),
  ]);

  const editRequestIds = notifications
    .filter(notification => notification.type === 'CERTIFICATE_EDIT_REQUESTED')
    .map(notification => parseEditRequestNotificationMessage(notification.message).editRequestId)
    .filter((id): id is string => Boolean(id));

  const editRequests = editRequestIds.length > 0
    ? await prisma.certificateEditRequest.findMany({
        where: { id: { in: editRequestIds } },
        include: {
          assignment: {
            include: {
              member: { select: { id: true, name: true } },
              certification: { select: { id: true, name: true, provider: true } },
            },
          },
        },
      })
    : [];
  const editRequestsById = new Map(editRequests.map(request => [request.id, request]));

  const notificationData = notifications.map(notification => {
    const { message, editRequestId } = parseEditRequestNotificationMessage(notification.message);
    // TT-088: `read` on the wire is this caller's read state, not the shared column.
    // `reads` is an implementation detail and does not leave the server.
    const { reads, ...rest } = notification as typeof notification & { reads?: unknown[] };
    return {
      ...rest,
      read: notification.read || (Array.isArray(reads) && reads.length > 0),
      message,
      ...(editRequestId && {
        certificateEditRequestId: editRequestId,
        certificateEditRequest: editRequestsById.get(editRequestId) || null,
      }),
    };
  });

  res.json({
    data: notificationData,
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

  // TT-088: a role-targeted notification is marked read for this person only. A
  // member-targeted one has exactly one recipient, so the existing column still says
  // everything there is to say and is left as it was.
  if (notif.memberId) {
    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });
    return res.json({ ...updated, read: true });
  }

  if (!user?.id) throw new AppError('Forbidden', 403);
  await prisma.notificationRead.upsert({
    where: { notificationId_userId: { notificationId: notif.id, userId: user.id } },
    create: { notificationId: notif.id, userId: user.id },
    update: {},
  });
  res.json({ ...notif, read: true });
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

    // Member-targeted rows keep using the column; role-targeted ones get a row each, so
    // clearing your own list does not clear everyone else's.
    await prisma.notification.updateMany({
      where: { ...where, memberId: { not: null } },
      data: { read: true },
    });

    if (user?.id) {
      const roleTargeted = await prisma.notification.findMany({
        where: {
          ...where,
          memberId: null,
          reads: { none: { userId: user.id } },
        },
        select: { id: true },
      });
      if (roleTargeted.length > 0) {
        await prisma.notificationRead.createMany({
          data: roleTargeted.map(n => ({ notificationId: n.id, userId: user.id! })),
          skipDuplicates: true,
        });
      }
    }
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
