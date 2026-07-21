import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendMail } from '../services/mailService';
import { taskAssignedTemplate } from '../templates/taskAssigned';

const prisma = new PrismaClient();

const taskInclude = {
  assignments: {
    include: { member: { select: { id: true, name: true } } },
  },
  project: { select: { id: true, name: true } },
  assignedBy: { select: { id: true, name: true } },
  onBehalfOf: { select: { id: true, name: true } },
  feedbacks: {
    select: { id: true, assigneeId: true, feedbackText: true, rating: true, submittedAt: true },
  },
} as const;

const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().optional().nullable(),
  assigneeIds: z.array(z.string().trim().min(1)).min(1, 'At least one assignee is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  dueDate: z.union([z.string(), z.date()]).optional().nullable(),
  projectId: z.string().trim().optional().nullable(),
  onBehalfOfId: z.string().trim().optional().nullable(),
});

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
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
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const canManage = hasTaskManagePermission(req);
  const { status } = req.query;

  if (canManage) {
    const where: any = {};
    if (status) where.status = String(status);

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    return res.json(tasks);
  }

  // Member sees:
  // 1. Tasks assigned to them
  // 2. Tasks they created (assigned by their user account)
  // 3. Tasks assigned on behalf of them
  const teamMemberId = req.user.teamMemberId || '';
  const orClauses: any[] = [
    { assignments: { some: { memberId: teamMemberId } } },
    { assignedById: req.user.id },
    { onBehalfOfId: teamMemberId },
  ];

  const tasks = await prisma.task.findMany({
    where: {
      OR: orClauses,
      ...(status ? { status: String(status) as any } : {}),
    },
    include: taskInclude,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  });

  return res.json(tasks);
};

export const createTask = async (req: AuthRequest, res: Response) => {
  // Now team members can create tasks too
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Invalid task payload', 400);
  }

  const { title, description, assigneeIds, priority, dueDate, projectId, onBehalfOfId } = parsed.data;

  // Validate all assignees exist
  const members = await prisma.teamMember.findMany({ where: { id: { in: assigneeIds } } });
  if (members.length !== assigneeIds.length) {
    throw new AppError('One or more assignees not found', 404);
  }

  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
  }

  // Build the full set of member IDs to assign.
  // The "on behalf of" person gets a TODO assignment too so the task appears in their board.
  const allAssigneeIds = onBehalfOfId && !assigneeIds.includes(onBehalfOfId)
    ? [...assigneeIds, onBehalfOfId]
    : assigneeIds;

  const task = await prisma.task.create({
    data: {
      title,
      description: description || null,
      priority: priority || 'MEDIUM',
      dueDate: dueDate ? new Date(dueDate as string) : null,
      assignedById: req.user!.id,
      projectId: projectId || null,
      onBehalfOfId: onBehalfOfId || null,
      assignments: {
        create: allAssigneeIds.map((memberId) => ({ memberId })),
      },
    },
    include: taskInclude,
  });

  // Fetch the "on behalf of" member's name if set, for use in notifications & emails
  let onBehalfOfName: string | null = null;
  if (onBehalfOfId) {
    const onBehalfMember = await prisma.teamMember.findUnique({
      where: { id: onBehalfOfId },
      select: { name: true },
    });
    onBehalfOfName = onBehalfMember?.name ?? null;
  }

  // Compose notification message — credit the on-behalf-of person if present
  const notificationMessage = onBehalfOfName
    ? `${onBehalfOfName} (via ${req.user!.name}) assigned you "${title}"`
    : `${req.user!.name} assigned you "${title}"`;

  // Notify all assignees (including the on-behalf-of person) via in-app notification
  await prisma.notification.createMany({
    data: allAssigneeIds.map((memberId) => ({
      memberId,
      type: 'TASK_ASSIGNED',
      title: 'New task assigned',
      message: notificationMessage,
    })),
  });

  // Send email only to the actual assignees — NOT the on-behalf-of person
  // (they see the task on their board but don't need an assignment email).
  const membersWithEmail = await prisma.teamMember.findMany({
    where: { id: { in: assigneeIds } },
    select: { id: true, name: true, email: true },
  });

  for (const member of membersWithEmail) {
    if (!member.email) {
      console.warn(`[MailService] ⚠️  Skipping email for member "${member.name}" (no email on file) [taskId=${task.id}]`);
      continue;
    }
    // Intentionally NOT awaited — email failure must never affect the API response.
    sendMail({
      to: member.email,
      subject: onBehalfOfName
        ? `New task from ${onBehalfOfName}: ${title}`
        : `New task assigned: ${title}`,
      html: taskAssignedTemplate({
        memberName: member.name,
        taskTitle: title,
        taskId: task.id,
        dueDate: task.dueDate?.toISOString() ?? null,
        assignedByName: req.user!.name,
        onBehalfOfName,          // shown in email body when present
      }),
      taskId: task.id,
    });
  }

  return res.status(201).json(task);
};

