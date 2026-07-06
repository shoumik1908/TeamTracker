const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Certification data from the spreadsheet
// Certifications: DP-600 = Fabric Analytics Engineer Associate, DP-203 = Fabric Data Engineer Associate, PBI = Power BI Data Analyst Associate

const certData = [
  {
    name: 'Fabric Analytics Engineer Associate',
    provider: 'Microsoft',
    description: 'Microsoft Certified: Fabric Analytics Engineer Associate (DP-600)',
    duration: '~40 hours',
    certCode: 'DP-600',
  },
  {
    name: 'Fabric Data Engineer Associate',
    provider: 'Microsoft',
    description: 'Microsoft Certified: Fabric Data Engineer Associate (DP-203)',
    duration: '~40 hours',
    certCode: 'DP-203',
  },
  {
    name: 'Power BI Data Analyst Associate',
    provider: 'Microsoft',
    description: 'Microsoft Certified: Power BI Data Analyst Associate (PL-300)',
    duration: '~30 hours',
    certCode: 'PL-300',
  },
];

// Assignment data parsed from the spreadsheet image:
// Format: { memberName, certCode, completionDate, expiryDate, remarks }
// Only entries where Yes is marked and/or dates are available
const assignments = [
  // Aditi Pachori
  { memberName: 'Aditi Pachori', certCode: 'DP-600', completionDate: null, expiryDate: null }, // Yes but no dates visible
  { memberName: 'Aditi Pachori', certCode: 'DP-203', completionDate: '2025-06-05', expiryDate: '2026-06-05' },

  // Aditya Aggarwal
  { memberName: 'Aditya Aggarwal', certCode: 'DP-203', completionDate: '2026-06-26', expiryDate: '2027-06-27' },

  // Alka Kaushik
  { memberName: 'Alka Kaushik', certCode: 'DP-203', completionDate: '2025-12-28', expiryDate: '2026-12-29' },

  // Kanchan Palkar
  { memberName: 'Kanchan Palkar', certCode: 'DP-203', completionDate: null, expiryDate: null }, // Yes but no dates

  // Kanishka Kumawat
  { memberName: 'Kanishka Kumawat', certCode: 'DP-203', completionDate: '2026-06-24', expiryDate: '2027-06-25' },

  // Krishna Sharma
  { memberName: 'Krishna Sharma', certCode: 'DP-203', completionDate: '2025-05-01', expiryDate: '2026-05-01', remarks: 'expired' },

  // Madhura Dale
  { memberName: 'Madhura Dale', certCode: 'DP-203', completionDate: '2025-03-30', expiryDate: '2026-03-30', remarks: 'Expired' },

  // Khanak Sharma
  { memberName: 'Khanak Sharma', certCode: 'DP-203', completionDate: '2026-05-27', expiryDate: null },

  // Pankaj Bana
  { memberName: 'Pankaj Bana', certCode: 'DP-600', completionDate: '2024-12-29', expiryDate: '2026-12-30' },
  { memberName: 'Pankaj Bana', certCode: 'DP-203', completionDate: '2025-06-19', expiryDate: '2027-06-19' },

  // Madhav Pareek
  { memberName: 'Madhav Pareek', certCode: 'DP-203', completionDate: '2026-05-27', expiryDate: '2028-05-27' },

  // Rishabh Jain
  { memberName: 'Rishabh Jain', certCode: 'DP-203', completionDate: '2025-11-02', expiryDate: '2026-11-03' },

  // NileshTiwari
  { memberName: 'Nilesh Tiwari', certCode: 'DP-203', completionDate: null, expiryDate: null }, // Yes but no dates

  // Nishi Sharma
  { memberName: 'Nishi Sharma', certCode: 'DP-203', completionDate: '2026-06-22', expiryDate: '2027-06-23' },

  // Vaibhav Tiwari
  { memberName: 'Vaibhav Tiwari', certCode: 'DP-600', completionDate: '2024-12-29', expiryDate: '2026-12-30' },
  { memberName: 'Vaibhav Tiwari', certCode: 'DP-203', completionDate: '2026-06-17', expiryDate: '2027-06-18' },

  // Sasiram Kolisetty
  { memberName: 'Sasiram Kolisetty', certCode: 'DP-203', completionDate: '2026-06-23', expiryDate: '2027-06-24' },

  // Vinita Garg
  { memberName: 'Vinita Garg', certCode: 'DP-203', completionDate: '2025-12-30', expiryDate: '2026-12-31' },
];

function computeStatus(completionDate, expiryDate) {
  if (!completionDate) return 'COMPLETED'; // Marked Yes but no date — treat as completed
  if (expiryDate) {
    const expiry = new Date(expiryDate);
    const now = new Date();
    if (expiry < now) return 'COMPLETED'; // expired but was completed
  }
  return 'COMPLETED';
}

async function main() {
  console.log('📋 Creating certification catalog entries...');

  const certMap = {};
  for (const cert of certData) {
    // Upsert by name
    const existing = await prisma.certification.findFirst({ where: { name: cert.name } });
    if (existing) {
      console.log(`  ✅ Exists: ${cert.name}`);
      certMap[cert.certCode] = existing.id;
    } else {
      const created = await prisma.certification.create({
        data: {
          name: cert.name,
          provider: cert.provider,
          description: cert.description,
          duration: cert.duration,
        },
      });
      console.log(`  ➕ Created: ${cert.name}`);
      certMap[cert.certCode] = created.id;
    }
  }

  console.log('\n👥 Looking up members...');
  const allMembers = await prisma.teamMember.findMany({ select: { id: true, name: true } });
  const memberMap = {};
  for (const m of allMembers) {
    memberMap[m.name.trim().toLowerCase()] = m.id;
  }

  console.log('\n📝 Adding assignments...');
  let created = 0;
  let skipped = 0;
  let notFound = 0;

  for (const a of assignments) {
    const certId = certMap[a.certCode];
    if (!certId) {
      console.log(`  ⚠️  Cert not found: ${a.certCode}`);
      continue;
    }

    const memberId = memberMap[a.memberName.trim().toLowerCase()];
    if (!memberId) {
      console.log(`  ⚠️  Member not found: ${a.memberName}`);
      notFound++;
      continue;
    }

    // Check if assignment already exists
    const existing = await prisma.assignedCertification.findFirst({
      where: { memberId, certificationId: certId },
    });

    if (existing) {
      console.log(`  ⏭️  Already assigned: ${a.memberName} → ${a.certCode}`);
      skipped++;
      continue;
    }

    const status = computeStatus(a.completionDate, a.expiryDate);
    const deadline = a.expiryDate || a.completionDate || new Date().toISOString().split('T')[0];

    await prisma.assignedCertification.create({
      data: {
        memberId,
        certificationId: certId,
        assignedDate: a.completionDate ? new Date(a.completionDate) : new Date(),
        deadline: new Date(deadline),
        priority: 'HIGH',
        status,
        progress: status === 'COMPLETED' ? 100 : 50,
        completionDate: a.completionDate ? new Date(a.completionDate) : null,
        expiryDate: a.expiryDate ? new Date(a.expiryDate) : null,
        notes: a.remarks || null,
      },
    });

    console.log(`  ✅ Assigned: ${a.memberName} → ${a.certCode} (${status})`);
    created++;
  }

  console.log(`\n🎉 Done! Created: ${created}, Skipped (duplicates): ${skipped}, Members not found: ${notFound}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
