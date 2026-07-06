const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Names of certifications added via the screenshot script
const certNamesToRemove = [
  'Fabric Analytics Engineer Associate',
  'Fabric Data Engineer Associate',
  'Power BI Data Analyst Associate',
];

async function main() {
  console.log('🗑️  Finding certifications to remove...');

  const certs = await prisma.certification.findMany({
    where: { name: { in: certNamesToRemove } },
    select: { id: true, name: true },
  });

  if (certs.length === 0) {
    console.log('⚠️  No matching certifications found. Nothing to remove.');
    return;
  }

  const certIds = certs.map(c => c.id);

  console.log(`\n📋 Found ${certs.length} certification(s):`);
  certs.forEach(c => console.log(`  - ${c.name} (${c.id})`));

  // Delete all assignments for these certifications first
  const deleted = await prisma.assignedCertification.deleteMany({
    where: { certificationId: { in: certIds } },
  });
  console.log(`\n✅ Deleted ${deleted.count} assignment(s)`);

  // Now delete the certifications themselves
  const deletedCerts = await prisma.certification.deleteMany({
    where: { id: { in: certIds } },
  });
  console.log(`✅ Deleted ${deletedCerts.count} certification(s) from catalog`);

  console.log('\n🎉 Done!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
