import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { uploadFile, deleteFile, extractBlobName, CONTAINERS, sanitizeDirectoryName, getContainerNameFromUrl } from '../services/blobStorage';
import { BlobServiceClient } from '@azure/storage-blob';
import { analyzePresalesDocWithAI } from '../services/aiExtractor';
import { generateProposalSummary, generateSingleSection } from '../services/azureOpenAIService';
import { AppError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// Multer config for presales doc uploads (PDF, DOCX, TXT, EML — in-memory, 15 MB)
const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'message/rfc822',
      'application/octet-stream', // some EML parsers send this
    ];
    const ext = file.originalname.toLowerCase().split('.').pop();
    if (allowed.includes(file.mimetype) || ['pdf','docx','txt','eml'].includes(ext || '')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, TXT, and EML files are accepted'));
    }
  },
});

// Multer config for proposal source docs — multi-file, same types
const proposalUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().split('.').pop();
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype) || ['pdf','docx','txt'].includes(ext || '')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, and TXT files are accepted for proposal generation'));
    }
  },
});

// Standardized stage lists
const pnbStages = [
  'Opportunity & Qualification',
  'Requirement Analysis',
  'Solution & Estimation',
  'Proposal & Pricing',
  'Client Engagement',
  'Project Award & Handover'
];

const tnmStages = [
  'Requirement & Resource Planning',
  'Rate Card & Proposal',
  'Client Approval & Onboarding',
  'Execution & Tracking',
  'Change Management',
  'Billing & Project Closure'
];

// GET /api/presales
// List all PreSales opportunities ordered by creation date
router.get('/', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const where: any = {};
  if (!user?.permissions?.manageTeam) {
    where.assignments = { some: { memberId: user?.teamMemberId } };
  }

  const opportunities = await prisma.preSalesOpportunity.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });
  res.json({ data: opportunities });
});

// POST /api/presales
// Create PNB and/or TNM timelines conditionally
router.post('/', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) throw new AppError('Forbidden: Only Admins can create opportunities', 403);

  const { name, clientName, createPnb, createTnm } = req.body;

  if (!name || !clientName) {
    return res.status(400).json({ error: 'name and clientName are required.' });
  }

  if (!createPnb && !createTnm) {
    return res.status(400).json({ error: 'At least one timeline option (PNB or TNM) must be checked.' });
  }

  const createdRecords: any[] = [];

  // Create PNB record
  if (createPnb) {
    const pnbRecord = await prisma.preSalesOpportunity.create({
      data: {
        name: name.trim(),
        clientName: clientName.trim(),
        account: 'PNB',
        stages: pnbStages,
        currentStageIndex: 0
      }
    });
    createdRecords.push(pnbRecord);
  }

  // Create TNM record
  if (createTnm) {
    const tnmRecord = await prisma.preSalesOpportunity.create({
      data: {
        name: name.trim(),
        clientName: clientName.trim(),
        account: 'TNM',
        stages: tnmStages,
        currentStageIndex: 0
      }
    });
    createdRecords.push(tnmRecord);
  }

  // Return the first created record as frontend expects { data: PreSalesOpportunity }
  res.status(201).json({ data: createdRecords[0] });
});

// Shared helper: convert progress percent to stage index
function percentToStageIndex(percent: number, totalStages: number): number {
  return Math.min(totalStages - 1, Math.floor((percent / 100) * totalStages));
}

// Shared helper: get the lower-bound percent for a given stage index
function stageLowerBound(stageIndex: number, totalStages: number): number {
  return Math.round((stageIndex / totalStages) * 100);
}

