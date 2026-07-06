const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const projects = [
  { name: 'Etihad UC Migration', client: 'Etihad', status: 'IN_PROGRESS', priority: 'HIGH' },
  { name: 'MoHESR', client: 'MoHESR', status: 'IN_PROGRESS', priority: 'HIGH' },
  { name: 'Alvarez & Marshal (A&M)', client: 'Alvarez & Marshal', status: 'IN_PROGRESS', priority: 'MEDIUM' },
  { name: 'Agthia – Master Data Management', client: 'Agthia', status: 'IN_PROGRESS', priority: 'HIGH' },
  { name: 'VSB Energy', client: 'VSB Energy', status: 'IN_PROGRESS', priority: 'MEDIUM' },
  { name: 'Cofra (Anthos)', client: 'Cofra', status: 'IN_PROGRESS', priority: 'MEDIUM' },
  { name: 'Skyshowtime (T&M)', client: 'Skyshowtime', status: 'IN_PROGRESS', priority: 'MEDIUM' },
  { name: 'Sandoz', client: 'Sandoz', status: 'IN_PROGRESS', priority: 'MEDIUM' },
  { name: 'EPC', client: 'EPC', status: 'IN_PROGRESS', priority: 'MEDIUM' },
  { name: 'WCL', client: 'WCL', status: 'IN_PROGRESS', priority: 'MEDIUM' },
  { name: 'SK Finance', client: 'SK Finance', status: 'IN_PROGRESS', priority: 'MEDIUM' },
];

async function main() {
  console.log('Adding projects...');
  for (const p of projects) {
    const created = await prisma.project.create({
      data: {
        name: p.name,
        client: p.client,
        status: p.status,
        priority: p.priority,
        progress: 0,
        startDate: new Date(),
      },
    });
    console.log(`✅ Created: ${created.name}`);
  }
  console.log('\nAll projects added successfully!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
