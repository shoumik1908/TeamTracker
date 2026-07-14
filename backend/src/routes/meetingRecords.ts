import { Router } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { uploadFile, deleteFile, CONTAINERS, generateSasUrl, extractBlobName, getContainerNameFromUrl, sanitizeDirectoryName } from '../services/blobStorage';
import { generateMeetingMinutes } from '../services/groqExtractor';
import { matchTeamMember, correctNamesInTranscript } from '../utils/fuzzyMatch';

const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

const router = Router({ mergeParams: true });

// Helper to extract text from a buffer (reused from CV logic)
async function extractText(buffer: Buffer, originalname: string, mimetype: string): Promise<string> {
  if (mimetype === 'application/pdf') {
    const { PDFParse } = require('pdf-parse');
    try {
      const data = await PDFParse(buffer);
      return data.text || '';
    } catch (e) {
      console.error('[MeetingRecord pdf-parse error]:', e);
      return '';
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
  try {
    const { itemId } = req.params as any;
    const { status } = req.body;
    await prisma.meetingActionItem.update({
      where: { id: itemId },
      data: { status, completed: status === 'completed' }
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:projectId/meeting-records
router.get('/', async (req, res) => {
  try {
    const { projectId, opportunityId } = req.params as any;
    const records = await prisma.meetingRecord.findMany({
      where: projectId ? { projectId } : { opportunityId },
      orderBy: { createdAt: 'desc' },
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
  try {
    const { projectId, opportunityId } = req.params as any;
    const { meetingTitle, meetingDate, recordingType, recordingLink, transcriptSource, transcriptPasted } = req.body;

    if (!meetingTitle || !meetingDate) {
      return res.status(400).json({ error: 'Title and date are required' });
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

      // Pre-process transcript to correct names using the context roster
      const { correctedText, corrections } = correctNamesInTranscript(finalTranscriptText, contextMembers);
      finalTranscriptText = correctedText;

      // Find context for PM tracking (open blockers & action items)
      let priorActionItems: { id: string; task: string; owner: string | null }[] = [];
      let priorBlockers: { id: string; description: string }[] = [];

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
        finalAiMinutes = await generateMeetingMinutes(finalTranscriptText, priorActionItems, priorBlockers);
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

    const newRecord = await prisma.meetingRecord.create({
      data: {
        projectId: projectId || null,
        opportunityId: opportunityId || null,
        meetingTitle,
        meetingDate: new Date(meetingDate),
        recordingType: finalRecordingType,
        recordingUrl: finalRecordingUrl,
        transcriptUrl: finalTranscriptUrl,
        transcriptText: finalTranscriptText,
        transcriptSource: finalTranscriptSource,
        aiMinutes: finalAiMinutes ? (finalAiMinutes as any) : null,
        createdBy: 'System', // In a real app, from auth token
      }
    });

    // ── Create Relational PM Tracking Data ─────────────────────────────────────────
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
        await prisma.meetingAttendee.createMany({ data: attendeesToCreate });
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

          const status = ai.status ? ai.status.toLowerCase() : 'open';
          const completed = status === 'completed';

          return {
            meetingRecordId: newRecord.id,
            task: ai.task,
            originalOwnerText: ai.owner || 'Unassigned',
            assignedToId,
            dueDate: parsedDueDate,
            priority: ai.priority || null,
            status,
            completed
          };
        });
        await prisma.meetingActionItem.createMany({ data: itemsToCreate });
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
        await prisma.keyDecision.createMany({ data: decisionsToCreate });
      }

      // 4. New Blockers & Risks
      const blockersList = finalAiMinutes.open_risks_blockers || finalAiMinutes.blockers_or_risks || [];
      if (blockersList.length > 0) {
        const blockersToCreate = blockersList.map((b: any) => {
          const description = typeof b === 'string' ? b : b.description;
          const status = typeof b === 'string' ? 'open' : (b.status || 'open');
          return {
            projectId: projectId || null,
            opportunityId: opportunityId || null,
            description,
            status,
            firstRaisedMeetingId: newRecord.id,
            resolvedInMeetingId: status === 'resolved' ? newRecord.id : null,
          };
        });
        await prisma.blockerRisk.createMany({ data: blockersToCreate });
      }

      // 5. Cross-Meeting Continuity: Resolve prior blockers
      if (finalAiMinutes.resolved_previous_blocker_ids && finalAiMinutes.resolved_previous_blocker_ids.length > 0) {
        await prisma.blockerRisk.updateMany({
          where: {
            id: { in: finalAiMinutes.resolved_previous_blocker_ids },
            status: 'open'
          },
          data: {
            status: 'resolved',
            resolvedInMeetingId: newRecord.id
          }
        });
      }

      // 6. Cross-Meeting Continuity: Complete prior action items
      if (finalAiMinutes.updated_previous_action_items && finalAiMinutes.updated_previous_action_items.length > 0) {
        for (const update of finalAiMinutes.updated_previous_action_items) {
          if (update.new_status === 'completed') {
            await prisma.meetingActionItem.update({
              where: { id: update.id },
              data: { status: 'completed', completed: true }
            });
          }
        }
      }
    }

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

    if (record.recordingType === 'file' && record.recordingUrl) {
      const bName = extractBlobName(record.recordingUrl);
      try {
        await deleteFile(projectId ? CONTAINERS.PROJECT_DOCS : CONTAINERS.PRESALES_DOCS, bName);
      } catch (err) {
        console.error('Failed to delete blob', err);
      }
    }

    await prisma.meetingRecord.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/projects/:projectId/meeting-records/:recordId/transcript
router.patch('/:recordId/transcript', async (req, res) => {
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
  try {
    const { itemId } = req.params as any;
    const { completed } = req.body;

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
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/projects/:projectId/meeting-records/:recordId/reanalyze
router.post('/:recordId/reanalyze', async (req, res) => {
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

    // Pre-process transcript to correct names using the context roster
    const { correctedText, corrections } = correctNamesInTranscript(record.transcriptText || '', contextMembers);
    if (corrections.length > 0) {
      await prisma.meetingRecord.update({
        where: { id: recordId },
        data: { transcriptText: correctedText }
      });
    }

    // Call LLM
    const finalAiMinutes = await generateMeetingMinutes(correctedText, priorActionItems, priorBlockers);
    if (finalAiMinutes) {
      (finalAiMinutes as any).name_corrections = corrections;
    }

    // Delete old relational items
    await prisma.meetingAttendee.deleteMany({ where: { meetingRecordId: recordId } });
    await prisma.meetingActionItem.deleteMany({ where: { meetingRecordId: recordId } });
    await prisma.keyDecision.deleteMany({ where: { meetingRecordId: recordId } });
    await prisma.blockerRisk.deleteMany({ where: { firstRaisedMeetingId: recordId } });

    // Re-create relational items
    if (finalAiMinutes) {
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
        await prisma.meetingAttendee.createMany({ data: attendeesToCreate });
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

          const status = ai.status ? ai.status.toLowerCase() : 'open';
          const completed = status === 'completed';

          return {
            meetingRecordId: recordId,
            task: ai.task,
            originalOwnerText: ai.owner || 'Unassigned',
            assignedToId,
            dueDate: parsedDueDate,
            priority: ai.priority || null,
            status,
            completed
          };
        });
        await prisma.meetingActionItem.createMany({ data: itemsToCreate });
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
        await prisma.keyDecision.createMany({ data: decisionsToCreate });
      }

      // 4. New Blockers & Risks
      const blockersList = finalAiMinutes.open_risks_blockers || finalAiMinutes.blockers_or_risks || [];
      if (blockersList.length > 0) {
        const blockersToCreate = blockersList.map((b: any) => {
          const description = typeof b === 'string' ? b : b.description;
          const status = typeof b === 'string' ? 'open' : (b.status || 'open');
          return {
            projectId: projectId || null,
            opportunityId: opportunityId || null,
            description,
            status,
            firstRaisedMeetingId: recordId,
            resolvedInMeetingId: status === 'resolved' ? recordId : null,
          };
        });
        await prisma.blockerRisk.createMany({ data: blockersToCreate });
      }

      // 5. Cross-Meeting Continuity: Resolve prior blockers
      if (finalAiMinutes.resolved_previous_blocker_ids && finalAiMinutes.resolved_previous_blocker_ids.length > 0) {
        await prisma.blockerRisk.updateMany({
          where: {
            id: { in: finalAiMinutes.resolved_previous_blocker_ids },
            status: 'open'
          },
          data: {
            status: 'resolved',
            resolvedInMeetingId: recordId
          }
        });
      }

      // 6. Cross-Meeting Continuity: Complete prior action items
      if (finalAiMinutes.updated_previous_action_items && finalAiMinutes.updated_previous_action_items.length > 0) {
        for (const update of finalAiMinutes.updated_previous_action_items) {
          if (update.new_status === 'completed') {
            await prisma.meetingActionItem.update({
              where: { id: update.id },
              data: { status: 'completed', completed: true }
            });
          }
        }
      }
    }

    const updatedWithItems = await prisma.meetingRecord.update({
      where: { id: recordId },
      data: { aiMinutes: finalAiMinutes ? (finalAiMinutes as any) : null },
      include: { actionItems: { include: { assignedTo: true } } }
    });

    res.json(updatedWithItems);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