// PATCH /api/presales/:id/stage
// Manual dot-click: sets currentStageIndex AND syncs progressPercent to stage boundary
// Optional body fields: source ('manual'|'ai_suggested'), reasoning, blobUrl — for audit log
router.patch('/:id/stage', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { stageIndex, source, reasoning, blobUrl } = req.body;

  if (stageIndex === undefined || typeof stageIndex !== 'number') {
    return res.status(400).json({ error: 'stageIndex is required.' });
  }

  const opportunity = await prisma.preSalesOpportunity.findUnique({ 
    where: { id },
    include: { assignments: true }
  });
  if (!opportunity) return res.status(404).json({ error: 'Opportunity not found.' });

  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam && !opportunity.assignments.some((m: any) => m.memberId === user?.teamMemberId)) {
    throw new AppError('Forbidden: You are not assigned to this opportunity', 403);
  }
  if (stageIndex < 0 || stageIndex >= opportunity.stages.length) {
    return res.status(400).json({ error: 'Invalid stage index.' });
  }

  const previousStage = opportunity.stages[opportunity.currentStageIndex];
  const newStage = opportunity.stages[stageIndex];
  const newProgress = stageLowerBound(stageIndex, opportunity.stages.length);

  const updated = await prisma.preSalesOpportunity.update({
    where: { id },
    data: { currentStageIndex: stageIndex, progressPercent: newProgress },
  });

  await prisma.stageChangeLog.create({
    data: {
      opportunityId: id,
      track: opportunity.account,
      previousStage,
      newStage,
      source: source || 'manual',
      reasoning: reasoning || null,
      blobUrl: blobUrl || null,
    },
  });

  res.json({ data: updated });
});

// POST /api/presales/:id/members
router.post('/:id/members', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) throw new AppError('Forbidden: Only Admins can assign members', 403);

  const { id } = req.params;
  const { memberId, role } = req.body;

  const opportunity = await prisma.preSalesOpportunity.findUnique({ where: { id } });
  if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });

  const assignment = await prisma.projectMember.create({
    data: {
      opportunityId: id,
      memberId,
      role: role || 'Member'
    },
    include: { member: true }
  });
  
  res.status(201).json({ data: assignment });
});

// DELETE /api/presales/:id/members/:memberId
router.delete('/:id/members/:memberId', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) throw new AppError('Forbidden: Only Admins can unassign members', 403);

  const { id, memberId } = req.params;

  const assignment = await prisma.projectMember.findFirst({
    where: { opportunityId: id, memberId }
  });

  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found' });
  }

  await prisma.projectMember.delete({ where: { id: assignment.id } });
  res.json({ success: true });
});

// PATCH /api/presales/:id/progress
// AI-driven incremental progress update (does NOT require a stage jump)
// Body: { incrementPercent: number, source: 'ai_suggested', reasoning?: string, blobUrl?: string }
router.patch('/:id/progress', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { incrementPercent, source, reasoning, blobUrl, originalFilename } = req.body;

  if (incrementPercent === undefined || typeof incrementPercent !== 'number') {
    return res.status(400).json({ error: 'incrementPercent (number) is required.' });
  }

  const opportunity = await prisma.preSalesOpportunity.findUnique({ 
    where: { id },
    include: { assignments: true }
  });
  if (!opportunity) return res.status(404).json({ error: 'Opportunity not found.' });

  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam && !opportunity.assignments.some((m: any) => m.memberId === user?.teamMemberId)) {
    throw new AppError('Forbidden: You are not assigned to this opportunity', 403);
  }

  const oldPercent = opportunity.progressPercent;
  const newPercent = Math.min(100, Math.max(0, oldPercent + incrementPercent));
  const oldStageIndex = opportunity.currentStageIndex;
  const newStageIndex = percentToStageIndex(newPercent, opportunity.stages.length);

  const updated = await prisma.preSalesOpportunity.update({
    where: { id },
    data: {
      progressPercent: newPercent,
      currentStageIndex: newStageIndex,
    },
  });

  await prisma.stageChangeLog.create({
    data: {
      opportunityId: id,
      track: opportunity.account,
      previousStage: opportunity.stages[oldStageIndex],
      newStage: opportunity.stages[newStageIndex],
      source: source || 'ai_suggested',
      reasoning: reasoning ? `${reasoning} (Progress: ${oldPercent}% -> ${newPercent}%)` : `Progress: ${oldPercent}% -> ${newPercent}%`,
      blobUrl: blobUrl || null,
      originalFilename: originalFilename || null,
    },
  });

  res.json({ data: updated });
});

