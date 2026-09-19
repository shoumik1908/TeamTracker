import prisma from '../lib/prisma';
import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { uploadImage } from '../middleware/upload';
import { normalizeLinkedinUrl } from '../lib/linkedinUrl';
import { parsePagination, parseSort } from '../lib/pagination';
import { createResetToken, RESET_TOKEN_TTL_MINUTES } from '../services/passwordResetToken';
import { uploadFile, deleteFile, extractBlobName, CONTAINERS, sanitizeDirectoryName } from '../services/blobStorage';
import { AppError } from '../middleware/errorHandler';
import { extractCvWithAI } from '../services/aiExtractor';
import { authenticateToken, AuthRequest } from '../middleware/auth';

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

router.use(authenticateToken);

/**
 * TT-046: adding a member with an email silently minted a User account whose password
 * was `firstname+xebia`, so knowing someone's name and address was enough to sign in
 * as them. The account is still created automatically — that is the feature — but with
 * an unusable random password and a single-use reset link the admin passes on, exactly
 * as an admin-initiated reset does (see routes/admin.ts).
 *
 * Returns null when there is no "Team Member" role to attach, which is the same
 * silent no-op the previous code performed.
 */
async function createMemberAccount(
  email: string,
  name: string,
  teamMemberId: string,
): Promise<{ resetToken: string; expiresInMinutes: number } | null> {
  const teamMemberRole = await prisma.role.findFirst({ where: { name: 'Team Member' } });
  if (!teamMemberRole) return null;

  // Random and never shown: the account must be unreachable until someone uses the
  // link, and the token is derived from this hash so it dies the moment it is used.
  const unusable = crypto.randomBytes(32).toString('base64url');
  const passwordHash = await bcrypt.hash(unusable, 10);

  const account = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      roleId: teamMemberRole.id,
      teamMemberId,
      mustChangePassword: true,
    },
  });

  return {
    resetToken: createResetToken(account.id, passwordHash),
    expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
  };
}

// GET /api/members/with-resumes - List members who have at least one resume profile or a cvBlobUrl
router.get('/with-resumes', async (req: Request, res: Response) => {
  const members = await prisma.teamMember.findMany({
    where: {
      OR: [
        { resumeProfiles: { some: {} } },
        { cvBlobUrl: { not: null } }
      ]
    },
    select: { id: true, name: true, designation: true },
    orderBy: { name: 'asc' }
  });
  res.json(members);
});

router.get('/', async (req: Request, res: Response) => {
  const { search, projectId } = req.query;

  // TT-112: page/limit/sortBy went from the query string to Prisma unchecked.
  const { page: pageNum, limit: limitNum, skip } = parsePagination(req.query, { limit: 10, maxLimit: 200 });
  const { sortBy, sortOrder } = parseSort(
    req.query,
    ['name', 'designation', 'joiningDate', 'yearsOfExperience', 'status', 'createdAt'] as const,
    'name',
  );

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
      orderBy: { [sortBy]: sortOrder },
      include: {
        manager: { select: { id: true, name: true, profilePictureUrl: true, designation: true } },
        projectMembers: {
          where: {
            OR: [
              { project: { OR: [{ status: { not: 'COMPLETED' } }, { progress: { lt: 100 } }] } },
              { opportunityId: { not: null } }
            ]
          },
          include: {
            project: { select: { name: true, status: true, progress: true } },
            opportunity: { select: { name: true, clientName: true } }
          }
        },
        _count: {
          select: {
            assignedCertifications: true,
            projectMembers: true,
          },
        },
        user: { select: { id: true } },
      },
    }),
    prisma.teamMember.count({ where }),
  ]);

  const mappedMembers = members.map(member => {
    const activeAssignments = member.projectMembers.filter(pm =>
      (pm.project && (pm.project.status !== 'COMPLETED' || pm.project.progress < 100)) || pm.opportunity
    );
    const allocationStatus = activeAssignments.length > 0 ? 'ALLOCATED' : 'BENCHED';
    
    const assignmentNames = activeAssignments.map(pm => pm.project?.name || pm.opportunity?.name).filter(Boolean);
    const currentProjectName = assignmentNames[0] || null;
    const activeProjectsCount = activeAssignments.length;
    const activeProjectNames = assignmentNames;

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
          opportunity: true,
        },
      },
      meetingActionItems: {
        orderBy: { createdAt: 'desc' },
        take: 10,
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

  const activeAssignments = member.projectMembers.filter(pm =>
    (pm.project && (pm.project.status !== 'COMPLETED' || pm.project.progress < 100)) || pm.opportunity
  );
  const allocationStatus = activeAssignments.length > 0 ? 'ALLOCATED' : 'BENCHED';
  
  const assignmentNames = activeAssignments.map(pm => pm.project?.name || pm.opportunity?.name).filter(Boolean);
  const currentProjectName = assignmentNames[0] || null;
  const activeProjectsCount = activeAssignments.length;
  const activeProjectNames = assignmentNames;

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
      activeProjects: activeAssignments.length,
      overallProgress: avgProgress,
    },
  });
});

