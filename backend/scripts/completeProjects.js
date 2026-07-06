const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const completedProjects = [
  { name: 'Aleef', client: 'Aleef' },
  { name: 'Cofra (Sunrock)', client: 'Cofra' },
  { name: 'Zensar', client: 'Zensar' },
  { name: 'Etihad UC Migration', client: 'Etihad' },
  { name: 'Sephora', client: 'Sephora' },
  { name: 'Delta Vacations', client: 'Delta' },
  { name: 'Delta BOA Team – RTI', client: 'Delta' },
  { name: 'Protiviti', client: 'Protiviti' },
  { name: 'Aditya Birla', client: 'Aditya Birla' }
];

async function main() {
  console.log('Synchronizing completed projects in DB...');
  
  for (const item of completedProjects) {
    const existing = await prisma.project.findFirst({
      where: { name: { equals: item.name, mode: 'insensitive' } }
    });

    if (existing) {
      await prisma.project.update({
        where: { id: existing.id },
        data: {
          status: 'COMPLETED',
          progress: 100
        }
      });
      console.log(`✅ Updated status to COMPLETED: ${existing.name}`);
    } else {
      const created = await prisma.project.create({
        data: {
          name: item.name,
          client: item.client,
          status: 'COMPLETED',
          progress: 100,
          startDate: new Date(),
          priority: 'MEDIUM'
        }
      });
      console.log(`🆕 Created as COMPLETED: ${created.name}`);
    }
  }
  
  console.log('\nCompleted projects sync completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
