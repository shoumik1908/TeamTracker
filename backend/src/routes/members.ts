import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { uploadImage } from '../middleware/upload';
import { uploadFile, deleteFile, extractBlobName, CONTAINERS } from '../services/blobStorage';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const prisma = new PrismaClient();

// GET /api/members - List all members with search & pagination
router.get('/', async (req: Request, res: Response) => {
  const { search, projectId, page = '1', limit = '10', sortBy = 'name', sortOrder = 'asc' } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { designation: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  if (projectId) {
    where.projectMembers = {
      some: { projectId: projectId as string }
    };
  }

  const [members, total] = await Promise.all([
    prisma.teamMember.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { [sortBy as string]: sortOrder },
      include: {
        manager: { select: { id: true, name: true, profilePictureUrl: true, designation: true } },
        _count: {
          select: {
            assignedCertifications: true,
            projectMembers: true,
          },
        },
      },
    }),
    prisma.teamMember.count({ where }),
  ]);

  res.json({
    data: members,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  });
});

// GET /api/members/:id - Get member profile
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const member = await prisma.teamMember.findUnique({
    where: { id },
    include: {
      manager: { select: { id: true, name: true, profilePictureUrl: true, designation: true } },
      assignedCertifications: {
        include: { certification: true },
        orderBy: { deadline: 'asc' },
      },
      projectMembers: {
        include: {
          project: true,
        },
      },
    },
  });

  if (!member) throw new AppError('Member not found', 404);

  // Calculate stats
  const certs = member.assignedCertifications;
  const completedCerts = certs.filter(c => c.status === 'COMPLETED').length;
  const totalCerts = certs.length;
  const avgProgress = totalCerts > 0
    ? Math.round(certs.reduce((sum, c) => sum + c.progress, 0) / totalCerts)
    : 0;

  res.json({
    ...member,
    stats: {
      totalCertifications: totalCerts,
      completedCertifications: completedCerts,
      inProgressCertifications: certs.filter(c => c.status === 'IN_PROGRESS').length,
      overdueCertifications: certs.filter(c => c.status === 'OVERDUE').length,
      expiredCertifications: certs.filter(c => c.status === 'EXPIRED').length,
      totalProjects: member.projectMembers.length,
      activeProjects: member.projectMembers.filter(pm => pm.project.status === 'IN_PROGRESS').length,
      overallProgress: avgProgress,
    },
  });
});

// POST /api/members - Create member
router.post('/', uploadImage.single('profilePicture'), async (req: Request, res: Response) => {
  const { name, phone, designation, joiningDate, skills } = req.body;

  if (!name || !joiningDate) {
    throw new AppError('Name and joining date are required', 400);
  }

  let profilePictureUrl: string | undefined;

  if (req.file) {
    const result = await uploadFile(
      CONTAINERS.PROFILE_IMAGES,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    profilePictureUrl = result.url;
  }

  const member = await prisma.teamMember.create({
    data: {
      name,
      phone,

      designation,
      joiningDate: new Date(joiningDate),
      skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map((s: string) => s.trim()) : []),
      profilePictureUrl,
    },
  });

  // Create notification
  await prisma.notification.create({
    data: {
      memberId: member.id,
      type: 'CERTIFICATION_ASSIGNED',
      title: 'New Team Member Added',
      message: `${name} has joined the team as ${designation}`,
    },
  });

  res.status(201).json(member);
});

// PUT /api/members/:id - Update member
router.put('/:id', uploadImage.single('profilePicture'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, phone, designation, joiningDate, skills } = req.body;

  const existing = await prisma.teamMember.findUnique({ where: { id } });
  if (!existing) throw new AppError('Member not found', 404);

  let profilePictureUrl = existing.profilePictureUrl;

  if (req.file) {
    // Delete old profile picture if exists
    if (existing.profilePictureUrl) {
      const blobName = extractBlobName(existing.profilePictureUrl);
      await deleteFile(CONTAINERS.PROFILE_IMAGES, blobName).catch(console.error);
    }
    const result = await uploadFile(
      CONTAINERS.PROFILE_IMAGES,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    profilePictureUrl = result.url;
  }

  const member = await prisma.teamMember.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(phone !== undefined && { phone }),

      ...(designation && { designation }),
      ...(joiningDate && { joiningDate: new Date(joiningDate) }),
      ...(skills !== undefined && {
        skills: Array.isArray(skills) ? skills : skills.split(',').map((s: string) => s.trim()),
      }),
      profilePictureUrl,
    },
  });

  res.json(member);
});

// DELETE /api/members/:id - Delete member
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.teamMember.findUnique({ where: { id } });
  if (!existing) throw new AppError('Member not found', 404);

  if (existing.profilePictureUrl) {
    const blobName = extractBlobName(existing.profilePictureUrl);
    await deleteFile(CONTAINERS.PROFILE_IMAGES, blobName).catch(console.error);
  }

  await prisma.teamMember.delete({ where: { id } });
  res.json({ message: 'Member deleted successfully' });
});


export default router;