// POST /api/members - Create member
router.post('/', uploadImage.single('profilePicture'), async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) throw new AppError('Forbidden: Only Admins can add members', 403);

  const { name, email, phone, designation, joiningDate, skills, yearsOfExperience, linkedinUrl } = req.body;

  if (!name || !joiningDate) {
    throw new AppError('Name and joining date are required', 400);
  }

  // Validated before anything is written, so a rejected URL costs nothing.
  const normalizedLinkedinUrl = normalizeLinkedinUrl(linkedinUrl) ?? null;

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
      email,
      phone,
      linkedinUrl: normalizedLinkedinUrl,
      designation,
      joiningDate: new Date(joiningDate),
      skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map((s: string) => s.trim()) : []),
      ...(yearsOfExperience !== undefined && yearsOfExperience !== '' && { yearsOfExperience: parseInt(yearsOfExperience, 10) }),
      profilePictureUrl,
    },
  });

  // Auto-create User credentials if email is provided
  let credentials: { resetToken: string; expiresInMinutes: number } | null = null;
  if (email) {
    credentials = await createMemberAccount(email, name, member.id);
  }

  // Create notification
  await prisma.notification.create({
    data: {
      targetRole: 'Admin',
      type: 'NEW_MEMBER_REGISTERED',
      title: 'New Team Member Added',
      message: designation ? `${name} has joined the team as ${designation}` : `${name} has joined the team`,
    },
  });

  // The reset link rides along on the member the admin just created, so it is in front
  // of them at the one moment they can act on it. Additive: existing callers that read
  // only the member fields are unaffected.
  res.status(201).json({ ...member, ...(credentials ?? {}) });
});

