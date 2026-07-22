import prisma from '../lib/prisma';
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { uploadAny } from '../middleware/upload';
import { CONTAINERS, uploadFile } from '../services/blobStorage';
import crypto from 'crypto';

const router = Router({ mergeParams: true });

router.use(authenticateToken);

const feedbackSchema = z.object({
  feedbackText: z.string().trim().min(1, 'Feedback is required'),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
});

// POST /api/tasks/:id/feedback
router.post('/', uploadAny.array('files', 10), async (req: AuthRequest, res: Response) => {
  const { id: taskId } = req.params;
  const memberId = req.user?.teamMemberId;
  if (!memberId) throw new AppError('You must be a team member to submit feedback', 403);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignments: true, feedbacks: true },
  });
  if (!task) throw new AppError('Task not found', 404);

  // Verify this member is assigned to the task
  const isAssigned = task.assignments.some((a) => a.memberId === memberId);
  if (!isAssigned) throw new AppError('You are not assigned to this task', 403);

  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Invalid input', 400);

  let uploadedAttachments: { url: string; name: string }[] = [];

  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    uploadedAttachments = await Promise.all(
      req.files.map(async (f) => {
        const uploadResult = await uploadFile(
          CONTAINERS.TASK_FILES,
          f.buffer,
          f.originalname,
          f.mimetype,
          undefined,
          undefined,
          `task-${task.taskNumber}`
        );
        return {
          url: uploadResult.url,
          name: f.originalname,
        };
      })
    );
  }

  // Get existing feedback to append attachments if updating
  const existingFeedback = task.feedbacks.find(f => f.assigneeId === memberId);
  const existingAttachments = Array.isArray(existingFeedback?.attachments) ? existingFeedback.attachments : [];
  const finalAttachments = [...existingAttachments, ...uploadedAttachments];

  const feedback = await prisma.taskFeedback.upsert({
    where: { taskId_assigneeId: { taskId, assigneeId: memberId } },
    create: { 
      taskId, 
      assigneeId: memberId, 
      feedbackText: parsed.data.feedbackText, 
      rating: parsed.data.rating ?? null,
      attachments: finalAttachments
    },
    update: { 
      feedbackText: parsed.data.feedbackText, 
      rating: parsed.data.rating ?? null, 
      submittedAt: new Date(),
      attachments: finalAttachments
    },
    include: { assignee: { select: { id: true, name: true } } },
  });

  // Update this member's assignment status to DONE
  await prisma.taskAssignment.update({
    where: { taskId_memberId: { taskId, memberId } },
    data: { status: 'DONE' }
  });

  // Check if ALL assignees have now submitted feedback → auto-move to DONE
  const totalAssignees = task.assignments.length;
  // Count feedbacks after this upsert (existing + this one)
  const existingFeedbackIds = new Set(task.feedbacks.map((f) => f.assigneeId));
  existingFeedbackIds.add(memberId);
  const feedbackCount = existingFeedbackIds.size;

  // Re-evaluate aggregate Task status
  const allAssignments = await prisma.taskAssignment.findMany({ where: { taskId } });
  const allDone = allAssignments.every(a => a.status === 'DONE');
  const allStarted = allAssignments.every(a => a.status === 'IN_PROGRESS' || a.status === 'DONE');

  if (allDone) {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'DONE', completedAt: new Date() },
    });
  } else if (allStarted) {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'IN_PROGRESS', completedAt: null },
    });
  }

  return res.status(201).json({ data: feedback, allSubmitted: feedbackCount >= totalAssignees });
});

// GET /api/tasks/:id/feedback — admin sees all feedbacks
router.get('/', async (req: AuthRequest, res: Response) => {
  const isAdmin = req.user?.permissions?.manageTeam === true || req.user?.permissions?.['tasks:manage'] === true;
  if (!isAdmin) throw new AppError('Forbidden', 403);

  const { id: taskId } = req.params;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignments: { include: { member: { select: { id: true, name: true, profilePictureUrl: true } } } } },
  });
  if (!task) throw new AppError('Task not found', 404);

  const feedbacks = await prisma.taskFeedback.findMany({
    where: { taskId },
    include: { assignee: { select: { id: true, name: true, profilePictureUrl: true } } },
    orderBy: { submittedAt: 'desc' },
  });

  return res.json({ data: feedbacks, task: { id: task.id, title: task.title, status: task.status }, assignments: task.assignments });
});

export default router;