// POST /api/presales/:id/reset
// Manually reset an opportunity's progress to 0% and Stage 1
router.post('/:id/reset', async (req: Request, res: Response) => {
  const { id } = req.params;

  const opportunity = await prisma.preSalesOpportunity.findUnique({ 
    where: { id },
    include: { assignments: true }
  });
  if (!opportunity) return res.status(404).json({ error: 'Opportunity not found.' });

  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam && !opportunity.assignments.some((m: any) => m.memberId === user?.teamMemberId)) {
    throw new AppError('Forbidden: You are not assigned to this opportunity', 403);
  }

  const oldStage = opportunity.stages[opportunity.currentStageIndex];
  
  const updated = await prisma.preSalesOpportunity.update({
    where: { id },
    data: {
      progressPercent: 0,
      currentStageIndex: 0,
    },
  });

  await prisma.stageChangeLog.create({
    data: {
      opportunityId: id,
      track: opportunity.account,
      previousStage: oldStage,
      newStage: opportunity.stages[0],
      source: 'manual',
      reasoning: 'Progress manually reset to 0%.',
    },
  });

  res.json({ data: updated });
});


// POST /api/presales/analyze-doc
// Upload a document (PDF/DOCX/TXT/EML) and have Groq detect track + stage
router.post('/analyze-doc', docUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError('No file uploaded. Please attach a PDF, DOCX, TXT, or EML file.', 400);
  }

  const { pnbOppId, tnmOppId, opportunityName, clientName } = req.body;

  if (!opportunityName || !clientName) {
    throw new AppError('opportunityName and clientName are required.', 400);
  }

  // ── 1. Fetch current stages + progress for context ──────────────────────────
  let pnbCurrentStage: string | null = null;
  let pnbCurrentPercent = 0;
  let tnmCurrentStage: string | null = null;
  let tnmCurrentPercent = 0;

  if (pnbOppId) {
    const pnbOpp = await prisma.preSalesOpportunity.findUnique({ where: { id: pnbOppId } });
    if (pnbOpp) {
      pnbCurrentStage = pnbOpp.stages[pnbOpp.currentStageIndex];
      pnbCurrentPercent = pnbOpp.progressPercent;
    }
  }
  if (tnmOppId) {
    const tnmOpp = await prisma.preSalesOpportunity.findUnique({ where: { id: tnmOppId } });
    if (tnmOpp) {
      tnmCurrentStage = tnmOpp.stages[tnmOpp.currentStageIndex];
      tnmCurrentPercent = tnmOpp.progressPercent;
    }
  }

  // ── 2. Extract plain text ───────────────────────────────────────────────────
  let plainText = '';
  const mimeType = req.file.mimetype;
  const originalName = req.file.originalname.toLowerCase();
  const ext = originalName.split('.').pop() || '';

  if (mimeType === 'application/pdf' || ext === 'pdf') {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: req.file.buffer });
    try {
      const result = await parser.getText();
      plainText = result.text;
    } catch (err: any) {
      throw new AppError(`Failed to parse PDF: ${err.message || err}`, 500);
    } finally {
      if (typeof parser.destroy === 'function') await parser.destroy();
    }
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    const mammoth = require('mammoth') as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> };
    const result = await mammoth.extractRawText({ buffer: req.file.buffer });
    plainText = result.value;
  } else if (mimeType === 'text/plain' || ext === 'txt') {
    plainText = req.file.buffer.toString('utf-8');
  } else if (mimeType === 'message/rfc822' || ext === 'eml') {
    // Basic EML: strip headers (everything before the first blank line) and decode body
    const raw = req.file.buffer.toString('utf-8');
    const blankLineIdx = raw.indexOf('\n\n');
    plainText = blankLineIdx !== -1 ? raw.substring(blankLineIdx + 2) : raw;
    // Strip quoted-printable soft line breaks
    plainText = plainText.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    );
  } else {
    // Fallback: try UTF-8 text decode
    plainText = req.file.buffer.toString('utf-8');
  }

  if (!plainText || plainText.trim().length < 20) {
    throw new AppError('Could not extract readable text from the uploaded file. Please check it is not an image-only scan.', 422);
  }

  // ── 3. Groq analysis ────────────────────────────────────────────────────────
  const analysis = await analyzePresalesDocWithAI(
    plainText,
    pnbCurrentStage || 'Unknown', pnbCurrentPercent,
    tnmCurrentStage || 'Unknown', tnmCurrentPercent
  );

  // Compute what the new percent would be if confirmed (for the frontend confirmation prompt)
  const currentPercent = analysis.detected_track === 'PNB' ? pnbCurrentPercent : tnmCurrentPercent;
  const newTotalPercent = Math.min(100, currentPercent + analysis.suggested_increment_percent);

  // ── 4. Upload doc to Azure Blob ─────────────────────────────────────────────
  const slug = sanitizeDirectoryName(`${opportunityName}--${clientName}`);
  // Use blob name with folder path so it groups under the opportunity
  const blobNameWithPath = `${slug}/analyzed-docs/${Date.now()}-${req.file.originalname}`;
  let blobUrl: string | null = null;
  try {
    const uploadResult = await uploadFile(
      CONTAINERS.PRESALES_DOCS,
      req.file.buffer,
      blobNameWithPath,
      mimeType
    );
    blobUrl = uploadResult.url;
  } catch (uploadErr) {
    console.error('[presales analyze-doc] Azure upload failed (non-fatal):', uploadErr);
    // Upload failure is non-fatal — analysis result is still returned
  }

  await prisma.activityLog.create({
    data: {
      category: 'PreSales',
      action: 'UPLOAD',
      details: `Analyzed document "${req.file.originalname}" for ${clientName} - ${opportunityName}`,
    }
  });

  res.json({ data: { analysis, blobUrl, originalFilename: req.file.originalname, currentPercent, newTotalPercent } });
});

