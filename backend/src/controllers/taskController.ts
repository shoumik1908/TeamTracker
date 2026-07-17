import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

const taskInclude = {
  assignee: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  assignedBy: { select: { id: true, name: true } },
} as const;

const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().optional().nullable(),
  assigneeId: z.string().trim().min(1, 'Assignee is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  dueDate: z.union([z.string(), z.date()]).optional().nullable(),
  projectId: z.string().trim().optional().nullable(),
});

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  assigneeId: z.string().trim().min(1).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  dueDate: z.union([z.string(), z.date()]).optional().nullable(),
  projectId: z.string().trim().optional().nullable(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
});

const hasTaskManagePermission = (req: AuthRequest) => {
  const permissions = req.user?.permissions;
  return permissions?.['tasks:manage'] === true || permissions?.manageTeam === true;
};

export const getTasks = async (req: AuthRequest, res: Response) => {
  const canManage = hasTaskManagePermission(req);
  const { assigneeId, status } = req.query;

  if (canManage) {
    const where: any = {};
    if (assigneeId) {
      where.assigneeId = String(assigneeId);
    }
    if (status) {
      where.status = String(status);
    }

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    return res.json(tasks);
  }

  if (!req.user?.teamMemberId) {
    return res.json([]);
  }

  const tasks = await prisma.task.findMany({
    where: {
      assigneeId: req.user.teamMemberId,
    },
    include: taskInclude,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  });

  return res.json(tasks);
};

export const createTask = async (req: AuthRequest, res: Response) => {
  if (!hasTaskManagePermission(req)) {
    throw new AppError('Forbidden: Missing tasks:manage permission', 403);
  }

  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Invalid task payload', 400);
  }

  const { title, description, assigneeId, priority, dueDate, projectId } = parsed.data;

  const assignee = await prisma.teamMember.findUnique({ where: { id: assigneeId } });
  if (!assignee) {
    throw new AppError('Assignee not found', 404);
  }

  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new AppError('Project not found', 404);
    }
  }

  const task = await prisma.task.create({
    data: {
      title,
      description: description || null,
      priority: priority || 'MEDIUM',
      dueDate: dueDate ? new Date(dueDate) : null,
      assigneeId,
      assignedById: req.user!.id,
      projectId: projectId || null,
    },
    include: taskInclude,
  });

  await prisma.notification.create({
    data: {
      memberId: assigneeId,
      type: 'TASK_ASSIGNED',
      title: 'New task assigned',
      message: `${req.user!.name} assigned you "${title}"`,
    },
  });

  return res.status(201).json(task);
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Invalid task payload', 400);
  }

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    throw new AppError('Task not found', 404);
  }

  const canManage = hasTaskManagePermission(req);
  const canEditOwnTask = !!req.user?.teamMemberId && task.assigneeId === req.user.teamMemberId;

  if (!canManage && !canEditOwnTask) {
    throw new AppError('Forbidden', 403);
  }

  const updateData: any = {};

  if (canManage) {
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null;
    if (parsed.data.assigneeId !== undefined) updateData.assigneeId = parsed.data.assigneeId;
    if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority;
    if (parsed.data.dueDate !== undefined) updateData.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    if (parsed.data.projectId !== undefined) updateData.projectId = parsed.data.projectId || null;
  }

  if (parsed.data.status !== undefined) {
    updateData.status = parsed.data.status;
    if (parsed.data.status === 'DONE') {
      updateData.completedAt = new Date();
    } else {
      updateData.completedAt = null;
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id },
    data: updateData,
    include: taskInclude,
  });

  return res.json(updatedTask);
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  if (!hasTaskManagePermission(req)) {
    throw new AppError('Forbidden: Missing tasks:manage permission', 403);
  }

  const { id } = req.params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    throw new AppError('Task not found', 404);
  }

  await prisma.task.delete({ where: { id } });
  return res.json({ message: 'Task deleted successfully' });
};
