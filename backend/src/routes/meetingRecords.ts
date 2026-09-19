import prisma from '../lib/prisma';
import { Router } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { uploadFile, deleteFile, CONTAINERS, generateSasUrl, extractBlobName, getContainerNameFromUrl, sanitizeDirectoryName } from '../services/blobStorage';
import { generateMeetingMinutes  } from '../services/azureOpenAIService';
import { matchTeamMember, correctNamesInTranscript } from '../utils/fuzzyMatch';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { verifyContextMember, verifyMeetingRecordAccess, verifyActionItemAccess } from '../lib/contextAccess';
import { assertActionItemStatus, onlyIdsOfferedToTheModel, completedActionItemIds, normalizeActionItemStatus, normalizeActionItemPriority, normalizeBlockerStatus } from '../lib/meetingContinuity';
import { AppError } from '../middleware/errorHandler';

// TT-044: this multer instance had no limits and no filter whatsoever. Combined with
// memoryStorage that is an out-of-memory vector — an unbounded body is buffered in
// the process — quite apart from accepting any file type.
//
// The two fields carry very different payloads, so they are filtered separately, to
// match what the UI offers (video/mp4|webm|quicktime for recordings, .txt/.doc/.docx/
// .pdf for transcripts).
const MEETING_RECORDING_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm'];
const MEETING_TRANSCRIPT_EXTENSIONS = ['txt', 'doc', 'docx', 'pdf'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'recordingFile') {
      return MEETING_RECORDING_TYPES.includes(file.mimetype)
        ? cb(null, true)
        : cb(new AppError(`Recordings must be audio or video. Received: ${file.mimetype}`, 400));
    }
    if (file.fieldname === 'transcriptFile') {
      const dot = file.originalname.lastIndexOf('.');
      const ext = dot === -1 ? '' : file.originalname.slice(dot + 1).toLowerCase();
      return MEETING_TRANSCRIPT_EXTENSIONS.includes(ext)
        ? cb(null, true)
        : cb(new AppError(`Transcripts must be ${MEETING_TRANSCRIPT_EXTENSIONS.join(', ')}. Received: .${ext || 'unknown'}`, 400));
    }
    return cb(new AppError(`Unexpected upload field: ${file.fieldname}`, 400));
  },
});

const router = Router({ mergeParams: true });

// These handlers return transcripts, AI minutes and freshly minted Azure SAS
// read URLs, and can trigger paid re-analysis, so the router is authenticated
// and every handler additionally checks the caller belongs to the project or
// opportunity the record hangs off.
//
// The access checks deliberately sit OUTSIDE each handler's try/catch: those
// blocks turn everything into a 500, which would report a 403 as a server
// error. Thrown outside, they reach the centralized error handler intact.
router.use(authenticateToken);


// Helper to extract text from a buffer (reused from CV logic)
async function extractText(buffer: Buffer, originalname: string, mimetype: string): Promise<string> {
  if (mimetype === 'application/pdf') {
    // TT-039: this called PDFParse(buffer) — but in pdf-parse v2 PDFParse is a class, so
    // invoking it without `new` threw a TypeError that the catch below turned into ''.
    // Every PDF transcript upload therefore failed with the generic "could not extract
    // text" 400, with the real cause only in the logs. Matches the other call sites
    // (presales.ts, members.ts, resumeGeneration.ts).
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text || '';
    } catch (e) {
      console.error('[MeetingRecord pdf-parse error]:', e);
      return '';
    } finally {
      if (typeof parser.destroy === 'function') await parser.destroy();
    }
  } else if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword' ||
    originalname.endsWith('.docx') || originalname.endsWith('.doc')
  ) {
    const mammoth = require('mammoth') as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> };
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (e) {
      console.error('[MeetingRecord mammoth error]:', e);
      return '';
    }
  } else if (mimetype === 'text/plain' || originalname.endsWith('.txt')) {
    return buffer.toString('utf-8');
  }
  return '';
}

