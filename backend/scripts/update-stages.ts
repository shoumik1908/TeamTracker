import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

async function main() {
  console.log('🔄 Migrating existing opportunities in PostgreSQL...');
  
  const opportunities = await prisma.preSalesOpportunity.findMany();
  
  for (const opp of opportunities) {
    const newStages = opp.account === 'PNB' ? pnbStages : tnmStages;
    await prisma.preSalesOpportunity.update({
      where: { id: opp.id },
      data: {
        stages: newStages,
        currentStageIndex: Math.min(opp.currentStageIndex, newStages.length - 1)
      }
    });
    console.log(`✅ Updated opportunity "${opp.name}" (${opp.account})`);
  }
  
  console.log('🎉 Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
