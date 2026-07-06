const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🤖 Setting Mayank Jhamb as Head of all Team Members...');

  // 1. Find or create Mayank Jhamb
  let mayank = await prisma.teamMember.findFirst({
    where: { name: 'Mayank Jhamb' }
  });

  if (!mayank) {
    console.log('Creating Mayank Jhamb...');
    mayank = await prisma.teamMember.create({
      data: {
        name: 'Mayank Jhamb',
        phone: '+91-99999-88888',

        designation: 'Head of Engineering',
        joiningDate: new Date('2020-01-01'),
        skills: ['Leadership', 'Management', 'System Architecture', 'Agile'],
      }
    });
  } else {
    console.log('Mayank Jhamb already exists.');
  }

  // 2. Set all other members to report to Mayank
  const result = await prisma.teamMember.updateMany({
    where: {
      id: { not: mayank.id }
    },
    data: {
      managerId: mayank.id
    }
  });

  console.log(`Updated ${result.count} team members to report to Mayank Jhamb.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