// PATCH /api/meeting-records/action-items/:id/status
router.patch('/action-items/:itemId/status', async (req, res) => {
  await verifyActionItemAccess((req.params as any).itemId, (req as AuthRequest).user);
  try {
    const { itemId } = req.params as any;
    const status = assertActionItemStatus(req.body?.status);
    await prisma.meetingActionItem.update({
      where: { id: itemId },
      data: { status, completed: status === 'completed' }
    });
    res.json({ success: true });
  } catch (error: any) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:projectId/meeting-records
router.get('/', async (req, res) => {
  {
    const { projectId, opportunityId } = req.params as any;
    await verifyContextMember(projectId, opportunityId, (req as AuthRequest).user);
  }
  try {
    const { projectId, opportunityId } = req.params as any;
    const records = await prisma.meetingRecord.findMany({
      where: projectId ? { projectId } : { opportunityId },
      orderBy: { meetingDate: 'desc' },
      include: {
        actionItems: {
          include: { assignedTo: true }
        }
      }
    });

    // Attach SAS URLs for file recordings and transcripts
    const mapped = records.map(r => {
      let tempSasUrl = r.recordingUrl;
      if (r.recordingType === 'file' && r.recordingUrl) {
        const bName = extractBlobName(r.recordingUrl);
        const cName = getContainerNameFromUrl(r.recordingUrl);
        tempSasUrl = generateSasUrl({ containerName: cName, blobName: bName, permissions: 'r' });
      }

      let tempTranscriptSas = r.transcriptUrl;
      if (r.transcriptSource === 'uploaded_file' && r.transcriptUrl) {
        const tbName = extractBlobName(r.transcriptUrl);
        const tcName = getContainerNameFromUrl(r.transcriptUrl);
        tempTranscriptSas = generateSasUrl({ containerName: tcName, blobName: tbName, permissions: 'r' });
      }

      return {
        ...r,
        recordingSasUrl: tempSasUrl,
        transcriptSasUrl: tempTranscriptSas
      };
    });

    res.json({ data: mapped });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/:projectId/meeting-records
router.post('/', upload.fields([{ name: 'recordingFile', maxCount: 1 }, { name: 'transcriptFile', maxCount: 1 }]), async (req, res) => {
  {
    const { projectId, opportunityId } = req.params as any;
    await verifyContextMember(projectId, opportunityId, (req as AuthRequest).user);
  }
  try {
    const { projectId, opportunityId } = req.params as any;
    const { meetingTitle, meetingDate, recordingType, recordingLink, transcriptSource, transcriptPasted } = req.body;

    if (!meetingTitle) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const recordingFile = files['recordingFile']?.[0];
    const transcriptFile = files['transcriptFile']?.[0];

    let contextName = 'Unknown';
    let folderPrefix = 'unknown-context';
    
    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      contextName = project.name;
      folderPrefix = `${project.id}-${sanitizeDirectoryName(project.name)}`;
    } else if (opportunityId) {
      const opp = await prisma.preSalesOpportunity.findUnique({ where: { id: opportunityId } });
      if (!opp) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }
      contextName = opp.name;
      folderPrefix = `${opp.id}-${sanitizeDirectoryName(opp.name)}`;
    } else {
      return res.status(400).json({ error: 'projectId or opportunityId is required' });
    }

    let finalRecordingUrl = null;
    // TT-090: recordingType and transcriptSource are enums now, so a value outside the
    // set is rejected by the database — an unhandled 500 for what is a caller mistake.
    // The checks below already only act on the known values; this makes an unknown one a
    // 400 rather than storing it or blowing up.
    const RECORDING_TYPES = ['file', 'link', 'none'];
    const TRANSCRIPT_SOURCES = ['pasted', 'uploaded_file', 'none'];
    if (recordingType !== undefined && recordingType !== null && recordingType !== '' && !RECORDING_TYPES.includes(recordingType)) {
      throw new AppError(`recordingType must be one of: ${RECORDING_TYPES.join(', ')}.`, 400);
    }
    if (transcriptSource !== undefined && transcriptSource !== null && transcriptSource !== '' && !TRANSCRIPT_SOURCES.includes(transcriptSource)) {
      throw new AppError(`transcriptSource must be one of: ${TRANSCRIPT_SOURCES.join(', ')}.`, 400);
    }

    let finalRecordingType = recordingType === 'none' ? null : recordingType;

    // Handle Recording
    if (finalRecordingType === 'file' && recordingFile) {
      const recContainerName = projectId ? CONTAINERS.PROJECT_RECORDINGS : CONTAINERS.PRESALES_DOCS;
      const { url } = await uploadFile(
        recContainerName, 
        recordingFile.buffer, 
        recordingFile.originalname, 
        recordingFile.mimetype, 
        projectId || undefined, 
        undefined, 
        projectId ? undefined : `${folderPrefix}/transcripts-and-recordings/recordings`
      );
      finalRecordingUrl = url;
    } else if (finalRecordingType === 'link' && recordingLink) {
      finalRecordingUrl = recordingLink;
    } else {
      finalRecordingUrl = null;
    }

    // Handle Transcript
    let finalTranscriptText = null;
    let finalTranscriptUrl = null;
    let finalTranscriptSource = transcriptSource === 'none' ? null : transcriptSource;

    if (finalTranscriptSource === 'pasted' && transcriptPasted) {
      finalTranscriptText = transcriptPasted;
    } else if (finalTranscriptSource === 'uploaded_file' && transcriptFile) {
      // Extract text for AI
      finalTranscriptText = await extractText(transcriptFile.buffer, transcriptFile.originalname, transcriptFile.mimetype);
      if (!finalTranscriptText) {
        return res.status(400).json({ error: 'Failed to extract text from the transcript file. Please try again or paste the text.' });
      }

      // Upload file to Azure
      const transContainerName = projectId ? CONTAINERS.PROJECT_RECORDINGS : CONTAINERS.PRESALES_DOCS;
      const { url } = await uploadFile(
        transContainerName, 
        transcriptFile.buffer, 
        transcriptFile.originalname, 
        transcriptFile.mimetype, 
        projectId || undefined, 
        undefined, 
        projectId ? undefined : `${folderPrefix}/transcripts-and-recordings/transcripts`
      );
      finalTranscriptUrl = url;
    } else {
      finalTranscriptSource = null;
    }

    if (!finalRecordingType && !finalTranscriptSource) {
      return res.status(400).json({ error: 'You must provide either a recording or a transcript.' });
    }

    let finalAiMinutes = null;
    // Declared out here because the continuity writes further down need to intersect the
    // model's answer against exactly what it was shown (TT-040).
    let priorActionItems: { id: string; task: string; owner: string | null }[] = [];
    let priorBlockers: { id: string; description: string }[] = [];
    if (finalTranscriptText) {
      // Find context (project or opp) to get members for fuzzy matching
      let contextMembers: any[] = [];
      if (projectId) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: { members: { include: { member: true } } }
        });
        if (project) contextMembers = project.members.map(m => m.member);
      } else if (opportunityId) {
        const opp = await prisma.preSalesOpportunity.findUnique({
          where: { id: opportunityId },
          include: { assignments: { include: { member: true } } }
        });
        if (opp) contextMembers = opp.assignments.map(a => a.member);
      }

      // Pre-process transcript to correct names using the context roster.
      // TT-064: the corrected text is what the model sees, but it is no longer what gets
      // stored — the record keeps the transcript as it was actually supplied, so the
      // minutes' evidence quotes stay checkable against it. What was changed is recorded
      // in aiMinutes.name_corrections.
      const { correctedText, corrections } = correctNamesInTranscript(finalTranscriptText, contextMembers);

      // Find context for PM tracking (open blockers & action items)
      if (projectId || opportunityId) {
        const whereClause = projectId ? { projectId } : { opportunityId };
        
        // Open action items
        const rawItems = await prisma.meetingActionItem.findMany({
          where: {
            meetingRecord: whereClause,
            status: 'open',
          },
          include: { assignedTo: true }
        });
        priorActionItems = rawItems.map(i => ({
          id: i.id,
          task: i.task,
          owner: i.assignedTo ? i.assignedTo.name : i.originalOwnerText
        }));

        // Open blockers
        const rawBlockers = await prisma.blockerRisk.findMany({
          where: {
            ...whereClause,
            status: 'open',
          }
        });
        priorBlockers = rawBlockers.map(b => ({
          id: b.id,
          description: b.description
        }));
      }

      // Call LLM
      try {
        // correctedText, not finalTranscriptText: the model still gets the roster-corrected
        // names, while finalTranscriptText — what actually gets stored — stays as supplied.
        finalAiMinutes = await generateMeetingMinutes(correctedText, priorActionItems, priorBlockers, 1, contextMembers);
        if (finalAiMinutes && (finalAiMinutes as any).status !== 'TOKENS_EXCEEDED') {
          (finalAiMinutes as any).name_corrections = corrections;
        }
      } catch (err: any) {
        if (err.message && (err.message.includes('token/rate limit') || err.message.includes('truncated at token limit'))) {
          finalAiMinutes = { status: 'TOKENS_EXCEEDED' };
        } else {
          throw err;
        }
      }
    }

    let finalMeetingDate: Date | null = null;
    if (finalAiMinutes && (finalAiMinutes as any).meeting_date) {
      let dateStr = String((finalAiMinutes as any).meeting_date);
      dateStr = dateStr.replace(/(\d)(AM|PM)/i, '$1 $2').replace(/\bIST\b/i, '+05:30');
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime())) {
        finalMeetingDate = parsedDate;
      }
    }
    if (!finalMeetingDate && meetingDate) {
      finalMeetingDate = new Date(meetingDate);
    }

    // ── Create Relational PM Tracking Data ─────────────────────────────────────────
    // TT-043: the record was committed here and its attendees, decisions, action items
    // and blockers were then written as a loose sequence of independent statements. A
    // malformed field anywhere below — a null task from the model is enough — threw a
    // 500 and left a meeting record with some of its children and not the rest, with
    // nothing to tell anyone it was incomplete. Creating the record inside the same
    // transaction means a failure leaves no record at all, which is honest.
    const newRecord = await prisma.$transaction(async (tx) => {
    const newRecord = await tx.meetingRecord.create({
      data: {
        projectId: projectId || null,
        opportunityId: opportunityId || null,
        meetingTitle,
        meetingDate: finalMeetingDate,
        recordingType: finalRecordingType,
        recordingUrl: finalRecordingUrl,
        transcriptUrl: finalTranscriptUrl,
        transcriptText: finalTranscriptText,
        transcriptSource: finalTranscriptSource,
        aiMinutes: finalAiMinutes ? (finalAiMinutes as any) : null,
        // TT-110: this was the literal 'System'. The delete handler authorizes with
        // `record.createdBy === user.teamMemberId`, and 'System' can never equal a cuid,
        // so the uploader branch was dead — only admins could ever delete a record, and
        // there was no audit trail of who uploaded one. Records created before this keep
        // 'System' and stay admin-only to delete, which is the safe direction.
        createdBy: (req as AuthRequest).user?.teamMemberId ?? 'System',
      }
    });

    if (finalAiMinutes && (finalAiMinutes as any).status !== 'TOKENS_EXCEEDED') {
      // Find context (project or opp) to get members for fuzzy matching
      let contextMembers: any[] = [];
      if (projectId) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: { members: { include: { member: true } } }
        });
        if (project) contextMembers = project.members.map(m => m.member);
      } else if (opportunityId) {
        const opp = await prisma.preSalesOpportunity.findUnique({
          where: { id: opportunityId },
          include: { assignments: { include: { member: true } } }
        });
        if (opp) contextMembers = opp.assignments.map(a => a.member);
      }

      // 1. Attendees
      const attendeesList = finalAiMinutes.attendees_present || finalAiMinutes.attendees_mentioned || [];
      if (attendeesList.length > 0) {
        const attendeesToCreate = attendeesList.map((name: string) => {
          let memberId = null;
          if (contextMembers.length > 0) {
            const res = matchTeamMember(name, contextMembers);
            if (res.matches) memberId = res.memberId;
          }
          return {
            meetingRecordId: newRecord.id,
            rawName: name,
            memberId
          };
        });
        await tx.meetingAttendee.createMany({ data: attendeesToCreate });
      }

      // 2. Action Items
      const actionItemsList = finalAiMinutes.action_items || [];
      if (actionItemsList.length > 0) {
        const itemsToCreate = actionItemsList.map((ai: any) => {
          let assignedToId = null;
          if (contextMembers.length > 0 && ai.owner && ai.owner.toLowerCase() !== 'unassigned') {
            const res = matchTeamMember(ai.owner, contextMembers);
            if (res.matches) assignedToId = res.memberId;
          }

          let parsedDueDate = null;
          if (ai.due_date && typeof ai.due_date === 'string' && ai.due_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            parsedDueDate = new Date(ai.due_date);
          }

          const status = normalizeActionItemStatus(ai.status);
          const completed = status === 'completed';

          return {
            meetingRecordId: newRecord.id,
            task: ai.task,
            originalOwnerText: ai.owner || 'Unassigned',
            assignedToId,
            dueDate: parsedDueDate,
            priority: normalizeActionItemPriority(ai.priority),
            status,
            completed
          };
        });
        await tx.meetingActionItem.createMany({ data: itemsToCreate });
      }

      // 3. Key Decisions
      const decisionsList = finalAiMinutes.decisions || [];
      if (decisionsList.length > 0) {
        const decisionsToCreate = decisionsList.map((d: any) => {
          let decidedById = null;
          const ownerText = d.owner || d.decided_by;
          if (contextMembers.length > 0 && ownerText) {
            const res = matchTeamMember(ownerText, contextMembers);
            if (res.matches) decidedById = res.memberId;
          }
          return {
            meetingRecordId: newRecord.id,
            decisionText: d.decision || d.decision_text || '',
            context: d.rationale || d.context || null,
            decidedById
          };
        });
        await tx.keyDecision.createMany({ data: decisionsToCreate });
      }

      // 4. New Blockers & Risks
      const blockersList = finalAiMinutes.open_risks_blockers || finalAiMinutes.blockers_or_risks || [];
      if (blockersList.length > 0) {
        const blockersToCreate = blockersList.map((b: any) => {
          const description = typeof b === 'string' ? b : b.description;
          const status = normalizeBlockerStatus(typeof b === 'string' ? 'open' : b.status);
          return {
            projectId: projectId || null,
            opportunityId: opportunityId || null,
            description,
            status,
            firstRaisedMeetingId: newRecord.id,
            resolvedInMeetingId: status === 'resolved' ? newRecord.id : null,
          };
        });
        await tx.blockerRisk.createMany({ data: blockersToCreate });
      }

      // 5. Cross-Meeting Continuity: Resolve prior blockers
      // Restricted to the blockers actually shown to the model — see TT-040 above.
      const resolvableBlockerIds = onlyIdsOfferedToTheModel(
        finalAiMinutes.resolved_previous_blocker_ids, priorBlockers);
      if (resolvableBlockerIds.length > 0) {
        await tx.blockerRisk.updateMany({
          where: {
            id: { in: resolvableBlockerIds },
            status: 'open'
          },
          data: {
            status: 'resolved',
            resolvedInMeetingId: newRecord.id
          }
        });
      }

      // 6. Cross-Meeting Continuity: Complete prior action items
      const completableItemIds = onlyIdsOfferedToTheModel(
        completedActionItemIds(finalAiMinutes.updated_previous_action_items),
        priorActionItems);
      if (completableItemIds.length > 0) {
        // updateMany rather than a loop of update(): an id that has since been deleted
        // no longer throws mid-write and abandons a half-populated meeting record.
        await tx.meetingActionItem.updateMany({
          where: { id: { in: completableItemIds } },
          data: { status: 'completed', completed: true }
        });
      }
    }

    return newRecord;
    });

    // Return the created record with action items for immediate UI rendering
    const createdWithItems = await prisma.meetingRecord.findUnique({
      where: { id: newRecord.id },
      include: { actionItems: { include: { assignedTo: true } } }
    });

    res.status(201).json(createdWithItems);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/projects/:projectId/meeting-records/:id
