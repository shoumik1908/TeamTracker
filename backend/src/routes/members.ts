import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import multer from 'multer';
import { uploadImage } from '../middleware/upload';
import { uploadFile, deleteFile, extractBlobName, CONTAINERS, sanitizeDirectoryName } from '../services/blobStorage';
import { AppError } from '../middleware/errorHandler';
import { extractCvWithGroq } from '../services/groqExtractor';

// Multer config for CV uploads (PDF + DOCX, in-memory, 10 MB limit)
const cvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are accepted'));
    }
  },
});

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
        projectMembers: {
          where: {
            project: {
              status: { not: 'COMPLETED' }
            }
          },
          include: {
            project: { select: { name: true, status: true } }
          }
        },
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

  const mappedMembers = members.map(member => {
    const activeProjects = member.projectMembers.filter(pm => pm.project && pm.project.status !== 'COMPLETED');
    const allocationStatus = activeProjects.length > 0 ? 'ALLOCATED' : 'BENCHED';
    const currentProjectName = activeProjects[0]?.project?.name || null;
    const activeProjectsCount = activeProjects.length;
    const activeProjectNames = activeProjects.map(pm => pm.project?.name).filter(Boolean);

    return {
      ...member,
      allocationStatus,
      currentProjectName,
      activeProjectsCount,
      activeProjectNames,
    };
  });

  res.json({
    data: mappedMembers,
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

  const activeProjects = member.projectMembers.filter(pm => pm.project && pm.project.status !== 'COMPLETED');
  const allocationStatus = activeProjects.length > 0 ? 'ALLOCATED' : 'BENCHED';
  const currentProjectName = activeProjects[0]?.project?.name || null;
  const activeProjectsCount = activeProjects.length;
  const activeProjectNames = activeProjects.map(pm => pm.project?.name).filter(Boolean);

  res.json({
    ...member,
    allocationStatus,
    currentProjectName,
    activeProjectsCount,
    activeProjectNames,
    stats: {
      totalCertifications: totalCerts,
      completedCertifications: completedCerts,
      inProgressCertifications: certs.filter(c => c.status === 'IN_PROGRESS').length,
      overdueCertifications: certs.filter(c => c.status === 'OVERDUE').length,
      expiredCertifications: certs.filter(c => c.status === 'EXPIRED').length,
      totalProjects: member.projectMembers.length,
      activeProjects: activeProjects.length,
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

  await prisma.activityLog.create({
    data: {
      category: 'Team Members',
      action: 'DELETE',
      details: `Deleted team member "${existing.name}"`,
    }
  });

  res.json({ message: 'Member deleted successfully' });
});


// POST /api/members/:id/upload-cv
router.post('/:id/upload-cv', cvUpload.single('cv'), async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!req.file) {
    throw new AppError('No file uploaded. Please attach a PDF or DOCX file.', 400);
  }

  const member = await prisma.teamMember.findUnique({ where: { id } });
  if (!member) throw new AppError('Member not found', 404);

  // ── 1. Extract plain text ───────────────────────────────────────────────
  let plainText = '';
  const mimeType = req.file.mimetype;

  if (mimeType === 'application/pdf') {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: req.file.buffer });
    try {
      const result = await parser.getText();
      plainText = result.text;
      console.log('PDF pages:', result.total ?? 'n/a');
      console.log('Extracted text length:', plainText.length);
      console.log('Extracted text preview:', plainText.slice(0, 200));
    } catch (err: any) {
      console.error('[pdf-parse error]:', err);
      throw new AppError(`Failed to parse PDF: ${err.message || err}`, 500);
    } finally {
      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
    }
  } else {
    // DOCX
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require('mammoth') as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> };
    const result = await mammoth.extractRawText({ buffer: req.file.buffer });
    plainText = result.value;
  }

  if (!plainText || plainText.trim().length < 50) {
    throw new AppError('Could not extract readable text from the uploaded file. Please check the file is not scanned/image-only.', 422);
  }

  // ── 2. Groq AI extraction ───────────────────────────────────────────────
  const extracted = await extractCvWithGroq(plainText);

  // ── 3. Upload file to ADLS Gen2 ─────────────────────────────────────────
  // Reuse same folder pattern as certificates: {memberId}-{PersonName}/cv/{filename}
  const sanitizedName = sanitizeDirectoryName(member.name);
  const folderName = `${id}-${sanitizedName}`;

  // We upload via the generic ADLS path. To keep things simple we reuse
  // uploadFile but with the CVS container (which uses normal blob, not ADLS Gen2
  // directory structure). If you want ADLS Gen2, add a dedicated upload helper.
  const { url: cvBlobUrl } = await uploadFile(
    CONTAINERS.CVS,
    req.file.buffer,
    req.file.originalname,
    mimeType
  );

  // ── 4. Persist to DB ────────────────────────────────────────────────────
  const updated = await prisma.teamMember.update({
    where: { id },
    data: {
      skillsExtracted: extracted.skills,
      yearsOfExperience: extracted.years_of_experience,
      cvSummary: extracted.summary,
      atsScore: extracted.ats_score.total,
      atsScoreBreakdown: extracted.ats_score.breakdown,
      atsSuggestions: extracted.feedback as any,
      cvBlobUrl,
      cvOriginalFilename: req.file.originalname,
      cvUploadedAt: new Date(),
      skills: {
        set: [
          ...new Set([
            ...member.skills,
            ...extracted.skills,
          ]),
        ],
      },
    },
  });

  await prisma.activityLog.create({
    data: {
      category: 'CVs',
      action: 'UPLOAD',
      details: `Uploaded and analyzed CV "${req.file.originalname}" for ${member.name}`,
    }
  });

  res.json({
    message: 'CV uploaded and analysed successfully.',
    atsScore: extracted.ats_score.total,
    atsBreakdown: extracted.ats_score.breakdown,
    atsSuggestions: extracted.feedback,
    skillsExtracted: extracted.skills,
    yearsOfExperience: extracted.years_of_experience,
    primaryRole: extracted.primary_role,
    summary: extracted.summary,
    certificationsMentioned: extracted.certifications_mentioned,
    cvBlobUrl,
    member: updated,
  });
});

// DELETE /api/members/:id/cv - Remove CV
router.delete('/:id/cv', async (req: Request, res: Response) => {
  const { id } = req.params;

  const member = await prisma.teamMember.findUnique({ where: { id } });
  if (!member) throw new AppError('Member not found', 404);
  if (!member.cvBlobUrl) throw new AppError('No CV found for this member', 404);

  const blobName = extractBlobName(member.cvBlobUrl);
  if (blobName) {
    await deleteFile(CONTAINERS.CVS, blobName);
  }

  const updated = await prisma.teamMember.update({
    where: { id },
    data: {
      cvBlobUrl: null,
      cvOriginalFilename: null,
      cvUploadedAt: null,
      cvSummary: null,
      atsScore: null,
      atsScoreBreakdown: Prisma.DbNull,
      atsSuggestions: Prisma.DbNull,
    },
  });

  await prisma.activityLog.create({
    data: {
      category: 'CVs',
      action: 'DELETE',
      details: `Removed CV for ${member.name}`,
    }
  });

  res.json({ message: 'CV removed successfully.', member: updated });
});

export default router;
