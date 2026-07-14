import { PrismaClient } from '@prisma/client';
import { generateMeetingMinutes, AllowedMemberName } from '../services/groqExtractor';

const prisma = new PrismaClient();

async function main() {
  try {
    const record = await prisma.meetingRecord.findFirst({
      where: {
        OR: [
          { meetingTitle: { contains: 'test' } },
          { transcriptText: { contains: 'Landsec' } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!record) {
      console.error('CRITICAL: No matching meeting record found to run schema test.');
      process.exit(1);
    }

    console.log(`Running test against record: ${record.id} - ${record.meetingTitle}`);
    const transcriptText = record.transcriptText || '';

    // Fetch previous context
    const recordWhere = record.projectId 
      ? { projectId: record.projectId }
      : { opportunityId: record.opportunityId };

    const rawItems = await prisma.meetingActionItem.findMany({
      where: {
        meetingRecord: recordWhere,
        status: 'open',
      },
      include: { assignedTo: true }
    });
    const priorActionItems = rawItems.map(i => ({
      id: i.id,
      task: i.task,
      owner: i.assignedTo ? i.assignedTo.name : i.originalOwnerText
    }));

    const rawBlockers = await prisma.blockerRisk.findMany({
      where: {
        ...recordWhere,
        status: 'open',
      }
    });
    const priorBlockers = rawBlockers.map(b => ({
      id: b.id,
      description: b.description
    }));

    console.log("Calling generateMeetingMinutes with strict JSON Schema enums...");
    const result = await generateMeetingMinutes(transcriptText, priorActionItems, priorBlockers);

    if (!result) {
      console.error("FAIL: generateMeetingMinutes returned null.");
      process.exit(1);
    }

    console.log("=== PARSED MINUTES OUTPUT ===");
    console.log(JSON.stringify(result, null, 2));

    const allowedNames: AllowedMemberName[] = ["Naved Hashmi", "Mayank Tiwari", "Deepankar Panchal", "Saqib", "Unassigned"];

    let hasErrors = false;

    // 1. Assert attendees_present
    if (result.attendees_present) {
      for (const att of result.attendees_present) {
        if (!allowedNames.includes(att)) {
          console.error(`FAIL: attendees_present contains invalid name "${att}"`);
          hasErrors = true;
        }
      }
    }

    // 2. Assert attendees_referenced_not_present
    if (result.attendees_referenced_not_present) {
      for (const att of result.attendees_referenced_not_present) {
        if (!allowedNames.includes(att)) {
          console.error(`FAIL: attendees_referenced_not_present contains invalid name "${att}"`);
          hasErrors = true;
        }
      }
    }

    // 3. Assert action_items owners
    if (result.action_items) {
      for (const ai of result.action_items) {
        if (ai.owner !== null && !allowedNames.includes(ai.owner)) {
          console.error(`FAIL: Action item owner "${ai.owner}" is not in the allowed list.`);
          hasErrors = true;
        }
      }
    }

    // 4. Assert decisions owners
    if (result.decisions) {
      for (const dec of result.decisions) {
        if (dec.owner !== null && !allowedNames.includes(dec.owner)) {
          console.error(`FAIL: Decision owner "${dec.owner}" is not in the allowed list.`);
          hasErrors = true;
        }
      }
    }

    if (hasErrors) {
      console.error("\nTEST STATUS: FAILED. Schema enums were violated.");
      process.exit(1);
    } else {
      console.log("\nTEST STATUS: SUCCESS. All owners and attendees strictly conform to allowed enums!");
    }
  } catch (e: any) {
    console.error('Test execution failed:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