router.delete('/', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) throw new AppError('Forbidden: Only Admins can delete opportunities', 403);

  const name = req.query.name as string;
  const clientName = req.query.clientName as string;
  const account = req.query.account as string;

  if (!name || !clientName) {
    return res.status(400).json({ error: 'name and clientName parameters are required.' });
  }

  const whereClause: any = {
    name: { equals: name.trim(), mode: 'insensitive' },
    clientName: { equals: clientName.trim(), mode: 'insensitive' }
  };

  if (account) {
    whereClause.account = { equals: account.trim(), mode: 'insensitive' };
  }

  await prisma.preSalesOpportunity.deleteMany({
    where: whereClause
  });

  res.json({ success: true });
});

// PUT /api/presales
// Update opportunity and client names for all matching timelines
router.put('/', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) throw new AppError('Forbidden: Only Admins can update opportunities', 403);

  const { oldName, oldClientName, newName, newClientName } = req.body;

  if (!oldName || !oldClientName || !newName || !newClientName) {
    return res.status(400).json({ error: 'oldName, oldClientName, newName, and newClientName are required.' });
  }

  const updated = await prisma.preSalesOpportunity.updateMany({
    where: {
      name: { equals: oldName.trim(), mode: 'insensitive' },
      clientName: { equals: oldClientName.trim(), mode: 'insensitive' }
    },
    data: {
      name: newName.trim(),
      clientName: newClientName.trim()
    }
  });

  res.json({ success: true, count: updated.count });
});

