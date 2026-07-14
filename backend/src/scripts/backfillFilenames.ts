import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting filename backfill...');

  // 1. Backfill CVs
  const cvs = await prisma.teamMember.findMany({
    where: { cvBlobUrl: { not: null }, cvOriginalFilename: null },
  });
  console.log(`Found ${cvs.length} CVs to backfill.`);
  for (const cv of cvs) {
    const fallbackName = `CV - ${cv.name}.pdf`;
    await prisma.teamMember.update({
      where: { id: cv.id },
      data: { cvOriginalFilename: fallbackName },
    });
    console.log(`Backfilled CV for ${cv.name} -> ${fallbackName}`);
  }

  // 2. Backfill Certificates
  const certs = await prisma.assignedCertification.findMany({
    where: { certificateUrl: { not: null }, originalFilename: null },
    include: { certification: true, member: true },
  });
  console.log(`Found ${certs.length} certificates to backfill.`);
  for (const cert of certs) {
    // Sanitize the certification name to ensure it's a valid filename
    const sanitizedCertName = cert.certification.name.replace(/[^a-zA-Z0-9-_\s]/g, '').trim();
    const fallbackName = `${sanitizedCertName}.pdf`;
    await prisma.assignedCertification.update({
      where: { id: cert.id },
      data: { originalFilename: fallbackName },
    });
    console.log(`Backfilled Certificate for ${cert.member.name} (${cert.certification.name}) -> ${fallbackName}`);
  }

  // 3. Backfill PreSales Docs
  const presales = await prisma.stageChangeLog.findMany({
    where: { blobUrl: { not: null }, originalFilename: null },
  });
  console.log(`Found ${presales.length} PreSales documents to backfill.`);
  for (const doc of presales) {
    const fallbackName = `Document.pdf`; // No context available to extract real name
    await prisma.stageChangeLog.update({
      where: { id: doc.id },
      data: { originalFilename: fallbackName },
    });
    console.log(`Backfilled PreSales document -> ${fallbackName}`);
  }

  console.log('Backfill completed successfully.');
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
