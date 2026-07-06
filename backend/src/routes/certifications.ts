import { Router, Request, Response } from 'express';
import { PrismaClient, CertificationStatus, Priority } from '@prisma/client';
import { upload } from '../middleware/upload';
import { uploadFile, deleteFile, extractBlobName, CONTAINERS } from '../services/blobStorage';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const prisma = new PrismaClient();

// ============ CERTIFICATION CATALOG ============

// GET /api/certifications - List catalog
router.get('/', async (req: Request, res: Response) => {
  const { search, provider, page = '1', limit = '10' } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { provider: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
    ];
  }
  if (provider) where.provider = { equals: provider as string, mode: 'insensitive' };


  const [certs, total] = await Promise.all([
    prisma.certification.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { assignedCertifications: true } },
        assignedCertifications: {
          where: { status: 'COMPLETED' },
          select: { id: true },
        },
      },
    }),
    prisma.certification.count({ where }),
  ]);

  const certsWithCompletedCount = certs.map((c: any) => ({
    ...c,
    _completedCount: c.assignedCertifications.length,
    assignedCertifications: undefined,
  }));

  res.json({ data: certsWithCompletedCount, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
});

// GET /api/certifications/:id
router.get('/:id', async (req: Request, res: Response) => {
  const cert = await prisma.certification.findUnique({
    where: { id: req.params.id },
    include: {
      assignedCertifications: {
        include: { member: { select: { id: true, name: true, profilePictureUrl: true, designation: true } } },
      },
    },
  });
  if (!cert) throw new AppError('Certification not found', 404);
  res.json(cert);
});

// POST /api/certifications - Create catalog entry
router.post('/', async (req: Request, res: Response) => {
  const { name, provider, description, duration, learningLink } = req.body;
  if (!name || !provider) throw new AppError('Name and provider are required', 400);

  const cert = await prisma.certification.create({
    data: { name, provider, description, duration, learningLink },
  });
  res.status(201).json(cert);
});

// PUT /api/certifications/:id
router.put('/:id', async (req: Request, res: Response) => {
  const { name, provider, description, duration, learningLink } = req.body;
  const cert = await prisma.certification.update({
    where: { id: req.params.id },
    data: { name, provider, description, duration, learningLink },
  });
  res.json(cert);
});

// DELETE /api/certifications/:id
router.delete('/:id', async (req: Request, res: Response) => {
  await prisma.certification.delete({ where: { id: req.params.id } });
  res.json({ message: 'Certification deleted' });
});

// ============ ASSIGNMENTS ============

// GET /api/certifications/assignments/all - All assignments (tracker)
router.get('/assignments/all', async (req: Request, res: Response) => {
  const { search, memberId, provider, status, deadline, page = '1', limit = '20', sortBy = 'deadline', sortOrder = 'asc' } = req.query;

  const where: any = {};
  if (memberId) where.memberId = memberId as string;
  if (status) where.status = status as CertificationStatus;
  if (provider) where.certification = { provider: { equals: provider as string, mode: 'insensitive' } };
  if (search) {
    where.OR = [
      { member: { name: { contains: search as string, mode: 'insensitive' } } },
      { certification: { name: { contains: search as string, mode: 'insensitive' } } },
    ];
  }
  if (deadline === 'overdue') where.deadline = { lt: new Date() };
  else if (deadline === 'today') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    where.deadline = { gte: today, lt: tomorrow };
  } else if (deadline === 'week') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);
    where.deadline = { gte: today, lt: nextWeek };
  }

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const [assignments, total] = await Promise.all([
    prisma.assignedCertification.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { [sortBy as string]: sortOrder },
      include: {
        member: { select: { id: true, name: true, profilePictureUrl: true, designation: true } },
        certification: true,
      },
    }),
    prisma.assignedCertification.count({ where }),
  ]);

  res.json({ data: assignments, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
});

