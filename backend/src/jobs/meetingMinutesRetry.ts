import { PrismaClient } from '@prisma/client';
import { generateMeetingMinutes } from '../services/groqExtractor';
import { matchTeamMember, correctNamesInTranscript } from '../utils/fuzzyMatch';
import cron from 'node-cron';

const prisma = new PrismaClient();

export const retryMeetingMinutesAnalysis = async () => {
  try {
    // Database-agnostic JSON check: fetch all records and filter in JS
    const allRecords = await prisma.meetingRecord.findMany();
    const records = allRecords.filter(r => {
      const minutes = r.aiMinutes as any;
      return minutes && minutes.status === 'TOKENS_EXCEEDED';
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

      try {
        const { correctedText, corrections } = correctNamesInTranscript(record.transcriptText || '', contextMembers);
        if (corrections.length > 0) {
          await prisma.meetingRecord.update({
            where: { id: record.id },
            data: { transcriptText: correctedText }
          });
        }

        const finalAiMinutes = await generateMeetingMinutes(correctedText, priorActionItems, priorBlockers);
        if (finalAiMinutes && (finalAiMinutes as any).status !== 'TOKENS_EXCEEDED') {
          (finalAiMinutes as any).name_corrections = corrections;
          // Delete old relational items
          await prisma.meetingAttendee.deleteMany({ where: { meetingRecordId: record.id } });
          await prisma.meetingActionItem.deleteMany({ where: { meetingRecordId: record.id } });
          await prisma.keyDecision.deleteMany({ where: { meetingRecordId: record.id } });
          await prisma.blockerRisk.deleteMany({ where: { firstRaisedMeetingId: record.id } });

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
                meetingRecordId: record.id,
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
            await prisma.keyDecision.createMany({ data: decisionsToCreate });
          }

          // 4. Blockers
          const blockersList = finalAiMinutes.open_risks_blockers || finalAiMinutes.blockers_or_risks || [];
          if (blockersList.length > 0) {
            const blockersToCreate = blockersList.map((b: any) => {
              const description = typeof b === 'string' ? b : b.description;
              const status = typeof b === 'string' ? 'open' : (b.status || 'open');
              return {
                projectId,
                opportunityId,
                firstRaisedMeetingId: record.id,
                description,
                status
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
                resolvedInMeetingId: record.id
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

          // Update meetingRecord with the minutes
          await prisma.meetingRecord.update({
            where: { id: record.id },
            data: { aiMinutes: finalAiMinutes as any }
          });

          console.log(`[Minutes Retry Job] Successfully generated and stored AI minutes for record: ${record.id}`);
        }
      } catch (err: any) {
        console.warn(`[Minutes Retry Job] Failed to retry for record ${record.id}: ${err.message}`);
      }
    }
  } catch (e) {
    console.error('[Minutes Retry Job] Error:', e);
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
