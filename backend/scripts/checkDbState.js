const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true, name: true } });
  const members = await prisma.teamMember.findMany({ select: { id: true, name: true } });
  console.log("PROJECTS IN DB:");
  console.log(JSON.stringify(projects, null, 2));
  console.log("\nMEMBERS IN DB:");
  console.log(JSON.stringify(members, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