// GET /api/presales/docs
// Fetch docs (stageChangeLogs with blobUrl) for specific opportunities
router.get('/docs', async (req: Request, res: Response) => {
  const oppIds = (req.query.oppIds as string)?.split(',').filter(Boolean);
  console.log('[getDocs] received oppIds query:', req.query.oppIds, 'parsed as:', oppIds);
  if (!oppIds || oppIds.length === 0) {
    return res.status(400).json({ error: 'oppIds parameter is required.' });
  }

  const user = (req as AuthRequest).user;
  let allowedOppIds = oppIds;

  if (!user?.permissions?.manageTeam) {
    const userAssignments = await prisma.projectMember.findMany({
      where: { memberId: user?.teamMemberId as string, opportunityId: { in: oppIds } }
    });
    allowedOppIds = userAssignments.map(a => a.opportunityId).filter(Boolean) as string[];
  }

  if (allowedOppIds.length === 0) {
    return res.json({ data: [] });
  }

  const logs = await prisma.stageChangeLog.findMany({
    where: {
      opportunityId: { in: allowedOppIds },
      blobUrl: { not: null }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json({ data: logs });
});

// DELETE /api/presales/docs/:id
router.delete('/docs/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const log = await prisma.stageChangeLog.findUnique({ where: { id } });
  if (!log) throw new AppError('Document record not found', 404);
  if (!log.blobUrl) throw new AppError('Document already deleted or missing', 400);

  // Delete from ADLS Gen2
  try {
    const blobName = extractBlobName(log.blobUrl);
    await deleteFile(CONTAINERS.PRESALES_DOCS, blobName);
  } catch (err: any) {
    console.error('[Delete Doc] Failed to delete blob:', err?.message);
    // Non-fatal, we still clear the DB so UI matches actual state
  }

  const updated = await prisma.stageChangeLog.update({
    where: { id },
    data: {
      blobUrl: null,
      reasoning: log.reasoning ? `${log.reasoning}\n\n[Source document deleted]` : '[Source document deleted]'
    }
  });

  await prisma.activityLog.create({
    data: {
      category: 'PreSales',
      action: 'DELETE',
      details: `Deleted presales document "${log.originalFilename || 'Unknown'}" (Log ID: ${log.id})`,
    }
  });

  res.json({ data: updated });
});

// GET /api/presales/:id
// Get details of a single PreSales Opportunity
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const opp = await prisma.preSalesOpportunity.findUnique({
      where: { id },
      include: {
        assignments: {
          include: { member: true }
        },
        updates: {
          include: { member: true },
          orderBy: { createdAt: 'desc' }
        },
        meetingRecords: {
          include: { actionItems: true },
          orderBy: { createdAt: 'desc' }
        },
        files: {
          orderBy: { uploadedAt: 'desc' }
        },
        links: {
          orderBy: { addedAt: 'desc' }
        },
        notes: {
          orderBy: { updatedAt: 'desc' }
        }
      }
    });

    if (!opp) return res.status(404).json({ error: 'Opportunity not found' });

    const user = (req as AuthRequest).user;
    if (!user?.permissions?.manageTeam && !opp.assignments.some((a: any) => a.memberId === user?.teamMemberId)) {
      throw new AppError('Forbidden: You are not assigned to this opportunity', 403);
    }

    res.json({ data: opp });
  } catch (err: any) {
    console.error('[GET Opp]', err);
    res.status(500).json({ error: 'Failed to fetch opportunity' });
  }
});

// PATCH /api/presales/:id
// Update PreSales Opportunity description and proposal summary sections
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    description,
    executiveSummary,
    scopeOfWork,
    architecture,
    implementationApproach,
    deliveryApproach,
    assumptions,
    outOfScope,
    timelines,
    commercials,
    others
  } = req.body;

  try {
    const opp = await prisma.preSalesOpportunity.findUnique({
      where: { id },
      include: { assignments: true }
    });
    if (!opp) throw new AppError('Opportunity not found', 404);

    const user = (req as AuthRequest).user;
    if (!user?.permissions?.manageTeam && !opp.assignments.some((m: any) => m.memberId === user?.teamMemberId)) {
      throw new AppError('Forbidden: You are not assigned to this opportunity', 403);
    }

    const updated = await prisma.preSalesOpportunity.update({
      where: { id },
      data: { 
        ...(description !== undefined && { description }),
        ...(executiveSummary !== undefined && { executiveSummary }),
        ...(scopeOfWork !== undefined && { scopeOfWork }),
        ...(architecture !== undefined && { architecture }),
        ...(implementationApproach !== undefined && { implementationApproach }),
        ...(deliveryApproach !== undefined && { deliveryApproach }),
        ...(assumptions !== undefined && { assumptions }),
        ...(outOfScope !== undefined && { outOfScope }),
        ...(timelines !== undefined && { timelines }),
        ...(commercials !== undefined && { commercials }),
        ...(others !== undefined && { others })
      }
    });
    res.json({ data: updated });
  } catch (err: any) {
    console.error('[PATCH Opp]', err);
    res.status(500).json({ error: 'Failed to update opportunity' });
  }
});

