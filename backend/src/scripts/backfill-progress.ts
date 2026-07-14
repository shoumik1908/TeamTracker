/**
 * backfill-progress.ts
 * One-time script: sets progressPercent = stageLowerBound(currentStageIndex)
 * for every existing PreSalesOpportunity row that has progressPercent = 0
 * and currentStageIndex > 0 (so genuinely unset rows get their proper value).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function stageLowerBound(stageIndex: number, total: number): number {
  return Math.round((stageIndex / total) * 100);
}

async function main() {
  const opps = await prisma.preSalesOpportunity.findMany();
  console.log(`Found ${opps.length} opportunity rows to check.`);

  let updated = 0;
  for (const opp of opps) {
    const expectedPercent = stageLowerBound(opp.currentStageIndex, opp.stages.length);
    // Only backfill if percent is 0 and index > 0, OR if it's just 0 and stage is 0 (already correct)
    if (opp.progressPercent === 0 && opp.currentStageIndex > 0) {
      await prisma.preSalesOpportunity.update({
        where: { id: opp.id },
        data: { progressPercent: expectedPercent },
      });
      console.log(`  ${opp.account} "${opp.name}" (${opp.clientName}): stage ${opp.currentStageIndex} → ${expectedPercent}%`);
      updated++;
    }
  }

  console.log(`\nBackfill complete. Updated ${updated} rows.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