export const getTask = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      ...taskInclude,
      feedbacks: {
        include: { assignee: { select: { id: true, name: true, profilePictureUrl: true } } },
        orderBy: { submittedAt: 'desc' },
      },
    },
  });
  if (!task) throw new AppError('Task not found', 404);

  const canManage = hasTaskManagePermission(req);
  const isMemberAssigned = req.user?.teamMemberId
    ? task.assignments.some((a) => a.memberId === req.user!.teamMemberId)
    : false;

  if (!canManage && !isMemberAssigned) throw new AppError('Forbidden', 403);

  return res.json(task);
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Invalid task payload', 400);
  }

  const task = await prisma.task.findUnique({
    where: { id },
    include: { assignments: true, feedbacks: true },
  });
  if (!task) throw new AppError('Task not found', 404);

  const canManage = hasTaskManagePermission(req);
  const isMemberAssigned = !!req.user?.teamMemberId &&
    task.assignments.some((a) => a.memberId === req.user!.teamMemberId);

  if (!canManage && !isMemberAssigned) throw new AppError('Forbidden', 403);

  const updateData: any = {};

  if (canManage) {
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null;
    if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority;
    if (parsed.data.dueDate !== undefined) updateData.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate as string) : null;
    if (parsed.data.projectId !== undefined) updateData.projectId = parsed.data.projectId || null;
  }

  if (parsed.data.status !== undefined) {
    if (canManage) {
      updateData.status = parsed.data.status;
      if (parsed.data.status === 'DONE') updateData.completedAt = new Date();
      else updateData.completedAt = null;
      
      // Admin force-updates all assignments to keep them in sync
      await prisma.taskAssignment.updateMany({
        where: { taskId: id },
        data: { status: parsed.data.status }
      });
    } else {
      const memberId = req.user?.teamMemberId;
      if (memberId) {
        if (parsed.data.status === 'DONE') {
          const feedback = await prisma.taskFeedback.findUnique({
            where: { taskId_assigneeId: { taskId: id, assigneeId: memberId } },
          });
          if (!feedback) throw new AppError('Submit feedback before marking this task as Done', 422);
        }
        
        // Update member's assignment status
        await prisma.taskAssignment.update({
          where: { taskId_memberId: { taskId: id, memberId } },
          data: { status: parsed.data.status }
        });

        // Re-evaluate aggregate Task status
        const allAssignments = await prisma.taskAssignment.findMany({ where: { taskId: id } });
        const allDone = allAssignments.every(a => a.status === 'DONE');
        const allStarted = allAssignments.every(a => a.status === 'IN_PROGRESS' || a.status === 'DONE');

        if (allDone) {
          updateData.status = 'DONE';
          updateData.completedAt = new Date();
        } else if (allStarted) {
          updateData.status = 'IN_PROGRESS';
          updateData.completedAt = null;
        } else {
          updateData.status = 'TODO';
          updateData.completedAt = null;
        }
      }
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
  if (!task) throw new AppError('Task not found', 404);

  await prisma.task.delete({ where: { id } });
  return res.json({ message: 'Task deleted successfully' });
};