// PUT /api/members/:id - Update member
router.put('/:id', uploadImage.single('profilePicture'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam && user?.teamMemberId !== id) {
    throw new AppError('Forbidden: You can only edit your own profile', 403);
  }

  const { name, email, phone, designation, joiningDate, skills, allocationPercentage, status, yearsOfExperience, linkedinUrl } = req.body;

  // TT-111: this endpoint is reachable by a member editing their own profile, and every
  // field in the body was applied. allocationPercentage and status are staffing
  // decisions — a member could mark themselves benched, or set their allocation to
  // whatever they liked — and designation and joiningDate are records, not preferences.
  // Admins keep the full set; everyone else is limited to their own contact details.
  const isAdmin = user?.permissions?.manageTeam === true;
  const adminOnlyFields = { allocationPercentage, status, designation, joiningDate };
  if (!isAdmin) {
    const attempted = Object.entries(adminOnlyFields)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k);
    if (attempted.length > 0) {
      throw new AppError(
        `Only an administrator can change: ${attempted.join(', ')}.`,
        403,
      );
    }
  }

  // undefined means "not supplied", which leaves the column alone; the spread below
  // relies on that distinction, so it has to survive normalisation.
  const normalizedLinkedinUrl = normalizeLinkedinUrl(linkedinUrl);

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
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(normalizedLinkedinUrl !== undefined && { linkedinUrl: normalizedLinkedinUrl }),
      ...(designation && { designation }),
      ...(joiningDate && { joiningDate: new Date(joiningDate) }),
      ...(skills !== undefined && {
        skills: Array.isArray(skills) ? skills : skills.split(',').map((s: string) => s.trim()),
      }),
      ...(allocationPercentage !== undefined && { allocationPercentage: parseInt(allocationPercentage, 10) }),
      ...(status && { status }),
      ...(yearsOfExperience !== undefined && yearsOfExperience !== '' && { yearsOfExperience: parseInt(yearsOfExperience, 10) }),
      profilePictureUrl,
    },
  });

  // Sync User credentials
  let credentials: { resetToken: string; expiresInMinutes: number } | null = null;
  const existingUser = await prisma.user.findUnique({ where: { teamMemberId: id } });

  if (existingUser && (email !== undefined || name)) {
    // If email is explicitly set to empty string or null, we might want to deactivate or delete, 
    // but for now we just update email and name. If it's a unique constraint violation, Prisma handles it.
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        ...(email !== undefined && { email: email || existingUser.email }),
        ...(name && { name }),
      }
    });
  } else if (!existingUser && email) {
    // Auto-create User credentials if email is newly provided
    credentials = await createMemberAccount(email, name || existing.name, id);
  }

  res.json({ ...member, ...(credentials ?? {}) });
});

// GET /api/members/:id/resume-profile
router.get('/:id/resume-profile', async (req: Request, res: Response) => {
  const { id } = req.params;
  // Raw CV text and generated resumes are personal: same rule this file already
  // applies to viewing and editing a profile.
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam && user?.teamMemberId !== id) {
    throw new AppError('Forbidden: You can only view your own resume profile', 403);
  }
  const resumeProfile = await prisma.resumeProfile.findFirst({
    where: { memberId: id },
    orderBy: { uploadedAt: 'desc' },
  });
  
  if (!resumeProfile) {
    return res.status(404).json({ error: 'No resume profile found for this member' });
  }

  const generatedResumes = await prisma.generatedResume.findMany({
    where: { memberId: id },
    orderBy: { createdAt: 'desc' }
  });

  res.json({ resumeProfile, generatedResumes });
});

// DELETE /api/members/:id - Delete member
router.delete('/:id', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) throw new AppError('Forbidden: Only Admins can delete members', 403);

  const { id } = req.params;

  const existing = await prisma.teamMember.findUnique({ where: { id } });
  if (!existing) throw new AppError('Member not found', 404);

  if (existing.profilePictureUrl) {
    const blobName = extractBlobName(existing.profilePictureUrl);
    await deleteFile(CONTAINERS.PROFILE_IMAGES, blobName).catch(console.error);
  }

  // Delete the corresponding user credentials
  await prisma.user.deleteMany({ where: { teamMemberId: id } });

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
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam && user?.teamMemberId !== id) {
    throw new AppError('Forbidden: You can only upload your own CV', 403);
  }

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
  const extracted = await extractCvWithAI(plainText);

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
      skillsGrouped: extracted.skillsGrouped as any,
      projectsExtracted: extracted.projects as any,
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

  // 5. Create ResumeProfile historical record
  await prisma.resumeProfile.create({
    data: {
      memberId: id,
      atsScore: extracted.ats_score.total,
      atsBreakdown: extracted.ats_score.breakdown,
      atsSuggestions: extracted.feedback as any,
      summary: extracted.summary,
      skills: extracted.skills,
      primaryRole: extracted.primary_role,
      yearsOfExperience: extracted.years_of_experience,
      certifications: extracted.certifications_mentioned,
      skillsGrouped: extracted.skillsGrouped as any,
      projects: extracted.projects as any,
      rawExtractedText: plainText,
      uploadedAt: new Date(),
    }
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
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam && user?.teamMemberId !== id) {
    throw new AppError('Forbidden: You can only delete your own CV', 403);
  }

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