router.delete('/:id', async (req, res) => {
  await verifyMeetingRecordAccess((req.params as any).id, (req as AuthRequest).user);
  try {
    const { projectId, opportunityId, id } = req.params as any;

    const record = await prisma.meetingRecord.findUnique({
      where: { id }
    });

    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    if ((projectId && record.projectId !== projectId) || (opportunityId && record.opportunityId !== opportunityId)) {
      return res.status(400).json({ error: 'Record does not belong to context' });
    }

    // TT-042: this authorization block used to sit *below* the blob deletion. An
    // unauthorized caller was told 403 — after their request had already destroyed the
    // recording. Nothing is deleted now until the caller is known to be allowed to.
    const user = (req as any).user;
    const isUploader = record.createdBy === user?.teamMemberId;
    const isAdmin = user?.permissions?.manageTeam;

    if (!isAdmin && !isUploader) {
      return res.status(403).json({ error: 'Forbidden: Only Admins or the uploader can delete this record' });
    }

    if (record.recordingType === 'file' && record.recordingUrl) {
      const bName = extractBlobName(record.recordingUrl);
      // Also TT-042: this passed PROJECT_DOCS, but recordings are uploaded to
      // PROJECT_RECORDINGS (see the upload path above), so the delete targeted a blob
      // that does not exist there and every real recording was orphaned in storage.
      // Reading the container back off the stored URL cannot drift from the upload.
      try {
        await deleteFile(getContainerNameFromUrl(record.recordingUrl), bName);
      } catch (err) {
        console.error('Failed to delete blob', err);
      }
    }

    await prisma.meetingRecord.delete({ where: { id } });

    await prisma.activityLog.create({
      data: {
        category: opportunityId ? 'PreSales' : 'Projects',
        action: 'DELETE',
        details: `User ${user?.name || 'Unknown'} deleted meeting record "${record.meetingTitle || 'Unknown'}"`,
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/projects/:projectId/meeting-records/:recordId/transcript
router.patch('/:recordId/transcript', async (req, res) => {
  await verifyMeetingRecordAccess((req.params as any).recordId, (req as AuthRequest).user);
  try {
    const { projectId, opportunityId, recordId } = req.params as any;
    const { transcriptText } = req.body;

    const record = await prisma.meetingRecord.findUnique({ where: { id: recordId } });
    if (!record) return res.status(404).json({ error: 'Record not found' });
    if ((projectId && record.projectId !== projectId) || (opportunityId && record.opportunityId !== opportunityId)) {
      return res.status(400).json({ error: 'Record does not belong to context' });
    }

    const updated = await prisma.meetingRecord.update({
      where: { id: recordId },
      data: { transcriptText }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/projects/:projectId/meeting-records/action-items/:itemId
router.patch('/action-items/:itemId', async (req, res) => {
  await verifyActionItemAccess((req.params as any).itemId, (req as AuthRequest).user);
  try {
    const { itemId } = req.params as any;
    if (typeof req.body?.completed !== 'boolean') {
      throw new AppError('completed must be true or false.', 400);
    }
    const completed: boolean = req.body.completed;

    const updated = await prisma.meetingActionItem.update({
      where: { id: itemId },
      data: { 
        completed,
        status: completed ? 'completed' : 'open'
      },
      include: { assignedTo: true }
    });

    res.json(updated);
  } catch (error: any) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/projects/:projectId/meeting-records/:recordId/reanalyze
router.post('/:recordId/reanalyze', async (req, res) => {
  await verifyMeetingRecordAccess((req.params as any).recordId, (req as AuthRequest).user);
  try {
    const { projectId, opportunityId, recordId } = req.params as any;

    const record = await prisma.meetingRecord.findUnique({
      where: { id: recordId }
    });

    if (!record) return res.status(404).json({ error: 'Record not found' });
    if ((projectId && record.projectId !== projectId) || (opportunityId && record.opportunityId !== opportunityId)) {
      return res.status(400).json({ error: 'Record does not belong to context' });
    }

    if (!record.transcriptText) {
      return res.status(400).json({ error: 'No transcript text available to analyze' });
    }

    // Find context (project or opp) to get members for fuzzy matching
    let contextMembers: any[] = [];
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { members: { include: { member: true } } }
      });
      if (project) contextMembers = project.members.map(m => m.member);
    } else if (opportunityId) {
      const opp = await prisma.preSalesOpportunity.findUnique({
        where: { id: opportunityId },
        include: { assignments: { include: { member: true } } }
      });
      if (opp) contextMembers = opp.assignments.map(a => a.member);
    }

    // Open action items & blockers from context for PM tracking continuity
    let priorActionItems: { id: string; task: string; owner: string | null }[] = [];
    let priorBlockers: { id: string; description: string }[] = [];

    if (projectId || opportunityId) {
      const whereClause = projectId ? { projectId } : { opportunityId };
      
      const rawItems = await prisma.meetingActionItem.findMany({
        where: {
          meetingRecord: whereClause,
          status: 'open',
          meetingRecordId: { not: recordId } // exclude current meeting
        },
        include: { assignedTo: true }
      });
      priorActionItems = rawItems.map(i => ({
        id: i.id,
        task: i.task,
        owner: i.assignedTo ? i.assignedTo.name : i.originalOwnerText
      }));

      const rawBlockers = await prisma.blockerRisk.findMany({
        where: {
          ...whereClause,
          status: 'open',
          firstRaisedMeetingId: { not: recordId } // exclude current meeting
        }
      });
      priorBlockers = rawBlockers.map(b => ({
        id: b.id,
        description: b.description
      }));
    }

    // Pre-process transcript to correct names using the context roster.
    // TT-064: no longer written back over the stored transcript — see the POST path above.
    const { correctedText, corrections } = correctNamesInTranscript(record.transcriptText || '', contextMembers);

    // Call LLM — deliberately before the transaction opens. It takes minutes, and holding
    // a database transaction across it would pin a connection for the duration.
    const finalAiMinutes = await generateMeetingMinutes(correctedText, priorActionItems, priorBlockers, 1, contextMembers);
    if (finalAiMinutes) {
      (finalAiMinutes as any).name_corrections = corrections;
    }

    // TT-043: the four deleteMany calls below used to run unconditionally, before this
    // check and outside any transaction. If the model returned nothing — a timeout, a
    // token limit, a parse failure — the record's attendees, action items, decisions and
    // blockers were wiped and never recreated, destroying manually curated PM tracking
    // data with no way back. Nothing is deleted now unless there is something to put in
    // its place, and the whole swap is one transaction so a failure part-way rolls back.
    if (!finalAiMinutes) {
      throw new AppError(
        'Re-analysis did not return usable minutes, so the existing minutes were left untouched. Try again.',
        502,
      );
    }

    const updatedWithItems = await prisma.$transaction(async (tx) => {
      // Delete old relational items
      await tx.meetingAttendee.deleteMany({ where: { meetingRecordId: recordId } });
      await tx.meetingActionItem.deleteMany({ where: { meetingRecordId: recordId } });
      await tx.keyDecision.deleteMany({ where: { meetingRecordId: recordId } });
      await tx.blockerRisk.deleteMany({ where: { firstRaisedMeetingId: recordId } });

      // Re-create relational items
      {
      // 1. Attendees
      const attendeesList = finalAiMinutes.attendees_present || finalAiMinutes.attendees_mentioned || [];
      if (attendeesList.length > 0) {
        const attendeesToCreate = attendeesList.map((name: string) => {
          let memberId = null;
          if (contextMembers.length > 0) {
            const res = matchTeamMember(name, contextMembers);
            if (res.matches) memberId = res.memberId;
          }
          return {
            meetingRecordId: recordId,
            rawName: name,
            memberId
          };
        });
        await tx.meetingAttendee.createMany({ data: attendeesToCreate });
      }

      // 2. Action Items
      const actionItemsList = finalAiMinutes.action_items || [];
      if (actionItemsList.length > 0) {
        const itemsToCreate = actionItemsList.map((ai: any) => {
          let assignedToId = null;
          if (contextMembers.length > 0 && ai.owner && ai.owner.toLowerCase() !== 'unassigned') {
            const res = matchTeamMember(ai.owner, contextMembers);
            if (res.matches) assignedToId = res.memberId;
          }

          let parsedDueDate = null;
          if (ai.due_date && typeof ai.due_date === 'string' && ai.due_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            parsedDueDate = new Date(ai.due_date);
          }

          const status = normalizeActionItemStatus(ai.status);
          const completed = status === 'completed';

          return {
            meetingRecordId: recordId,
            task: ai.task,
            originalOwnerText: ai.owner || 'Unassigned',
            assignedToId,
            dueDate: parsedDueDate,
            priority: normalizeActionItemPriority(ai.priority),
            status,
            completed
          };
        });
        await tx.meetingActionItem.createMany({ data: itemsToCreate });
      }

      // 3. Key Decisions
      const decisionsList = finalAiMinutes.decisions || [];
      if (decisionsList.length > 0) {
        const decisionsToCreate = decisionsList.map((d: any) => {
          let decidedById = null;
          const ownerText = d.owner || d.decided_by;
          if (contextMembers.length > 0 && ownerText) {
            const res = matchTeamMember(ownerText, contextMembers);
            if (res.matches) decidedById = res.memberId;
          }
          return {
            meetingRecordId: recordId,
            decisionText: d.decision || d.decision_text || '',
            context: d.rationale || d.context || null,
            decidedById
          };
        });
        await tx.keyDecision.createMany({ data: decisionsToCreate });
      }

      // 4. New Blockers & Risks
      const blockersList = finalAiMinutes.open_risks_blockers || finalAiMinutes.blockers_or_risks || [];
      if (blockersList.length > 0) {
        const blockersToCreate = blockersList.map((b: any) => {
          const description = typeof b === 'string' ? b : b.description;
          const status = normalizeBlockerStatus(typeof b === 'string' ? 'open' : b.status);
          return {
            projectId: projectId || null,
            opportunityId: opportunityId || null,
            description,
            status,
            firstRaisedMeetingId: recordId,
            resolvedInMeetingId: status === 'resolved' ? recordId : null,
          };
        });
        await tx.blockerRisk.createMany({ data: blockersToCreate });
      }

      // 5. Cross-Meeting Continuity: Resolve prior blockers — TT-040, as in the POST path.
      const resolvableBlockerIds = onlyIdsOfferedToTheModel(
        finalAiMinutes.resolved_previous_blocker_ids, priorBlockers);
      if (resolvableBlockerIds.length > 0) {
        await tx.blockerRisk.updateMany({
          where: {
            id: { in: resolvableBlockerIds },
            status: 'open'
          },
          data: {
            status: 'resolved',
            resolvedInMeetingId: recordId
          }
        });
      }

      // 6. Cross-Meeting Continuity: Complete prior action items
      const completableItemIds = onlyIdsOfferedToTheModel(
        completedActionItemIds(finalAiMinutes.updated_previous_action_items),
        priorActionItems);
      if (completableItemIds.length > 0) {
        await tx.meetingActionItem.updateMany({
          where: { id: { in: completableItemIds } },
          data: { status: 'completed', completed: true }
        });
      }
      }

      let updatedMeetingDate = record.meetingDate;
      if ((finalAiMinutes as any).meeting_date) {
        let dateStr = String((finalAiMinutes as any).meeting_date);
        dateStr = dateStr.replace(/(\d)(AM|PM)/i, '$1 $2').replace(/\bIST\b/i, '+05:30');
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          updatedMeetingDate = parsedDate;
        }
      }

      // Inside the transaction too: the stored aiMinutes and the relational rows are two
      // views of the same analysis, and they must not be able to disagree.
      return tx.meetingRecord.update({
        where: { id: recordId },
        data: {
          aiMinutes: finalAiMinutes as any,
          meetingDate: updatedMeetingDate
        },
        include: { actionItems: { include: { assignedTo: true } } }
      });
    });

    res.json(updatedWithItems);
  } catch (error: any) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});



export default router;

