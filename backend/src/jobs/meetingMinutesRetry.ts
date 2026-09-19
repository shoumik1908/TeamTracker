import prisma from '../lib/prisma';
import { PrismaClient } from '@prisma/client';
import { generateMeetingMinutes  } from '../services/azureOpenAIService';
import { matchTeamMember, correctNamesInTranscript } from '../utils/fuzzyMatch';
import { onlyIdsOfferedToTheModel, completedActionItemIds, normalizeActionItemStatus, normalizeActionItemPriority, normalizeBlockerStatus } from '../lib/meetingContinuity';
import cron from 'node-cron';

// TT-026: the cron fires every two minutes while each run makes minutes-long LLM calls,
// so runs overlapped routinely. Two runs processing the same record interleaved the
// delete-and-recreate block below, producing duplicated or half-deleted attendees and
// action items. A single flag is enough here: this job runs in-process on one instance.
let isRunning = false;

// TT-025: a record that fails is picked up again on the very next tick, forever. Nothing
// counted attempts, so one permanently unprocessable record burned three full-transcript
// LLM calls every two minutes indefinitely. The count lives in the aiMinutes JSON rather
// than a new column, so this needs no migration; once it is spent the record's status
// moves off TOKENS_EXCEEDED and it stops being selected.
const MAX_RETRY_ATTEMPTS = 5;

// TT-023: bounds how much work one tick can take on, so a backlog cannot turn into a
// single enormous run.
const MAX_RECORDS_PER_RUN = 10;

