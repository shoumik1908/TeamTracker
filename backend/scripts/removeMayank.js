const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const mayank = await prisma.teamMember.findFirst({
    where: { name: 'Mayank Jhamb' }
  });

  if (mayank) {
    await prisma.teamMember.delete({
      where: { id: mayank.id }
    });
    console.log(`✅ Removed Mayank Jhamb (ID: ${mayank.id})`);
  } else {
    console.log(`⚠️ Mayank Jhamb not found in database.`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
