const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('👥 Fetching all team members...');
  const allMembers = await prisma.teamMember.findMany();
  console.log(`  Found ${allMembers.length} team members.`);

  console.log('📋 Fetching all certifications...');
  const allCerts = await prisma.certification.findMany();
  console.log(`  Found ${allCerts.length} certifications.`);

  let createdCount = 0;
  let skippedCount = 0;

  console.log('🚀 Checking and assigning all certifications to all members...');
  for (const member of allMembers) {
    for (const cert of allCerts) {
      // Check if assignment already exists
      const existing = await prisma.assignedCertification.findFirst({
        where: {
          memberId: member.id,
          certificationId: cert.id
        }
      });

      if (!existing) {
        // Create a new assignment with default values
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

        await prisma.assignedCertification.create({
          data: {
            memberId: member.id,
            certificationId: cert.id,
            assignedDate: new Date(),
            deadline: oneYearFromNow,
            status: 'NOT_STARTED',
            progress: 0,
            priority: 'MEDIUM',
            notes: 'Auto-assigned to complete catalog'
          }
        });
        createdCount++;
      } else {
        skippedCount++;
      }
    }
  }

  console.log(`✅ Done! Created ${createdCount} new certification assignments. Skipped ${skippedCount} existing assignments.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