export const retryMeetingMinutesAnalysis = async () => {
  if (isRunning) {
    console.log('[Minutes Retry Job] Previous run still in progress — skipping this tick.');
    return;
  }
  isRunning = true;
  try {
    // TT-023: this used to be findMany() with no filter and no select — every meeting
    // record, including every full transcript, pulled into memory every two minutes, then
    // filtered in JS. Postgres can filter on the JSON column directly, and the loop only
    // needs these fields.
    const records = await prisma.meetingRecord.findMany({
      where: { aiMinutes: { path: ['status'], equals: 'TOKENS_EXCEEDED' } },
      select: {
        id: true, meetingTitle: true, projectId: true, opportunityId: true,
        transcriptText: true, meetingDate: true, createdAt: true, aiMinutes: true,
      },
      orderBy: { createdAt: 'asc' },
      take: MAX_RECORDS_PER_RUN,
    });

    if (records.length === 0) return;
    console.log(`[Minutes Retry Job] Found ${records.length} records pending AI minutes analysis.`);

    for (const record of records) {
      console.log(`[Minutes Retry Job] Retrying record: id=${record.id}, title=${record.meetingTitle}`);
      
      const projectId = record.projectId;
      const opportunityId = record.opportunityId;

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
      let priorActionItems: any[] = [];
      let priorBlockers: any[] = [];

      if (projectId || opportunityId) {
        const whereClause = projectId ? { projectId } : { opportunityId };
        
        const rawItems = await prisma.meetingActionItem.findMany({
          where: {
            meetingRecord: whereClause,
            status: 'open',
            meetingRecordId: { not: record.id }
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
            firstRaisedMeetingId: { not: record.id }
          }
        });
        priorBlockers = rawBlockers.map(b => ({
          id: b.id,
          description: b.description
        }));
      }

      const attemptsSoFar = Number((record.aiMinutes as any)?.retry_attempts) || 0;

      try {
        let baseText = record.transcriptText || '';
        if (!record.meetingDate) {
          baseText = `[SYSTEM CONTEXT: The transcript file was created on ${record.createdAt.toISOString()}. If the transcript text DOES NOT mention an explicit meeting date/time, default to this creation date for the meeting_date. ALWAYS output the final meeting_date in IST (Indian Standard Time), appending " IST" to the string.]\n\n` + baseText;
        }
        // TT-064: the corrected text used to be written back over transcriptText, so the
        // only stored copy of what was actually said was replaced by a fuzzy-matched
        // rewrite — destroying the evidence trail the minutes' evidence_quote fields are
        // meant to be checkable against. The correction is still applied to what the model
        // sees; it is just no longer mistaken for the source. What changed is recorded in
        // aiMinutes.name_corrections.
        const { correctedText, corrections } = correctNamesInTranscript(baseText, contextMembers);

        const finalAiMinutes = await generateMeetingMinutes(correctedText, priorActionItems, priorBlockers, 1, contextMembers);
        if (finalAiMinutes && (finalAiMinutes as any).status !== 'TOKENS_EXCEEDED') {
          (finalAiMinutes as any).name_corrections = corrections;
          // Carry the attempt count forward so a record that keeps succeeding at the LLM
          // step but failing later is still bounded.
          (finalAiMinutes as any).retry_attempts = attemptsSoFar;

          // Same reasoning as TT-043 in the HTTP paths: the deletes and the recreates are
          // one unit of work. A failure part-way used to leave the record stripped of its
          // attendees, decisions and action items, and — because the record stayed on
          // TOKENS_EXCEEDED — the next tick would do it again.
          await prisma.$transaction(async (tx) => {
          // Delete old relational items
          await tx.meetingAttendee.deleteMany({ where: { meetingRecordId: record.id } });
          await tx.meetingActionItem.deleteMany({ where: { meetingRecordId: record.id } });
          await tx.keyDecision.deleteMany({ where: { meetingRecordId: record.id } });
          await tx.blockerRisk.deleteMany({ where: { firstRaisedMeetingId: record.id } });

          // Re-create relational items
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
                meetingRecordId: record.id,
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
                meetingRecordId: record.id,
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
              if (contextMembers.length > 0 && ownerText && ownerText.toLowerCase() !== 'unassigned') {
                const res = matchTeamMember(ownerText, contextMembers);
                if (res.matches) decidedById = res.memberId;
              }
              return {
                meetingRecordId: record.id,
                decisionText: d.decision || d.decision_text || '',
                context: d.rationale || d.context || null,
                decidedById
              };
            });
            await tx.keyDecision.createMany({ data: decisionsToCreate });
          }

          // 4. Blockers
          const blockersList = finalAiMinutes.open_risks_blockers || finalAiMinutes.blockers_or_risks || [];
          if (blockersList.length > 0) {
            const blockersToCreate = blockersList.map((b: any) => {
              const description = typeof b === 'string' ? b : b.description;
              const status = normalizeBlockerStatus(typeof b === 'string' ? 'open' : b.status);
              return {
                projectId,
                opportunityId,
                firstRaisedMeetingId: record.id,
                description,
                status
              };
            });
            await tx.blockerRisk.createMany({ data: blockersToCreate });
          }

          // 5. Cross-Meeting Continuity: Resolve prior blockers
          // TT-024: these ids came from the model and went straight into the where clause
          // with no scoping. The transcript is concatenated into the prompt, so a crafted
          // one could name another project's blocker and silently close it. Restricted to
          // the ids this record's context actually offered the model.
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
                resolvedInMeetingId: record.id
              }
            });
          }

          // 6. Cross-Meeting Continuity: Complete prior action items
          // TT-025: this was a loop of update(), which throws on an id that no longer
          // exists. That threw away the minutes that had just been generated and left the
          // record on TOKENS_EXCEEDED, so it was retried — with three more full-transcript
          // LLM calls — every two minutes, forever. updateMany no-ops on missing ids.
          const completableItemIds = onlyIdsOfferedToTheModel(
            completedActionItemIds(finalAiMinutes.updated_previous_action_items),
            priorActionItems);
          if (completableItemIds.length > 0) {
            await tx.meetingActionItem.updateMany({
              where: { id: { in: completableItemIds } },
              data: { status: 'completed', completed: true }
            });
          }

          // Update meetingRecord with the minutes
          const updateData: any = { aiMinutes: finalAiMinutes as any };
          if (finalAiMinutes.meeting_date) {
            let dateStr = String(finalAiMinutes.meeting_date);
            dateStr = dateStr.replace(/(\d)(AM|PM)/i, '$1 $2').replace(/\bIST\b/i, '+05:30');
            const parsedDate = new Date(dateStr);
            if (!isNaN(parsedDate.getTime())) {
              updateData.meetingDate = parsedDate;
            }
          }

          await tx.meetingRecord.update({
            where: { id: record.id },
            data: updateData
          });
          });

          console.log(`[Minutes Retry Job] Successfully generated and stored AI minutes for record: ${record.id}`);
        }
      } catch (err: any) {
        console.warn(`[Minutes Retry Job] Failed to retry for record ${record.id}: ${err.message}`);
        // TT-025: without this the record stayed on TOKENS_EXCEEDED and was retried on
        // every tick forever — three full-transcript LLM calls every two minutes against a
        // record that was never going to succeed. After MAX_RETRY_ATTEMPTS it is marked
        // failed, which takes it out of the query above and leaves a record of why.
        const attempts = attemptsSoFar + 1;
        const existing = (record.aiMinutes as any) || {};
        await prisma.meetingRecord.update({
          where: { id: record.id },
          data: {
            aiMinutes: {
              ...existing,
              status: attempts >= MAX_RETRY_ATTEMPTS ? 'ANALYSIS_FAILED' : 'TOKENS_EXCEEDED',
              retry_attempts: attempts,
              last_retry_error: String(err?.message || err).slice(0, 500),
              last_retry_at: new Date().toISOString(),
            } as any,
          },
        }).catch(updateErr =>
          console.error(`[Minutes Retry Job] Could not record the failed attempt for ${record.id}:`, updateErr));

        if (attempts >= MAX_RETRY_ATTEMPTS) {
          console.error(`[Minutes Retry Job] Giving up on record ${record.id} after ${attempts} attempts.`);
        }
      }
    }
  } catch (e) {
    console.error('[Minutes Retry Job] Error:', e);
  } finally {
    isRunning = false;
  }
};

export const initMeetingMinutesRetryJob = () => {
  // Run on startup (handled after server boots)
  setTimeout(retryMeetingMinutesAnalysis, 5000);

  // Run every 2 minutes for testing / responsiveness
  cron.schedule('*/2 * * * *', () => {
    console.log('[Minutes Retry Job] Running scheduled retry...');
    retryMeetingMinutesAnalysis();
  });
};
