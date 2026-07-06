const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearAll() {
  console.log('🗑️  Clearing all sample data...');
  await prisma.notification.deleteMany();
  console.log('✅ Notifications cleared');
  await prisma.projectMember.deleteMany();
  console.log('✅ Project members cleared');
  await prisma.assignedCertification.deleteMany();
  console.log('✅ Assigned certifications cleared');
  await prisma.project.deleteMany();
  console.log('✅ Projects cleared');
  await prisma.certification.deleteMany();
  console.log('✅ Certifications cleared');
  await prisma.teamMember.deleteMany();
  console.log('✅ Team members cleared');
  console.log('\n🎉 Database is now empty and ready for real data!');
  await prisma.$disconnect();
}

clearAll().catch(e => { console.error(e); process.exit(1); });
