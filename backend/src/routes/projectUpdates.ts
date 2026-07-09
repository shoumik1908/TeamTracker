import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const prisma = new PrismaClient();

// GET /api/project-updates
router.get('/', async (req: Request, res: Response) => {
  const { projectId, limit = '50' } = req.query;

  const where: any = {};
  if (projectId) where.projectId = projectId as string;

  const updates = await prisma.projectUpdate.findMany({
    where,
    take: parseInt(limit as string),
    orderBy: { createdAt: 'desc' },
    include: {
      project: { select: { id: true, name: true, status: true } },
      member: { select: { id: true, name: true, designation: true, profilePictureUrl: true } },
    },
  });

  res.json({ data: updates, total: updates.length });
});

// POST /api/project-updates
router.post('/', async (req: Request, res: Response) => {
  const { projectId, memberId, updateText, updateType, progressValue } = req.body;

  if (!projectId) throw new AppError('projectId is required', 400);
  if (!memberId) throw new AppError('memberId is required', 400);
  if (!updateText?.trim()) throw new AppError('updateText is required', 400);
  if (!updateType) throw new AppError('updateType is required', 400);

  const update = await prisma.projectUpdate.create({
    data: {
      projectId,
      memberId,
      updateText: updateText.trim(),
      updateType,
      progressValue: progressValue !== undefined ? parseInt(progressValue) : null,
    },
    include: {
      project: { select: { id: true, name: true, status: true } },
      member: { select: { id: true, name: true, designation: true, profilePictureUrl: true } },
    },
  });

  // Fire a notification so the manager sees it in the Notifications feed too
  await prisma.notification.create({
    data: {
      memberId,
      type: 'PROJECT_UPDATED',
      title: `${updateType} Update: ${update.project.name}`,
      message: updateText.trim().slice(0, 120),
    },
  });

  res.status(201).json(update);
});

// PUT /api/project-updates/:id
router.put('/:id', async (req: Request, res: Response) => {
  const { updateText, updateType } = req.body;

  const existing = await prisma.projectUpdate.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError('Update not found', 404);

  const updated = await prisma.projectUpdate.update({
    where: { id: req.params.id },
    data: {
      ...(updateText?.trim() && { updateText: updateText.trim() }),
      ...(updateType && { updateType }),
    },
    include: {
      project: { select: { id: true, name: true, status: true } },
      member: { select: { id: true, name: true, designation: true, profilePictureUrl: true } },
    },
  });

  // Also update the associated notification to keep it in sync on the dashboard
  try {
    const project = await prisma.project.findUnique({ where: { id: existing.projectId } });
    if (project) {
      const match = await prisma.notification.findFirst({
        where: {
          memberId: existing.memberId,
          type: 'PROJECT_UPDATED',
          title: `${existing.updateType} Update: ${project.name}`,
          message: existing.updateText.trim().slice(0, 120),
        }
      });
      if (match) {
        await prisma.notification.update({
          where: { id: match.id },
          data: {
            title: `${updated.updateType} Update: ${project.name}`,
            message: updated.updateText.trim().slice(0, 120),
          }
        });
      }
    }
  } catch (error) {
    console.error('Failed to sync notification on update edit:', error);
  }

  res.json(updated);
});

// DELETE /api/project-updates/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const existing = await prisma.projectUpdate.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError('Update not found', 404);
  
  // Delete the update
  await prisma.projectUpdate.delete({ where: { id: req.params.id } });

  // Delete the associated notification so it disappears from the dashboard feed
  try {
    const project = await prisma.project.findUnique({ where: { id: existing.projectId } });
    if (project) {
      await prisma.notification.deleteMany({
        where: {
          memberId: existing.memberId,
          type: 'PROJECT_UPDATED',
          title: `${existing.updateType} Update: ${project.name}`,
          message: existing.updateText.trim().slice(0, 120),
        }
      });
    }
  } catch (error) {
    console.error('Failed to delete associated notification:', error);
  }

  res.json({ message: 'Update deleted' });
});

export default router;