// POST /api/presales/:id/convert
// Convert an opportunity to a project
router.post('/:id/convert', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const opp = await prisma.preSalesOpportunity.findUnique({ where: { id } });
    if (!opp) return res.status(404).json({ error: 'Opportunity not found' });

    const user = (req as AuthRequest).user;
    if (!user?.permissions?.manageTeam) throw new AppError('Forbidden: Only Admins can convert opportunities to projects', 403);

    // Create the Project
    const project = await prisma.project.create({
      data: {
        name: opp.name,
        client: opp.clientName,
        description: opp.description || `Converted from PreSales Opportunity (Account: ${opp.account})`,
        startDate: new Date(),
        status: 'PLANNING'
      }
    });

    // Migrate relationships to point to the new Project AND keep them on the opportunity (or just update them)
    // We update them to belong to the new project.
    await prisma.projectMember.updateMany({
      where: { opportunityId: id },
      data: { projectId: project.id }
    });
    
    await prisma.projectUpdate.updateMany({
      where: { opportunityId: id },
      data: { projectId: project.id }
    });

    await prisma.projectFile.updateMany({
      where: { opportunityId: id },
      data: { projectId: project.id }
    });

    await prisma.projectLink.updateMany({
      where: { opportunityId: id },
      data: { projectId: project.id }
    });

    await prisma.projectNote.updateMany({
      where: { opportunityId: id },
      data: { projectId: project.id }
    });

    await prisma.meetingRecord.updateMany({
      where: { opportunityId: id },
      data: { projectId: project.id }
    });

    await prisma.activityLog.create({
      data: {
        category: 'Project',
        action: 'CREATE',
        details: `Converted PreSales Opportunity "${opp.name}" to Project.`,
      }
    });

    res.json({ data: project });
  } catch (err: any) {
    console.error('[POST Convert Opp]', err);
    res.status(500).json({ error: 'Failed to convert opportunity' });
  }
});

