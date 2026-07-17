import { Router, Request, Response } from 'express';
import { PrismaClient, CertificationStatus, Priority } from '@prisma/client';
import { upload } from '../middleware/upload';
import { uploadFile, deleteFile, extractBlobName, CONTAINERS } from '../services/blobStorage';
import { AppError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest, requirePermission } from '../middleware/auth';
import { extractCertificateFields, isConfigured as isDocIntelConfigured, checkNameMatch } from '../services/documentIntelligence';
import { matchCertificateTitle } from '../services/certMatcher';
import { matchTeamMember } from '../utils/fuzzyMatch';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fuzz = require('fuzzball') as {
  ratio: (a: string, b: string) => number;
};

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

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

  // RBAC: If user is not admin, only show their assignments
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) {
    where.memberId = user?.teamMemberId;
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

  const existingAssignment = await prisma.assignedCertification.findUnique({
    where: { memberId_certificationId: { memberId, certificationId } },
  });

  let assignment;
  if (existingAssignment) {
    assignment = await prisma.assignedCertification.update({
      where: { id: existingAssignment.id },
      data: {
        deadline: new Date(deadline),
        priority: priority || existingAssignment.priority,
        notes: notes !== undefined ? notes : existingAssignment.notes,
      },
      include: { member: true, certification: true },
    });
  } else {
    assignment = await prisma.assignedCertification.create({
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
  }

  res.status(existingAssignment ? 200 : 201).json(assignment);
});

// PUT /api/certifications/assignments/:id - Update assignment
router.put('/assignments/:id', async (req: Request, res: Response) => {
  const { progress, status, deadline, priority, notes, credentialId, completionDate, expiryDate } = req.body;

  const existing = await prisma.assignedCertification.findUnique({
    where: { id: req.params.id },
    include: { member: true, certification: true },
  });
  if (!existing) throw new AppError('Assignment not found', 404);

  // RBAC: Users can only update their own assignments
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam && existing.memberId !== user?.teamMemberId) {
    throw new AppError('Forbidden: You can only update your own certification assignments', 403);
  }

  const wasCompleted = existing.status !== 'COMPLETED';
  
  const finalCompletionDate = completionDate ? new Date(completionDate) : existing.completionDate;
  const finalExpiryDate = expiryDate !== undefined ? (expiryDate ? new Date(expiryDate) : null) : existing.expiryDate;
  
  let finalStatus = status || existing.status;
  if (finalCompletionDate) {
    if (finalExpiryDate && finalExpiryDate < new Date()) {
      finalStatus = 'EXPIRED';
    } else {
      finalStatus = 'COMPLETED';
    }
  }
  
  const isNowCompleted = finalStatus === 'COMPLETED';

  const updated = await prisma.assignedCertification.update({
    where: { id: req.params.id },
    data: {
      ...(progress !== undefined && { progress: parseInt(progress) }),
      status: finalStatus,
      ...(deadline && { deadline: new Date(deadline) }),
      ...(priority && { priority }),
      ...(notes !== undefined && { notes }),
      ...(credentialId !== undefined && { credentialId }),
      ...(completionDate && { completionDate: new Date(completionDate) }),
      ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
      ...(isNowCompleted && !completionDate && !existing.completionDate && { completionDate: new Date() }),
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

// POST /api/certifications/assignments/:id/certificate/analyze
router.post('/assignments/:id/certificate/analyze', upload.single('certificate'), async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('Certificate file is required', 400);

  if (!isDocIntelConfigured()) {
    return res.json({ completionDate: null, expiryDate: null, credentialId: null, recipientName: null, recipientNameSource: null, rawLines: [], rawFields: {}, certificationMatch: null, confidence: 0, nameMatch: null, configured: false });
  }

  try {
    const fields = await extractCertificateFields(req.file.buffer, req.file.mimetype);

    // Load catalog for fuzzy title matching
    const catalog = await prisma.certification.findMany({ select: { id: true, name: true, provider: true } });
    const matchResult = matchCertificateTitle(fields.rawLines, catalog);

    // Name match: cross-check extracted name against the assigned member's name
    let nameMatch = null;
    if (fields.recipientName) {
      const assignment = await prisma.assignedCertification.findUnique({
        where: { id: req.params.id },
        include: { member: { select: { name: true } } },
      });
      if (assignment?.member?.name) {
        nameMatch = checkNameMatch(fields.recipientName, assignment.member.name);
      }
    } else {
      const assignment = await prisma.assignedCertification.findUnique({
        where: { id: req.params.id },
        include: { member: { select: { name: true } } },
      });
      if (assignment?.member?.name) {
        const mNameLower = assignment.member.name.toLowerCase().trim();
        let bestScore = 0;
        for (const line of fields.rawLines) {
          const lineLower = line.toLowerCase().trim();
          if (lineLower.includes(mNameLower) || mNameLower.includes(lineLower)) {
            const score = fuzz.ratio(lineLower, mNameLower);
            if (score > bestScore) bestScore = score;
          } else {
            const score = fuzz.ratio(lineLower, mNameLower);
            if (score > 85 && score > bestScore) bestScore = score;
          }
        }
        if (bestScore >= 70) {
          fields.recipientName = assignment.member.name;
          fields.recipientNameSource = 'layout';
          nameMatch = {
            matches: true,
            score: bestScore,
            extractedName: assignment.member.name,
            memberName: assignment.member.name
          };
          console.log(`[DocIntel] Auto-matched assigned member from raw lines: "${assignment.member.name}"`);
        }
      }
    }

    return res.json({
      ...fields,
      certificationMatch: matchResult.bestMatch,
      confidence: matchResult.confidence,
      matchedLine: matchResult.matchedLine,
      suggestions: matchResult.suggestions,
      nameMatch,  // { matches, score, extractedName, memberName } or null
      configured: true,
    });
  } catch (err: any) {
    console.error('Document Intelligence error:', err?.message);
    return res.json({ completionDate: null, expiryDate: null, credentialId: null, recipientName: null, recipientNameSource: null, rawLines: [], rawFields: {}, certificationMatch: null, confidence: 0, suggestions: [], nameMatch: null, configured: true, error: err?.message });
  }
});

// POST /api/certifications/certificate/analyze-universal
router.post('/certificate/analyze-universal', upload.single('certificate'), async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('Certificate file is required', 400);

  if (!isDocIntelConfigured()) {
    return res.json({ completionDate: null, expiryDate: null, credentialId: null, recipientName: null, recipientNameSource: null, rawLines: [], rawFields: {}, certificationMatch: null, confidence: 0, memberMatch: null, configured: false });
  }

  try {
    const fields = await extractCertificateFields(req.file.buffer, req.file.mimetype);

    // 1. Fuzzy-match certification catalog
    const catalog = await prisma.certification.findMany({ select: { id: true, name: true, provider: true } });
    const matchResult = matchCertificateTitle(fields.rawLines, catalog);

    // 2. Fuzzy-match team members
    const members = await prisma.teamMember.findMany({ select: { id: true, name: true } });
    let memberMatch = null;
    let memberConfidence = 0;

    if (fields.recipientName) {
      const result = matchTeamMember(fields.recipientName, members);
      if (result.matches) {
        memberMatch = { id: result.memberId!, name: result.memberName! };
        memberConfidence = result.score;
      }
    }

    if (!memberMatch) {
      console.log('[DocIntel] Scanning raw lines for database team member names...');
      let bestScore = 0;
      let bestMember = null;
      let matchedRawName = null;

      for (const line of fields.rawLines) {
        const result = matchTeamMember(line, members);
        if (result.matches && result.score > bestScore) {
          bestScore = result.score;
          bestMember = { id: result.memberId!, name: result.memberName! };
          matchedRawName = result.memberName;
        }
      }

      if (bestMember && bestScore >= 70) {
        memberMatch = bestMember;
        memberConfidence = bestScore;
        fields.recipientName = matchedRawName;
        fields.recipientNameSource = 'layout';
        console.log(`[DocIntel] Auto-matched member from raw text lines: "${matchedRawName}" (Score: ${bestScore})`);
      }
    }

    return res.json({
      ...fields,
      certificationMatch: matchResult.bestMatch,
      confidence: matchResult.confidence,
      matchedLine: matchResult.matchedLine,
      suggestions: matchResult.suggestions,
      memberMatch,
      memberConfidence,
      configured: true,
    });
  } catch (err: any) {
    console.error('Document Intelligence error:', err?.message);
    return res.json({ completionDate: null, expiryDate: null, credentialId: null, recipientName: null, recipientNameSource: null, rawLines: [], rawFields: {}, certificationMatch: null, confidence: 0, suggestions: [], memberMatch: null, memberConfidence: 0, configured: true, error: err?.message });
  }
});

// POST /api/certifications/certificate/upload-universal
router.post('/certificate/upload-universal', upload.single('certificate'), async (req: Request, res: Response) => {
  const { memberId, certificationId, expiryDate, completionDate } = req.body;
  if (!memberId || !certificationId) throw new AppError('memberId and certificationId are required', 400);

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { name: true }
  });
  if (!member) throw new AppError('Member not found', 404);

  // Check if AssignedCertification exists (with cert + certification name for error message)
  let assignment: any = await prisma.assignedCertification.findUnique({
    where: {
      memberId_certificationId: {
        memberId,
        certificationId,
      },
    },
    include: {
      certification: { select: { name: true } },
    },
  });

  // 🚫 Duplicate guard: block if a real certificate has already been uploaded for this pair
  if (assignment && assignment.certificateUrl) {
    return res.status(409).json({
      error: 'DUPLICATE_CERTIFICATE',
      message: `${member.name} already has a certificate uploaded for ${(assignment as any).certification.name}.`,
      existingAssignmentId: assignment.id,
    });
  }

  // Upload to blob storage / ADLS Gen2 if file provided
  let url = assignment ? assignment.certificateUrl : null;
  let uploadDate = assignment ? assignment.uploadDate : null;
  let originalFilename = assignment ? (assignment as any).originalFilename : null;

  if (req.file) {
    const uploadResult = await uploadFile(
      CONTAINERS.CERTIFICATES,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      memberId,
      member.name
    );
    url = uploadResult.url;
    uploadDate = new Date();
    originalFilename = req.file.originalname;
  }

  const finalCompletionDate = completionDate ? new Date(completionDate) : new Date();
  const finalExpiryDate = expiryDate ? new Date(expiryDate) : null;

  let finalStatus = 'COMPLETED';
  if (finalExpiryDate && finalExpiryDate < new Date()) {
    finalStatus = 'EXPIRED';
  }

  if (assignment) {
    // Delete existing certificate if new file is uploaded
    if (req.file && assignment.certificateUrl) {
      const blobName = extractBlobName(assignment.certificateUrl);
      await deleteFile(CONTAINERS.CERTIFICATES, blobName).catch(console.error);
    }

    assignment = await prisma.assignedCertification.update({
      where: { id: assignment.id },
      data: {
        status: finalStatus as any,
        completionDate: finalCompletionDate,
        expiryDate: finalExpiryDate,
        progress: 100,
        certificateUrl: url,
        originalFilename: originalFilename,
        uploadDate: uploadDate,
      },
    });
  } else {
    // Create new assignment with a default deadline (3 months from now)
    const deadline = new Date();
    deadline.setMonth(deadline.getMonth() + 3);

    assignment = await prisma.assignedCertification.create({
      data: {
        memberId,
        certificationId,
        assignedDate: new Date(),
        deadline,
        priority: 'MEDIUM',
        progress: 100,
        status: finalStatus as any,
        completionDate: finalCompletionDate,
        expiryDate: finalExpiryDate,
        certificateUrl: url,
        originalFilename: originalFilename,
        uploadDate: uploadDate,
      },
    });
  }

  // Fetch certification name for the notification message
  const certName = await prisma.certification.findUnique({
    where: { id: certificationId },
    select: { name: true },
  });

  // 🔔 Fire notification (mirrors per-row upload behaviour)
  await prisma.notification.create({
    data: {
      memberId,
      type: 'CERTIFICATE_UPLOADED',
      title: 'Certificate Uploaded',
      message: `Certificate for ${certName?.name ?? 'Unknown Certification'} uploaded for ${member.name}`,
    },
  });

  await prisma.activityLog.create({
    data: {
      category: 'Certifications',
      action: 'UPLOAD',
      details: `Uploaded certificate "${originalFilename || 'Unknown'}" for ${member.name} (${certName?.name ?? 'Unknown Certification'})`,
    }
  });

  res.json(assignment);
});

// POST /api/certifications/assignments/:id/certificate - Upload certificate
router.post('/assignments/:id/certificate', upload.single('certificate'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { credentialId, expiryDate, completionDate } = req.body;

  const existing = await prisma.assignedCertification.findUnique({
    where: { id },
    include: { member: true, certification: true },
  });
  if (!existing) throw new AppError('Assignment not found', 404);

  let url = existing.certificateUrl;
  let uploadDate = existing.uploadDate;
  let originalFilename = existing.originalFilename;

  if (req.file) {
    if (existing.certificateUrl) {
      const blobName = extractBlobName(existing.certificateUrl);
      await deleteFile(CONTAINERS.CERTIFICATES, blobName).catch(console.error);
    }

    const uploadResult = await uploadFile(
      CONTAINERS.CERTIFICATES,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      existing.memberId,
      existing.member.name
    );
    url = uploadResult.url;
    uploadDate = new Date();
    originalFilename = req.file.originalname;
  }

  const finalCompletionDate = completionDate ? new Date(completionDate) : (existing.completionDate || new Date());
  const finalExpiryDate = expiryDate ? new Date(expiryDate) : existing.expiryDate;
  
  let finalStatus = 'COMPLETED';
  if (finalExpiryDate && finalExpiryDate < new Date()) {
    finalStatus = 'EXPIRED';
  }

  const updated = await prisma.assignedCertification.update({
    where: { id },
    data: {
      certificateUrl: url,
      originalFilename: originalFilename,
      uploadDate: uploadDate,
      ...(credentialId && { credentialId }),
      status: finalStatus as any,
      completionDate: finalCompletionDate,
      expiryDate: finalExpiryDate,
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

  await prisma.activityLog.create({
    data: {
      category: 'Certifications',
      action: 'UPLOAD',
      details: `Uploaded certificate "${originalFilename || 'Unknown'}" for ${existing.member.name} (${existing.certification.name})`,
    }
  });

  res.json(updated);
});

// DELETE /api/certifications/assignments/:id/certificate - Delete certificate
router.delete('/assignments/:id/certificate', async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.assignedCertification.findUnique({
    where: { id },
  });
  if (!existing) throw new AppError('Assignment not found', 404);

  // 1. Delete file from storage if it exists
  if (existing.certificateUrl) {
    try {
      const blobName = extractBlobName(existing.certificateUrl);
      await deleteFile(CONTAINERS.CERTIFICATES, blobName);
    } catch (err: any) {
      console.error('[Delete Certificate] Failed to delete blob:', err?.message);
    }
  }

  // 2. Derive status: if deadline is passed, status is OVERDUE, otherwise NOT_STARTED
  const isOverdue = new Date(existing.deadline) < new Date();
  const newStatus = isOverdue ? 'OVERDUE' : 'NOT_STARTED';

  // 3. Clear database fields
  const updated = await prisma.assignedCertification.update({
    where: { id },
    data: {
      certificateUrl: null,
      uploadDate: null,
      completionDate: null,
      expiryDate: null,
      credentialId: null,
      progress: 0,
      status: newStatus as any,
    },
  });

  await prisma.activityLog.create({
    data: {
      category: 'Certifications',
      action: 'DELETE',
      details: `Deleted certificate file for ${existing.memberId} (Assignment ID: ${existing.id})`,
    }
  });

  res.json({ message: 'Certificate deleted successfully', assignment: updated });
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

  await prisma.activityLog.create({
    data: {
      category: 'Certifications',
      action: 'DELETE',
      details: `Deleted certification assignment ID: ${existing.id}`,
    }
  });

  res.json({ message: 'Assignment deleted' });
});

// ============ EDIT REQUESTS ============

// POST /api/certifications/assignments/:id/request-edit
router.post('/assignments/:id/request-edit', async (req: Request, res: Response) => {
  const { proposedChanges, requestedBy } = req.body;
  if (!proposedChanges || !requestedBy) throw new AppError('proposedChanges and requestedBy are required', 400);

  const existing = await prisma.assignedCertification.findUnique({
    where: { id: req.params.id },
    include: { member: true, certification: true },
  });
  if (!existing) throw new AppError('Assignment not found', 404);

  const editRequest = await (prisma as any).certificateEditRequest.create({
    data: {
      assignmentId: req.params.id,
      proposedChanges,
      requestedBy,
    },
    include: { assignment: { include: { member: true, certification: true } } },
  });

  // Notify admins
  await prisma.notification.create({
    data: {
      targetRole: 'Admin',
      type: 'CERTIFICATE_EDIT_REQUESTED',
      title: 'Certificate Edit Requested',
      message: `${requestedBy} requested an edit for ${existing.member.name}'s ${existing.certification.name} certificate.`,
    },
  });

  res.status(201).json(editRequest);
});

// GET /api/certifications/edit-requests
router.get('/edit-requests', async (req: Request, res: Response) => {
  const { status } = req.query;
  const where: any = {};
  if (status) where.status = status;

  const requests = await (prisma as any).certificateEditRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      assignment: {
        include: {
          member: { select: { id: true, name: true } },
          certification: { select: { id: true, name: true, provider: true } },
        },
      },
    },
  });

  res.json(requests);
});

