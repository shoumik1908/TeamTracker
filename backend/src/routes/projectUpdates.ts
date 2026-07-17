import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// GET /api/project-updates
router.get('/', async (req: Request, res: Response) => {
  const { projectId, opportunityId, limit = '50' } = req.query;

  const where: any = {};
  if (projectId) where.projectId = projectId as string;
  if (opportunityId) where.opportunityId = opportunityId as string;

  // RBAC: Only show updates for projects the user is assigned to (unless admin)
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) {
    where.project = {
      members: {
        some: { memberId: user?.teamMemberId }
      }
    };
  }

  const updates = await prisma.projectUpdate.findMany({
    where,
    take: parseInt(limit as string),
    orderBy: { createdAt: 'desc' },
    include: {
      project: { select: { id: true, name: true, status: true } },
      opportunity: { select: { id: true, name: true } },
      member: { select: { id: true, name: true, designation: true, profilePictureUrl: true } },
    },
  });

  res.json({ data: updates, total: updates.length });
});

// POST /api/project-updates
router.post('/', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const { projectId, opportunityId, updateText, updateType, progressValue } = req.body;
  const memberId = user?.permissions?.manageTeam ? req.body.memberId || user?.teamMemberId : user?.teamMemberId;

  if (!projectId && !opportunityId) throw new AppError('projectId or opportunityId is required', 400);
  if (!memberId) throw new AppError('memberId is required (User is not linked to a team member profile)', 400);
  if (!updateText?.trim()) throw new AppError('updateText is required', 400);
  if (!updateType) throw new AppError('updateType is required', 400);

  const update = await prisma.projectUpdate.create({
    data: {
      projectId: projectId || null,
      opportunityId: opportunityId || null,
      memberId,
      updateText: updateText.trim(),
      updateType,
      progressValue: progressValue !== undefined ? parseInt(progressValue) : null,
    },
    include: {
      project: { select: { id: true, name: true, status: true } },
      opportunity: { select: { id: true, name: true } },
      member: { select: { id: true, name: true, designation: true, profilePictureUrl: true } },
    },
  });

  const contextName = update.project ? update.project.name : (update.opportunity ? update.opportunity.name : 'Unknown');

  // Fire a notification so admins see it in the Notifications feed
  await prisma.notification.create({
    data: {
      targetRole: 'Admin',
      type: 'PROJECT_UPDATED',
      title: `${updateType} Update: ${contextName}`,
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

  // RBAC: Users can only update their own updates
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam && existing.memberId !== user?.teamMemberId) {
    throw new AppError('Forbidden: You can only edit your own updates', 403);
  }

  const updated = await prisma.projectUpdate.update({
    where: { id: req.params.id },
    data: {
      ...(updateText?.trim() && { updateText: updateText.trim() }),
      ...(updateType && { updateType }),
    },
    include: {
      project: { select: { id: true, name: true, status: true } },
      opportunity: { select: { id: true, name: true } },
      member: { select: { id: true, name: true, designation: true, profilePictureUrl: true } },
    },
  });

  // Also update the associated notification to keep it in sync on the dashboard
  try {
    let contextName = 'Unknown';
    if (existing.projectId) {
      const project = await prisma.project.findUnique({ where: { id: existing.projectId } });
      if (project) contextName = project.name;
    } else if (existing.opportunityId) {
      const opp = await prisma.preSalesOpportunity.findUnique({ where: { id: existing.opportunityId } });
      if (opp) contextName = opp.name;
    }

    const match = await prisma.notification.findFirst({
      where: {
        targetRole: 'Admin',
        type: 'PROJECT_UPDATED',
        title: `${existing.updateType} Update: ${contextName}`,
        message: existing.updateText.trim().slice(0, 120),
      }
    });
    if (match) {
      await prisma.notification.update({
        where: { id: match.id },
        data: {
          title: `${updated.updateType} Update: ${contextName}`,
          message: updated.updateText.trim().slice(0, 120),
        }
      });
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
  
  // RBAC: Users can only delete their own updates
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam && existing.memberId !== user?.teamMemberId) {
    throw new AppError('Forbidden: You can only delete your own updates', 403);
  }

  // Delete the update
  await prisma.projectUpdate.delete({ where: { id: req.params.id } });

  // Delete the associated notification so it disappears from the dashboard feed
  try {
    let contextName = 'Unknown';
    if (existing.projectId) {
      const project = await prisma.project.findUnique({ where: { id: existing.projectId } });
      if (project) contextName = project.name;
    } else if (existing.opportunityId) {
      const opp = await prisma.preSalesOpportunity.findUnique({ where: { id: existing.opportunityId } });
      if (opp) contextName = opp.name;
    }

    await prisma.notification.deleteMany({
      where: {
        memberId: existing.memberId,
        type: 'PROJECT_UPDATED',
        title: `${existing.updateType} Update: ${contextName}`,
        message: existing.updateText.trim().slice(0, 120),
      }
    });
  } catch (error) {
    console.error('Failed to delete associated notification:', error);
  }

  res.json({ message: 'Update deleted' });
});

export default router;
