import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest, requirePermission } from '../middleware/auth';
import { uploadAny } from '../middleware/upload';
import { AppError } from '../middleware/errorHandler';
import { CONTAINERS, deleteFile, extractBlobName, generateSasUrl, uploadFile } from '../services/blobStorage';
import { aiProvider } from '../services/aiProvider';

const router = Router();
const tracks = ['DATABRICKS', 'FABRIC', 'FDE'] as const;
const statuses = ['BACKLOG', 'IN_PROGRESS', 'DONE'] as const;
const priorities = ['LOW', 'MEDIUM', 'HIGH'] as const;

const isTrack = (value: unknown): value is typeof tracks[number] => tracks.includes(value as typeof tracks[number]);
const isStatus = (value: unknown): value is typeof statuses[number] => statuses.includes(value as typeof statuses[number]);
const isPriority = (value: unknown): value is typeof priorities[number] => priorities.includes(value as typeof priorities[number]);
const isAdmin = (req: AuthRequest) => Boolean(req.user?.permissions?.manageTeam);
const isTicketOwner = (ticket: { createdById: string; memberId: string | null }, req: AuthRequest) =>
  ticket.createdById === req.user?.id || (!!req.user?.teamMemberId && ticket.memberId === req.user.teamMemberId);

router.use(authenticateToken);

router.get('/resources', async (req: AuthRequest, res: Response) => {
  const { track } = req.query;
  if (track && !isTrack(track)) throw new AppError('Invalid COE track', 400);

  const resources = await prisma.coeLearningResource.findMany({
    where: track ? { track: track as any } : undefined,
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ resources });
});