// POST /api/certifications/edit-requests/:id/approve
router.post('/edit-requests/:id/approve', async (req: Request, res: Response) => {
  const { reviewedBy, reviewNotes } = req.body;

  const editReq = await (prisma as any).certificateEditRequest.findUnique({
    where: { id: req.params.id },
  });
  if (!editReq) throw new AppError('Edit request not found', 404);
  if (editReq.status !== 'PENDING') throw new AppError('Edit request is not pending', 400);

  const changes = editReq.proposedChanges as Record<string, any>;

  // Apply changes to live record
  const updateData: any = {};
  if (changes.completionDate) updateData.completionDate = new Date(changes.completionDate);
  if (changes.expiryDate !== undefined) updateData.expiryDate = changes.expiryDate ? new Date(changes.expiryDate) : null;
  if (changes.credentialId !== undefined) updateData.credentialId = changes.credentialId;

  // Re-derive status based on new dates
  if (updateData.completionDate || updateData.expiryDate !== undefined) {
    const existing = await prisma.assignedCertification.findUnique({ where: { id: editReq.assignmentId } });
    const finalExpiry = updateData.expiryDate !== undefined ? updateData.expiryDate : existing?.expiryDate;
    if (updateData.completionDate || existing?.completionDate) {
      updateData.status = (finalExpiry && new Date(finalExpiry) < new Date()) ? 'EXPIRED' : 'COMPLETED';
    }
  }

  await prisma.assignedCertification.update({
    where: { id: editReq.assignmentId },
    data: updateData,
  });

  const updated = await (prisma as any).certificateEditRequest.update({
    where: { id: req.params.id },
    data: {
      status: 'APPROVED',
      reviewedBy: reviewedBy || 'Admin',
      reviewNotes: reviewNotes || null,
      reviewedAt: new Date(),
    },
  });

  res.json(updated);
});

// POST /api/certifications/edit-requests/:id/reject
router.post('/edit-requests/:id/reject', async (req: Request, res: Response) => {
  const { reviewedBy, reviewNotes } = req.body;

  const editReq = await (prisma as any).certificateEditRequest.findUnique({ where: { id: req.params.id } });
  if (!editReq) throw new AppError('Edit request not found', 404);
  if (editReq.status !== 'PENDING') throw new AppError('Edit request is not pending', 400);

  const updated = await (prisma as any).certificateEditRequest.update({
    where: { id: req.params.id },
    data: {
      status: 'REJECTED',
      reviewedBy: reviewedBy || 'Admin',
      reviewNotes: reviewNotes || null,
      reviewedAt: new Date(),
    },
  });

  res.json(updated);
});

export default router;