// POST /api/certifications/assign - Assign cert to member
router.post('/assign', async (req: Request, res: Response) => {
  const { memberId, certificationId, deadline, priority, notes, assignedDate } = req.body;

  if (!memberId || !certificationId || !deadline) {
    throw new AppError('memberId, certificationId, and deadline are required', 400);
  }

  const [member, cert] = await Promise.all([
    prisma.teamMember.findUnique({ where: { id: memberId } }),
    prisma.certification.findUnique({ where: { id: certificationId } }),
  ]);
  if (!member) throw new AppError('Member not found', 404);
  if (!cert) throw new AppError('Certification not found', 404);

  const assignment = await prisma.assignedCertification.create({
    data: {
      memberId,
      certificationId,
      deadline: new Date(deadline),
      priority: priority || Priority.MEDIUM,
      notes,
      assignedDate: assignedDate ? new Date(assignedDate) : new Date(),
    },
    include: { member: true, certification: true },
  });

  await prisma.notification.create({
    data: {
      memberId,
      type: 'CERTIFICATION_ASSIGNED',
      title: 'New Certification Assigned',
      message: `${cert.name} has been assigned to ${member.name}. Deadline: ${new Date(deadline).toLocaleDateString()}`,
    },
  });

  res.status(201).json(assignment);
});

// PUT /api/certifications/assignments/:id - Update assignment
router.put('/assignments/:id', async (req: Request, res: Response) => {
  const { progress, status, deadline, priority, notes, credentialId, completionDate, expiryDate } = req.body;

  const existing = await prisma.assignedCertification.findUnique({
    where: { id: req.params.id },
    include: { member: true, certification: true },
  });
  if (!existing) throw new AppError('Assignment not found', 404);

  const wasCompleted = existing.status !== 'COMPLETED';
  const isNowCompleted = status === 'COMPLETED';

  const updated = await prisma.assignedCertification.update({
    where: { id: req.params.id },
    data: {
      ...(progress !== undefined && { progress: parseInt(progress) }),
      ...(status && { status }),
      ...(deadline && { deadline: new Date(deadline) }),
      ...(priority && { priority }),
      ...(notes !== undefined && { notes }),
      ...(credentialId !== undefined && { credentialId }),
      ...(completionDate && { completionDate: new Date(completionDate) }),
      ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
      ...(isNowCompleted && !completionDate && { completionDate: new Date() }),
    },
    include: { member: true, certification: true },
  });

  if (wasCompleted && isNowCompleted) {
    await prisma.notification.create({
      data: {
        memberId: existing.memberId,
        type: 'CERTIFICATION_COMPLETED',
        title: 'Certification Completed!',
        message: `${existing.member.name} completed ${existing.certification.name}`,
      },
    });
  }

  res.json(updated);
});

// POST /api/certifications/assignments/:id/certificate - Upload certificate
router.post('/assignments/:id/certificate', upload.single('certificate'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { credentialId, expiryDate, completionDate } = req.body;

  if (!req.file) throw new AppError('Certificate file is required', 400);

  const existing = await prisma.assignedCertification.findUnique({
    where: { id },
    include: { member: true, certification: true },
  });
  if (!existing) throw new AppError('Assignment not found', 404);

  if (existing.certificateUrl) {
    const blobName = extractBlobName(existing.certificateUrl);
    await deleteFile(CONTAINERS.CERTIFICATES, blobName).catch(console.error);
  }

  const { url } = await uploadFile(
    CONTAINERS.CERTIFICATES,
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype
  );

  const updated = await prisma.assignedCertification.update({
    where: { id },
    data: {
      certificateUrl: url,
      uploadDate: new Date(),
      ...(credentialId && { credentialId }),
      status: 'COMPLETED',
      completionDate: completionDate ? new Date(completionDate) : (existing.completionDate || new Date()),
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      progress: 100,
    },
    include: { member: true, certification: true },
  });

  await prisma.notification.create({
    data: {
      memberId: existing.memberId,
      type: 'CERTIFICATE_UPLOADED',
      title: 'Certificate Uploaded',
      message: `Certificate for ${existing.certification.name} uploaded by ${existing.member.name}`,
    },
  });

  res.json(updated);
});

// DELETE /api/certifications/assignments/:id
router.delete('/assignments/:id', async (req: Request, res: Response) => {
  const existing = await prisma.assignedCertification.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError('Assignment not found', 404);

  if (existing.certificateUrl) {
    const blobName = extractBlobName(existing.certificateUrl);
    await deleteFile(CONTAINERS.CERTIFICATES, blobName).catch(console.error);
  }

  await prisma.assignedCertification.delete({ where: { id: req.params.id } });
  res.json({ message: 'Assignment deleted' });
});

export default router;