router.post('/resources', requirePermission('manageTeam'), uploadAny.single('file'), async (req: AuthRequest, res: Response) => {
  const { track, title, description } = req.body;
  if (!isTrack(track)) throw new AppError('Choose Databricks, Fabric, or FDE for this learning track', 400);
  if (!title?.trim()) throw new AppError('A resource title is required', 400);
  if (!req.file) throw new AppError('Attach a learning resource to upload it', 400);

  const storedFile = await uploadFile(
    CONTAINERS.COE_RESOURCES,
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype || 'application/octet-stream',
    undefined,
    undefined,
    `learning-tracks/${track.toLowerCase()}`,
  );

  const resource = await prisma.coeLearningResource.create({
    data: {
      track: track as any,
      title: title.trim(),
      description: description?.trim() || null,
      fileName: req.file.originalname,
      fileUrl: storedFile.url,
      fileMimeType: req.file.mimetype || null,
      uploadedById: req.user!.id,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
  res.status(201).json({ resource });
});

router.get('/resources/:id/download', async (req: AuthRequest, res: Response) => {
  const resource = await prisma.coeLearningResource.findUnique({ where: { id: req.params.id } });
  if (!resource) throw new AppError('Learning resource not found', 404);

  const downloadUrl = generateSasUrl({
    containerName: CONTAINERS.COE_RESOURCES,
    blobName: extractBlobName(resource.fileUrl),
    permissions: 'r',
    expiryMinutes: 30,
  });
  res.json({ downloadUrl, fileName: resource.fileName });
});

router.delete('/resources/:id', requirePermission('manageTeam'), async (req: AuthRequest, res: Response) => {
  const resource = await prisma.coeLearningResource.findUnique({ where: { id: req.params.id } });
  if (!resource) throw new AppError('Learning resource not found', 404);

  await deleteFile(CONTAINERS.COE_RESOURCES, extractBlobName(resource.fileUrl));
  await prisma.coeLearningResource.delete({ where: { id: resource.id } });
  res.json({ message: 'Learning resource deleted' });
});

router.get('/tickets', async (req: AuthRequest, res: Response) => {
  const { track, status } = req.query;
  if (track && !isTrack(track)) throw new AppError('Invalid COE track', 400);
  if (status && !isStatus(status)) throw new AppError('Invalid ticket status', 400);

  const tickets = await prisma.coeTicket.findMany({
    where: {
      ...(!isAdmin(req) ? {
        OR: [
          { createdById: req.user!.id },
          ...(req.user!.teamMemberId ? [{ memberId: req.user!.teamMemberId }] : []),
        ],
      } : {}),
      ...(track ? { track: track as any } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      createdBy: { select: { id: true, name: true, teamMemberId: true } },
      member: { select: { id: true, name: true, designation: true, profilePictureUrl: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ tickets });
});

router.post('/tickets', async (req: AuthRequest, res: Response) => {
  const { track, title, description, priority, memberId } = req.body;
  if (!isTrack(track)) throw new AppError('Choose Databricks, Fabric, or FDE for this ticket', 400);
  if (!title?.trim()) throw new AppError('A ticket title is required', 400);
  if (priority && !isPriority(priority)) throw new AppError('Invalid ticket priority', 400);

  // Members can create tickets for themselves only. Admins may create one for any member.
  const assignedMemberId = isAdmin(req) ? (memberId || req.user!.teamMemberId) : req.user!.teamMemberId;
  if (assignedMemberId) {
    const memberExists = await prisma.teamMember.findUnique({ where: { id: assignedMemberId }, select: { id: true } });
    if (!memberExists) throw new AppError('Assigned team member was not found', 404);
  }

  const ticket = await prisma.coeTicket.create({
    data: {
      track: track as any,
      title: title.trim(),
      description: description?.trim() || null,
      priority: (priority || 'MEDIUM') as any,
      status: 'IN_PROGRESS',
      createdById: req.user!.id,
      memberId: assignedMemberId || null,
    },
    include: {
      createdBy: { select: { id: true, name: true, teamMemberId: true } },
      member: { select: { id: true, name: true, designation: true, profilePictureUrl: true } },
    },
  });
  res.status(201).json({ ticket });
});

router.patch('/tickets/:id', async (req: AuthRequest, res: Response) => {
  const ticket = await prisma.coeTicket.findUnique({ where: { id: req.params.id } });
  if (!ticket) throw new AppError('COE ticket not found', 404);
  if (!isAdmin(req) && !isTicketOwner(ticket, req)) throw new AppError('You can only update your own learning tickets', 403);

  const { track, title, description, priority, status, memberId } = req.body;
  if (track !== undefined && !isTrack(track)) throw new AppError('Invalid COE track', 400);
  if (priority !== undefined && !isPriority(priority)) throw new AppError('Invalid ticket priority', 400);
  if (status !== undefined && !isStatus(status)) throw new AppError('Invalid ticket status', 400);
  if (title !== undefined && !title.trim()) throw new AppError('A ticket title is required', 400);

  const data: Record<string, unknown> = {};
  if (track !== undefined) data.track = track;
  if (title !== undefined) data.title = title.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (priority !== undefined) data.priority = priority;
  if (status !== undefined) data.status = status;
  if (isAdmin(req) && memberId !== undefined) data.memberId = memberId || null;

  const updatedTicket = await prisma.coeTicket.update({
    where: { id: ticket.id },
    data: data as any,
    include: {
      createdBy: { select: { id: true, name: true, teamMemberId: true } },
      member: { select: { id: true, name: true, designation: true, profilePictureUrl: true } },
    },
  });
  res.json({ ticket: updatedTicket });
});

router.delete('/tickets/:id', async (req: AuthRequest, res: Response) => {
  const ticket = await prisma.coeTicket.findUnique({ where: { id: req.params.id } });
  if (!ticket) throw new AppError('COE ticket not found', 404);
  if (!isAdmin(req) && !isTicketOwner(ticket, req)) throw new AppError('You can only delete your own learning tickets', 403);

  await prisma.coeTicket.delete({ where: { id: ticket.id } });
  res.json({ message: 'COE ticket deleted' });
});

// ============ LEARNING PROJECTS ============
const learningProjectInclude = {
  createdBy: { select: { id: true, name: true } },
  members: { include: { member: { select: { id: true, name: true, designation: true } } }, orderBy: { addedAt: 'asc' as const } },
  milestones: { include: { updates: { include: { createdBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' as const } } }, orderBy: { createdAt: 'asc' as const } },
  assets: { orderBy: { createdAt: 'desc' as const } },
};

async function findLearningProject(id: string, req: AuthRequest) {
  const project = await prisma.learningProject.findUnique({ where: { id }, include: learningProjectInclude });
  if (!project) throw new AppError('Learning project not found', 404);
  const isMember = project.members.some(item => item.memberId === req.user?.teamMemberId);
  if (!isAdmin(req) && project.createdById !== req.user?.id && !isMember) throw new AppError('You do not have access to this learning project', 403);
  return project;
}

router.get('/learning-projects', async (req: AuthRequest, res: Response) => {
  const where = isAdmin(req) ? {} : {
    OR: [
      { createdById: req.user!.id },
      ...(req.user?.teamMemberId ? [{ members: { some: { memberId: req.user.teamMemberId } } }] : []),
    ],
  };
  const projects = await prisma.learningProject.findMany({ where, include: learningProjectInclude, orderBy: { updatedAt: 'desc' } });
  res.json({ projects });
});

router.post('/learning-projects', async (req: AuthRequest, res: Response) => {
  const { title, description, memberIds = [] } = req.body;
  if (!title?.trim()) throw new AppError('A learning project title is required', 400);
  if (!Array.isArray(memberIds)) throw new AppError('Teammates must be a list', 400);
  const ids = [...new Set(memberIds.filter((id: unknown) => typeof id === 'string' && id))];
  if (ids.length && await prisma.teamMember.count({ where: { id: { in: ids } } }) !== ids.length) throw new AppError('One or more teammates were not found', 404);
  const project = await prisma.learningProject.create({
    data: { title: title.trim(), description: description?.trim() || null, createdById: req.user!.id, members: ids.length ? { createMany: { data: ids.map(memberId => ({ memberId })) } } : undefined },
    include: learningProjectInclude,
  });
  res.status(201).json({ project });
});

router.patch('/learning-projects/:id', async (req: AuthRequest, res: Response) => {
  const project = await findLearningProject(req.params.id, req);
  const { title, description } = req.body;
  if (title !== undefined && !title?.trim()) throw new AppError('A learning project title is required', 400);
  const updated = await prisma.learningProject.update({ where: { id: project.id }, data: { ...(title !== undefined && { title: title.trim() }), ...(description !== undefined && { description: description?.trim() || null }) }, include: learningProjectInclude });
  res.json({ project: updated });
});

router.delete('/learning-projects/:id', async (req: AuthRequest, res: Response) => {
  const project = await findLearningProject(req.params.id, req);
  if (!isAdmin(req)) throw new AppError('Only administrators can delete learning projects', 403);
  await prisma.learningProject.delete({ where: { id: project.id } });
  res.json({ message: 'Learning project deleted' });
});

router.post('/learning-projects/:id/members', async (req: AuthRequest, res: Response) => {
  const project = await findLearningProject(req.params.id, req);
  const { memberId } = req.body;
  if (!memberId || !await prisma.teamMember.findUnique({ where: { id: memberId }, select: { id: true } })) throw new AppError('Teammate not found', 404);
  await prisma.learningProjectMember.upsert({ where: { projectId_memberId: { projectId: project.id, memberId } }, create: { projectId: project.id, memberId }, update: {} });
  res.status(201).json({ message: 'Teammate added' });
});

router.delete('/learning-projects/:id/members/:memberId', async (req: AuthRequest, res: Response) => {
  const project = await findLearningProject(req.params.id, req);
  await prisma.learningProjectMember.deleteMany({ where: { projectId: project.id, memberId: req.params.memberId } });
  res.json({ message: 'Teammate removed' });
});

router.post('/learning-projects/:id/milestones', async (req: AuthRequest, res: Response) => {
  const project = await findLearningProject(req.params.id, req);
  const { title, description } = req.body;
  if (!title?.trim()) throw new AppError('A milestone title is required', 400);
  const milestone = await prisma.learningProjectMilestone.create({ data: { projectId: project.id, title: title.trim(), description: description?.trim() || null } });
  res.status(201).json({ milestone });
});

router.patch('/learning-projects/:id/milestones/:milestoneId', async (req: AuthRequest, res: Response) => {
  const project = await findLearningProject(req.params.id, req);
  const milestone = await prisma.learningProjectMilestone.findFirst({ where: { id: req.params.milestoneId, projectId: project.id } });
  if (!milestone) throw new AppError('Milestone not found', 404);
  const { title, description, completed } = req.body;
  if (title !== undefined && !title?.trim()) throw new AppError('A milestone title is required', 400);
  const updated = await prisma.learningProjectMilestone.update({ where: { id: milestone.id }, data: { ...(title !== undefined && { title: title.trim() }), ...(description !== undefined && { description: description?.trim() || null }), ...(completed !== undefined && { completed: Boolean(completed), completedAt: completed ? new Date() : null }) } });
  res.json({ milestone: updated });
});

router.delete('/learning-projects/:id/milestones/:milestoneId', async (req: AuthRequest, res: Response) => {
  const project = await findLearningProject(req.params.id, req);
  await prisma.learningProjectMilestone.deleteMany({ where: { id: req.params.milestoneId, projectId: project.id } });
  res.json({ message: 'Milestone removed' });
});

router.post('/learning-projects/:id/milestones/:milestoneId/updates', async (req: AuthRequest, res: Response) => {
  const project = await findLearningProject(req.params.id, req);
  if (!req.body.body?.trim()) throw new AppError('An update is required', 400);
  const milestone = await prisma.learningProjectMilestone.findFirst({ where: { id: req.params.milestoneId, projectId: project.id }, select: { id: true } });
  if (!milestone) throw new AppError('Milestone not found', 404);
  const update = await prisma.learningProjectMilestoneUpdate.create({ data: { milestoneId: milestone.id, body: req.body.body.trim(), createdById: req.user!.id } });
  res.status(201).json({ update });
});

router.post('/learning-projects/:id/assets/link', async (req: AuthRequest, res: Response) => {
  const project = await findLearningProject(req.params.id, req);
  const { label, url } = req.body;
  if (!label?.trim() || !url?.trim()) throw new AppError('A link and label are required', 400);
  try { new URL(url); } catch { throw new AppError('Enter a valid project link', 400); }
  const asset = await prisma.learningProjectAsset.create({ data: { projectId: project.id, kind: 'LINK', label: label.trim(), url: url.trim(), uploadedById: req.user!.id } });
  res.status(201).json({ asset });
});

router.post('/learning-projects/:id/assets/file', uploadAny.single('file'), async (req: AuthRequest, res: Response) => {
  const project = await findLearningProject(req.params.id, req);
  if (!req.file) throw new AppError('Choose a file to upload', 400);
  const uploaded = await uploadFile(CONTAINERS.LEARNING_PROJECTS, req.file.buffer, req.file.originalname, req.file.mimetype || 'application/octet-stream', undefined, undefined, `learning-projects/${project.id}`);
  const asset = await prisma.learningProjectAsset.create({ data: { projectId: project.id, kind: 'FILE', label: req.file.originalname, fileUrl: uploaded.url, fileName: req.file.originalname, mimeType: req.file.mimetype || null, uploadedById: req.user!.id } });
  res.status(201).json({ asset });
});

router.get('/learning-projects/:id/assets/:assetId/download', async (req: AuthRequest, res: Response) => {
  const project = await findLearningProject(req.params.id, req);
  const asset = await prisma.learningProjectAsset.findFirst({ where: { id: req.params.assetId, projectId: project.id } });
  if (!asset?.fileUrl) throw new AppError('Uploaded file not found', 404);
  res.json({ downloadUrl: generateSasUrl({ containerName: CONTAINERS.LEARNING_PROJECTS, blobName: extractBlobName(asset.fileUrl), permissions: 'r', expiryMinutes: 30 }), fileName: asset.fileName });
});

router.delete('/learning-projects/:id/assets/:assetId', async (req: AuthRequest, res: Response) => {
  const project = await findLearningProject(req.params.id, req);
  const asset = await prisma.learningProjectAsset.findFirst({ where: { id: req.params.assetId, projectId: project.id } });
  if (!asset) throw new AppError('Project asset not found', 404);
  if (asset.fileUrl) await deleteFile(CONTAINERS.LEARNING_PROJECTS, extractBlobName(asset.fileUrl));
  await prisma.learningProjectAsset.delete({ where: { id: asset.id } });
  res.json({ message: 'Project asset removed' });
});

const sessionInclude = {
  organizer: { select: { id: true, name: true, teamMemberId: true } },
  attendance: { include: { member: { select: { id: true, name: true, designation: true, profilePictureUrl: true } } }, orderBy: { member: { name: 'asc' as const } } },
};

const canManageSession = (session: { organizerId: string }, req: AuthRequest) => isAdmin(req) || session.organizerId === req.user?.id;
const parseSessionDate = (value: unknown) => {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new AppError('Choose a valid session date and time', 400);
  return date;
};

async function notifySessionScheduled(session: { id: string; topic: string; scheduledAt: Date; organizer: { name: string } }) {
  const members = await prisma.teamMember.findMany({ select: { id: true } });
  const when = session.scheduledAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
  await prisma.notification.createMany({ data: [
    ...members.map(member => ({
      memberId: member.id, type: 'COE_SESSION_SCHEDULED' as any,
      title: `Knowledge sharing: ${session.topic}`,
      message: `${session.organizer.name} scheduled a session for ${when}.`,
    })),
    { targetRole: 'Admin', type: 'COE_SESSION_SCHEDULED' as any, title: `Knowledge sharing: ${session.topic}`, message: `${session.organizer.name} scheduled a session for ${when}.` },
  ] });
}

function extractTranscriptText(buffer: Buffer, originalName: string, mimeType: string): Promise<string> {
  if (mimeType === 'text/plain' || originalName.toLowerCase().endsWith('.txt')) return Promise.resolve(buffer.toString('utf8'));
  if (mimeType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf')) {
    return (async () => {
      try { const { PDFParse } = require('pdf-parse'); const result = await PDFParse(buffer); return result.text || ''; } catch { return ''; }
    })();
  }
  if (mimeType.includes('wordprocessingml') || /\.docx?$/i.test(originalName)) {
    return (async () => {
      try { const mammoth = require('mammoth'); const result = await mammoth.extractRawText({ buffer }); return result.value || ''; } catch { return ''; }
    })();
  }
  return Promise.resolve('');
}

// Knowledge-sharing sessions are open to every authenticated user.
router.get('/sessions', async (_req: AuthRequest, res: Response) => {
  const sessions = await prisma.coeKnowledgeSession.findMany({ include: sessionInclude, orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }] });
  res.json({ sessions });
});

router.post('/sessions', async (req: AuthRequest, res: Response) => {
  const { topic, description, scheduledAt, durationMinutes } = req.body;
  if (!topic?.trim()) throw new AppError('A session topic is required', 400);
  const date = parseSessionDate(scheduledAt);
  const duration = Number(durationMinutes || 60);
  if (!Number.isInteger(duration) || duration < 15 || duration > 480) throw new AppError('Session duration must be between 15 and 480 minutes', 400);

  const members = await prisma.teamMember.findMany({ select: { id: true } });
  const session = await prisma.coeKnowledgeSession.create({
    data: {
      topic: topic.trim(), description: description?.trim() || null, scheduledAt: date, durationMinutes: duration, organizerId: req.user!.id,
      attendance: { createMany: { data: members.map(member => ({ memberId: member.id, attended: member.id === req.user!.teamMemberId })) } },
    },
    include: sessionInclude,
  });
  await notifySessionScheduled(session);
  res.status(201).json({ session });
});

router.patch('/sessions/:id/reschedule', async (req: AuthRequest, res: Response) => {
  const existing = await prisma.coeKnowledgeSession.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError('Knowledge-sharing session not found', 404);
  if (!canManageSession(existing, req)) throw new AppError('Only the organiser or an admin can reschedule this session', 403);
  const date = parseSessionDate(req.body.scheduledAt);
  const duration = req.body.durationMinutes === undefined ? existing.durationMinutes : Number(req.body.durationMinutes);
  if (!Number.isInteger(duration) || duration < 15 || duration > 480) throw new AppError('Session duration must be between 15 and 480 minutes', 400);

  const session = await prisma.coeKnowledgeSession.update({ where: { id: existing.id }, data: { scheduledAt: date, durationMinutes: duration, status: 'SCHEDULED', endedAt: null, dayReminderSentAt: null, thirtyMinuteReminderSentAt: null }, include: sessionInclude });
  await notifySessionScheduled(session);
  res.json({ session });
});

router.post('/sessions/:id/end', async (req: AuthRequest, res: Response) => {
  const existing = await prisma.coeKnowledgeSession.findUnique({ where: { id: req.params.id }, include: { attendance: true } });
  if (!existing) throw new AppError('Knowledge-sharing session not found', 404);
  if (!canManageSession(existing, req)) throw new AppError('Only the organiser or an admin can end this session', 403);
  const attendance = Array.isArray(req.body.attendance) ? req.body.attendance : [];
  const memberIds = new Set(existing.attendance.map(record => record.memberId));
  for (const entry of attendance) {
    if (!memberIds.has(entry.memberId)) continue;
    await prisma.coeSessionAttendance.update({ where: { sessionId_memberId: { sessionId: existing.id, memberId: entry.memberId } }, data: { attended: Boolean(entry.attended), notes: entry.notes?.trim() || null } });
  }
  const session = await prisma.coeKnowledgeSession.update({ where: { id: existing.id }, data: { status: 'ENDED', endedAt: new Date(), attendanceSummary: req.body.attendanceSummary?.trim() || null }, include: sessionInclude });
  const absentees = session.attendance.filter(record => !record.attended).map(record => record.member.name);
  if (absentees.length) await prisma.notification.create({ data: { targetRole: 'Admin', type: 'COE_SESSION_ABSENCE_REPORTED' as any, title: `Attendance follow-up: ${session.topic}`, message: `Absent: ${absentees.join(', ')}`.slice(0, 1000) } });
  res.json({ session, absentCount: absentees.length });
});

router.post('/sessions/:id/transcript', uploadAny.single('file'), async (req: AuthRequest, res: Response) => {
  const session = await prisma.coeKnowledgeSession.findUnique({ where: { id: req.params.id } });
  if (!session) throw new AppError('Knowledge-sharing session not found', 404);
  if (!canManageSession(session, req)) throw new AppError('Only the organiser or an admin can upload a transcript', 403);
  if (!req.file) throw new AppError('Choose a transcript file to upload', 400);
  const uploaded = await uploadFile(CONTAINERS.COE_TRANSCRIPTS, req.file.buffer, req.file.originalname, req.file.mimetype || 'application/octet-stream', undefined, undefined, `knowledge-sessions/${session.id}`);
  const transcriptText = await extractTranscriptText(req.file.buffer, req.file.originalname, req.file.mimetype);
  const updated = await prisma.coeKnowledgeSession.update({ where: { id: session.id }, data: { transcriptFileName: req.file.originalname, transcriptFileUrl: uploaded.url, transcriptMimeType: req.file.mimetype || null, transcriptText: transcriptText || null, transcriptSummary: null }, include: sessionInclude });
  res.json({ session: updated, textExtracted: Boolean(transcriptText) });
});

router.get('/sessions/:id/transcript/download', async (_req: AuthRequest, res: Response) => {
  const session = await prisma.coeKnowledgeSession.findUnique({ where: { id: _req.params.id } });
  if (!session?.transcriptFileUrl) throw new AppError('Transcript not found', 404);
  res.json({ downloadUrl: generateSasUrl({ containerName: CONTAINERS.COE_TRANSCRIPTS, blobName: extractBlobName(session.transcriptFileUrl), permissions: 'r', expiryMinutes: 30 }), fileName: session.transcriptFileName });
});

router.post('/sessions/:id/transcript/summarize', async (_req: AuthRequest, res: Response) => {
  const session = await prisma.coeKnowledgeSession.findUnique({ where: { id: _req.params.id } });
  if (!session) throw new AppError('Knowledge-sharing session not found', 404);
  if (!session.transcriptText?.trim()) throw new AppError('This transcript format cannot be summarised. Upload a text, PDF, or DOCX transcript.', 422);
  const response = await aiProvider.chat([{ role: 'system', content: 'Summarise this knowledge-sharing session accurately. Use concise headings: Overview, Key takeaways, Decisions, and Follow-ups. Do not invent details.' }, { role: 'user', content: session.transcriptText.slice(0, 30000) }], { temperature: 0.2, maxTokens: 800 });
  const updated = await prisma.coeKnowledgeSession.update({ where: { id: session.id }, data: { transcriptSummary: response.content }, include: sessionInclude });
  res.json({ session: updated });
});

export default router;
