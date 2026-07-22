import { Router, Request, Response } from 'express';
import { PrismaClient, ProjectStatus, Priority } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest, requirePermission } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// GET /api/projects
router.get('/', async (req: Request, res: Response) => {
  const { search, status, priority, page = '1', limit = '10', sortBy = 'createdAt', sortOrder = 'desc', openForEnrollment } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
      { client: { contains: search as string, mode: 'insensitive' } },
    ];
  }
  if (status) where.status = status as ProjectStatus;
  if (priority) where.priority = priority as Priority;
  
  if (openForEnrollment === 'true') {
    where.visibleUntil = { gt: new Date() };
  }

  // RBAC: If user is not admin, only show assigned projects
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) {
    where.members = {
      some: {
        memberId: user?.teamMemberId
      }
    };
  }

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { [sortBy as string]: sortOrder },
      include: {
        manager: { select: { id: true, name: true, profilePictureUrl: true, designation: true } },
        members: {
          include: {
            member: { select: { id: true, name: true, profilePictureUrl: true, designation: true } },
          },
        },
        _count: { select: { members: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  res.json({ data: projects, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
});

// GET /api/projects/:id/pulse
router.get('/:id/pulse', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;
    
    const [openActionItems, openBlockers, recentDecisions, project] = await Promise.all([
      prisma.meetingActionItem.findMany({
        where: { meetingRecord: { projectId }, status: 'open' },
        include: { assignedTo: true, meetingRecord: { select: { meetingDate: true, meetingTitle: true } } },
        orderBy: { dueDate: 'asc' }
      }),
      prisma.blockerRisk.findMany({
        where: { projectId, status: 'open' },
        include: { firstRaisedMeeting: { select: { meetingDate: true, meetingTitle: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.keyDecision.findMany({
        where: { meetingRecord: { projectId } },
        include: { decidedBy: true, meetingRecord: { select: { meetingDate: true, meetingTitle: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.project.findUnique({
        where: { id: projectId },
        select: {
          meetingRecords: {
            orderBy: { meetingDate: 'desc' },
            take: 1,
            select: { meetingDate: true }
          }
        }
      })
    ]);

    const lastMeetingDate = project?.meetingRecords[0]?.meetingDate || null;

    res.json({
      openActionItems,
      openBlockers,
      recentDecisions,
      lastMeetingDate
    });
  } catch (error: any) {
    console.error('[Project Pulse Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/projects/:id/blockers/:blockerId/status
router.patch('/:id/blockers/:blockerId/status', async (req: Request, res: Response) => {
  try {
    const { blockerId } = req.params;
    const { status } = req.body;
    await prisma.blockerRisk.update({
      where: { id: blockerId },
      data: { status }
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:id
router.get('/:id', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      manager: { select: { id: true, name: true, profilePictureUrl: true, designation: true } },
      members: {
        include: {
          member: {
            select: {
              id: true, name: true, profilePictureUrl: true,
              designation: true,
            },
          },
        },
      },
    },
  });
  if (!project) throw new AppError('Project not found', 404);

  // RBAC check
  if (!user?.permissions?.manageTeam) {
    const isMember = project.members.some(m => m.memberId === user?.teamMemberId);
    if (!isMember) {
      throw new AppError('Forbidden: You are not assigned to this project', 403);
    }
  }

  res.json(project);
});

// POST /api/projects
router.post('/', async (req: Request, res: Response) => {
  const { name, description, client, startDate, endDate, priority, status, progress, memberIds, managerId } = req.body;

  if (!name || !startDate) throw new AppError('Name and start date are required', 400);
  
  const visibleUntilDate = new Date();
  visibleUntilDate.setDate(visibleUntilDate.getDate() + 7);

  // Find all benched members to auto-assign
  const benchedMembers = await prisma.teamMember.findMany({
    where: { status: { equals: 'Benched', mode: 'insensitive' } },
    select: { id: true }
  });
  
  const benchedMemberIds = benchedMembers.map(m => m.id);
  const explicitMemberIds = memberIds || [];
  
  // Combine explicit assignments and auto-assignments, keeping track of types
  const createMembersInput = [
    ...explicitMemberIds.map((id: string) => ({ memberId: id, enrollmentType: 'assigned' })),
    ...benchedMemberIds
       .filter((id: string) => !explicitMemberIds.includes(id))
       .map((id: string) => ({ memberId: id, enrollmentType: 'auto-assigned' }))
  ];

  const project = await prisma.project.create({
    data: {
      name,
      description,
      client,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      priority: priority || Priority.MEDIUM,
      status: status || ProjectStatus.PLANNING,
      progress: progress || 0,
      visibleUntil: visibleUntilDate,
      managerId: managerId || undefined,
      members: createMembersInput.length
        ? { create: createMembersInput }
        : undefined,
    },
    include: {
      members: { include: { member: { select: { id: true, name: true, profilePictureUrl: true } } } },
    },
  });

  // Notify all active members about new project
  const allMembers = await prisma.teamMember.findMany({ select: { id: true } });
  if (allMembers.length > 0) {
    await prisma.notification.createMany({
      data: allMembers.map(m => ({
        memberId: m.id,
        type: 'PROJECT_CREATED',
        title: 'New Project Created',
        message: `Project "${name}" has been created and is open for enrollment`,
      })),
    });
  }
  
  // Notify specifically auto-assigned members
  if (benchedMemberIds.length > 0) {
    await prisma.notification.createMany({
      data: benchedMemberIds.map(id => ({
        memberId: id,
        type: 'PROJECT_AUTO_ASSIGNED',
        title: 'Auto-Assigned to New Project',
        message: `You have been automatically assigned to "${name}" because you were on the bench.`,
      })),
    });
  }

  res.status(201).json(project);
});

// PUT /api/projects/:id
router.put('/:id', async (req: Request, res: Response) => {
  const { name, description, client, startDate, endDate, priority, status, progress, managerId } = req.body;

  const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError('Project not found', 404);

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(client !== undefined && { client }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(priority && { priority }),
      ...(status && { status }),
      ...(progress !== undefined && { progress: parseInt(progress) }),
      ...(managerId !== undefined && { managerId: managerId || null }),
    },
    include: {
      members: { include: { member: { select: { id: true, name: true, profilePictureUrl: true } } } },
    },
  });

  const targetMemberIds = project.members.map(m => m.member.id);
  if (targetMemberIds.length > 0) {
    await prisma.notification.createMany({
      data: targetMemberIds.map(id => ({
        memberId: id,
        type: 'PROJECT_UPDATED',
        title: 'Project Updated',
        message: `Project "${project.name}" has been updated`,
      })),
    });
  }

  res.json(project);
});

// DELETE /api/projects/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError('Project not found', 404);
  await prisma.project.delete({ where: { id: req.params.id } });
  res.json({ message: 'Project deleted' });
});

// POST /api/projects/:id/members - Add member to project
router.post('/:id/members', async (req: Request, res: Response) => {
  const { memberId, role } = req.body;
  if (!memberId) throw new AppError('memberId is required', 400);

  const pm = await prisma.projectMember.create({
    data: { projectId: req.params.id, memberId, role },
    include: { member: { select: { id: true, name: true, profilePictureUrl: true, designation: true } } },
  });

  const project = await prisma.project.findUnique({ where: { id: req.params.id } });

  await prisma.notification.create({
    data: {
      memberId,
      type: 'PROJECT_ASSIGNED',
      title: 'Assigned to Project',
      message: `You have been assigned to project "${project?.name || 'Unknown'}"`,
    },
  });

  res.status(201).json(pm);
});

// PUT /api/projects/:id/members/:memberId - Update a member's role in a project
router.put('/:id/members/:memberId', async (req: Request, res: Response) => {
  const { role } = req.body;
  const result = await prisma.projectMember.updateMany({
    where: { projectId: req.params.id, memberId: req.params.memberId },
    data: { role: role || null },
  });
  if (result.count === 0) throw new AppError('Project member not found', 404);
  res.json({ message: 'Project member updated' });
});

// DELETE /api/projects/:id/members/:memberId
router.delete('/:id/members/:memberId', async (req: Request, res: Response) => {
  await prisma.projectMember.deleteMany({
    where: { projectId: req.params.id, memberId: req.params.memberId },
  });
  res.json({ message: 'Member removed from project' });
});

// POST /api/projects/:id/enroll
router.post('/:id/enroll', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const memberId = user?.teamMemberId;
  if (!memberId) throw new AppError('User is not associated with a team member profile', 400);

  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) throw new AppError('Project not found', 404);

  // Check visibility window
  if (!project.visibleUntil || new Date() > project.visibleUntil) {
    throw new AppError('Project is no longer open for self-enrollment', 400);
  }

  // Check if already enrolled
  const existing = await prisma.projectMember.findFirst({
    where: { projectId: req.params.id, memberId }
  });
  if (existing) {
    throw new AppError('Already enrolled in this project', 400);
  }

  const pm = await prisma.projectMember.create({
    data: {
      projectId: req.params.id,
      memberId,
      enrollmentType: 'self-enrolled',
      role: 'DEVELOPER' // default role
    },
    include: { member: { select: { id: true, name: true, profilePictureUrl: true, designation: true } } },
  });

  res.status(201).json(pm);
});

export default router;
