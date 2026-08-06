import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const opp = await prisma.preSalesOpportunity.findFirst({
    orderBy: { updatedAt: 'desc' }
  });
  
  console.log("Executive Summary:", opp?.executiveSummary);
  console.log("Scope of Work:", opp?.scopeOfWork);
  console.log("Architecture:", opp?.architecture);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