// ── PROPOSAL SUMMARY GENERATION ─────────────────────────────────────────────
// POST /api/presales/:id/generate-proposal
// Upload 1–10 docs, Groq generates 9-section structured description.
//
// CRITICAL: This route writes ONLY to the nine proposal columns:
//   executiveSummary, scopeOfWork, architecture, implementationApproach,
//   deliveryApproach, assumptions, outOfScope, timelines, commercials,
//   sourceDocuments, descriptionGeneratedAt.
// It NEVER updates currentStageIndex, progressPercent, or any stage field.
// Stage/progress is managed exclusively by PATCH /:id/stage, PATCH /:id/progress, and POST /:id/reset.
router.post('/:id/generate-proposal', proposalUpload.array('files', 10), async (req: Request, res: Response) => {
  const { id } = req.params;

  const files = req.files as Express.Multer.File[] | undefined;
  let existingBlobUrls: string[] = [];
  if (req.body.existingBlobUrls) {
    try {
      existingBlobUrls = JSON.parse(req.body.existingBlobUrls);
    } catch (e) {
      console.warn('[generate-proposal] Failed to parse existingBlobUrls:', e);
    }
  }

  if ((!files || files.length === 0) && existingBlobUrls.length === 0) {
    throw new AppError('No files uploaded or kept. Please attach or select at least one PDF, DOCX, or TXT file.', 400);
  }

  const opportunity = await prisma.preSalesOpportunity.findUnique({ 
    where: { id },
    include: { assignments: true }
  });
  if (!opportunity) throw new AppError('Opportunity not found.', 404);

  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam && !opportunity.assignments.some((m: any) => m.memberId === user?.teamMemberId)) {
    throw new AppError('Forbidden: You are not assigned to this opportunity', 403);
  }

  const currentDocs = (opportunity.sourceDocuments as any[]) || [];
  const keptDocs = currentDocs.filter((doc: any) => existingBlobUrls.includes(doc.blobUrl));

  // Helper to download blob to buffer
  async function downloadBlobToBuffer(blobUrl: string): Promise<Buffer> {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
    if (!connectionString) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured.');
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const container = getContainerNameFromUrl(blobUrl);
    const blobName = extractBlobName(blobUrl);
    
    const containerClient = blobServiceClient.getContainerClient(container);
    const blobClient = containerClient.getBlobClient(blobName);
    const downloadResponse = await blobClient.download();
    
    const chunks: Buffer[] = [];
    const stream = downloadResponse.readableStreamBody!;
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  function getMimetypeFromUrl(url: string): string {
    const ext = url.toLowerCase().split('.').pop() || '';
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return 'text/plain';
  }

  // ── 1. Extract text from kept and new files ──────────────────────────
  const textSegments: string[] = [];

  async function extractText(file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<string> {
    const mimeType = file.mimetype;
    const ext = file.originalname.toLowerCase().split('.').pop() || '';

    if (mimeType === 'application/pdf' || ext === 'pdf') {
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: file.buffer });
      try {
        const result = await parser.getText();
        return result.text;
      } finally {
        if (typeof parser.destroy === 'function') await parser.destroy();
      }
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx'
    ) {
      const mammoth = require('mammoth') as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> };
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value;
    } else {
      // TXT fallback
      return file.buffer.toString('utf-8');
    }
  }

  // A. Process existing files being kept
  for (const doc of keptDocs) {
    try {
      console.log(`[generate-proposal] Re-extracting text from existing blob: ${doc.fileName}`);
      const buffer = await downloadBlobToBuffer(doc.blobUrl);
      const text = await extractText({
        buffer,
        mimetype: getMimetypeFromUrl(doc.blobUrl),
        originalname: doc.fileName,
      });
      console.log(`[generate-proposal] Extracted ${text?.length || 0} characters from existing "${doc.fileName}"`);
      if (text && text.trim().length > 5) {
        textSegments.push(`--- Document: ${doc.fileName} ---\n${text}`);
      }
    } catch (err: any) {
      console.warn(`[generate-proposal] Failed to extract text from existing doc "${doc.fileName}": ${err.message}`);
    }
  }

  // B. Process newly uploaded files
  const sourceDocsMeta: { fileName: string; blobUrl: string; uploadedAt: string }[] = [];
  const slug = sanitizeDirectoryName(`${id}-${opportunity.name}`);

  if (files && files.length > 0) {
    console.log(`[generate-proposal] Starting text extraction for ${files.length} new file(s)`);
    for (const file of files) {
      try {
        const text = await extractText(file);
        console.log(`[generate-proposal] Extracted ${text?.length || 0} characters from new "${file.originalname}"`);
        if (text && text.trim().length > 5) {
          textSegments.push(`--- Document: ${file.originalname} ---\n${text}`);
        }

        // Upload new file to Azure
        const blobPath = `presales-docs/${slug}/proposal-sources/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const uploadResult = await uploadFile(
          CONTAINERS.PROJECT_DOCS,
          file.buffer,
          blobPath,
          file.mimetype
        );

        // Save as ProjectFile record
        await prisma.projectFile.create({
          data: {
            opportunityId: id,
            name: file.originalname,
            url: uploadResult.url,
            type: file.mimetype,
            size: file.size,
            uploadedBy: 'system-proposal-generator',
          }
        });

        sourceDocsMeta.push({
          fileName: file.originalname,
          blobUrl: uploadResult.url,
          uploadedAt: new Date().toISOString(),
        });
      } catch (err: any) {
        console.warn(`[generate-proposal] Failed to process new file "${file.originalname}": ${err.message}`);
      }
    }
  }

  if (textSegments.length === 0) {
    throw new AppError('Could not extract readable text from any of the uploaded or selected files.', 422);
  }

  const combinedText = textSegments.join('\n\n');
  console.log(`[generate-proposal] Combined text length: ${combinedText.length} characters`);

  // ── 2. Call GPT-5 mini for 9-section proposal summary ──────────────────────────────
  const summary = await generateProposalSummary(combinedText, opportunity.clientName);

  // Combine kept existing docs with new uploads
  const finalSourceDocs = [...keptDocs, ...sourceDocsMeta];

  // ── 3. Persist 10 proposal columns ───────────────────────────────
  const updated = await prisma.preSalesOpportunity.update({
    where: { id },
    data: {
      executiveSummary: summary.executive_summary,
      scopeOfWork: summary.scope_of_work,
      architecture: summary.architecture,
      implementationApproach: summary.implementation_approach,
      deliveryApproach: summary.delivery_approach,
      assumptions: summary.assumptions,
      outOfScope: summary.out_of_scope,
      timelines: summary.timelines,
      commercials: summary.commercials,
      others: summary.others,
      sourceDocuments: finalSourceDocs,
      descriptionGeneratedAt: new Date(),
    },
  });

  await prisma.activityLog.create({
    data: {
      category: 'PreSales',
      action: 'GENERATE_PROPOSAL',
      details: `Generated proposal summary for "${opportunity.name}" (${opportunity.clientName}) from ${finalSourceDocs.length} document(s).`,
    },
  });

  res.json({ data: updated });
});

// POST /api/presales/:id/generate-section
// Upload 1 doc, Groq generates content for ONE specified section.
// Returns the proposed content (or null) but does NOT save to the DB.
router.post('/:id/generate-section', docUpload.single('file'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { sectionName } = req.body;

  if (!req.file) {
    throw new AppError('No file uploaded. Please attach a PDF, DOCX, or TXT file.', 400);
  }
  if (!sectionName) {
    throw new AppError('sectionName is required.', 400);
  }

  const opportunity = await prisma.preSalesOpportunity.findUnique({ 
    where: { id },
    include: { assignments: true }
  });
  if (!opportunity) throw new AppError('Opportunity not found.', 404);

  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam && !opportunity.assignments.some((m: any) => m.memberId === user?.teamMemberId)) {
    throw new AppError('Forbidden: You are not assigned to this opportunity', 403);
  }

  // 1. Extract text from file
  let plainText = '';
  const mimeType = req.file.mimetype;
  const ext = req.file.originalname.toLowerCase().split('.').pop() || '';

  try {
    if (mimeType === 'application/pdf' || ext === 'pdf') {
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: req.file.buffer });
      const result = await parser.getText();
      plainText = result.text;
      if (typeof parser.destroy === 'function') await parser.destroy();
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx'
    ) {
      const mammoth = require('mammoth') as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> };
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      plainText = result.value;
    } else {
      plainText = req.file.buffer.toString('utf-8');
    }
  } catch (err: any) {
    throw new AppError(`Failed to extract text from file: ${err.message}`, 500);
  }

  if (!plainText || plainText.trim().length < 20) {
    throw new AppError('Could not extract readable text from the uploaded file.', 422);
  }

  // 2. Ask Groq for just this section
  const proposedContent = await generateSingleSection(plainText, sectionName);

  // 3. Upload file to Azure and save as ProjectFile so it lands in Opportunity Files
  try {
    const slug = sanitizeDirectoryName(`${id}-${opportunity.name}`);
    const blobPath = `presales-docs/${slug}/proposal-sources/${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const uploadResult = await uploadFile(
      CONTAINERS.PROJECT_DOCS,
      req.file.buffer,
      blobPath,
      req.file.mimetype
    );

    await prisma.projectFile.create({
      data: {
        opportunityId: id,
        name: req.file.originalname,
        url: uploadResult.url,
        type: req.file.mimetype,
        size: req.file.size,
        uploadedBy: 'system-section-generator',
      }
    });

    // Update sourceDocuments JSON to reflect this newly uploaded file for context
    const currentSources = Array.isArray(opportunity.sourceDocuments) ? opportunity.sourceDocuments : [];
    const newSources = [...currentSources, {
      fileName: req.file.originalname,
      blobUrl: uploadResult.url,
      uploadedAt: new Date().toISOString(),
    }];
    await prisma.preSalesOpportunity.update({
      where: { id },
      data: { sourceDocuments: newSources }
    });

  } catch (uploadErr: any) {
    console.error(`[generate-section] Failed to upload "${req.file.originalname}":`, uploadErr.message);
  }

  // 4. Return proposed content without saving it to the section column
  res.json({ data: { proposedContent } });
});

export default router;

