const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
    description: 'Microsoft Certified: Fabric Data Engineer Associate (DP-700)',
    duration: '~40 hours',
    certCode: 'DP-700',
  },
  {
    name: 'Power BI Data Analyst Associate',
    provider: 'Microsoft',
    description: 'Microsoft Certified: Power BI Data Analyst Associate',
    duration: '~30 hours',
    certCode: 'PL-300',
  },
];

const assignments = [
  { memberName: 'Aditi Pachori', certCode: 'DP-600', completionDate: '2025-11-14', expiryDate: '2026-11-14' },
  { memberName: 'Aditi Pachori', certCode: 'DP-700', completionDate: '2025-06-05', expiryDate: '2026-06-05', remarks: 'expired' },
  { memberName: 'Aditya Aggarwal', certCode: 'DP-700', completionDate: '2026-06-26', expiryDate: '2027-06-27' },
  { memberName: 'Ankit Nagar', certCode: 'DP-700', completionDate: '2025-12-28', expiryDate: '2026-12-29' },
  { memberName: 'Kanchan Palkar', certCode: 'DP-700', completionDate: null, expiryDate: null },
  { memberName: 'Kanishka Kumawat', certCode: 'DP-700', completionDate: '2026-06-24', expiryDate: '2027-06-25' },
  { memberName: 'Krishna Sharma', certCode: 'DP-700', completionDate: '2025-05-01', expiryDate: '2026-05-01', remarks: 'expired' },
  { memberName: 'Madhura Dale', certCode: 'DP-700', completionDate: '2025-03-30', expiryDate: '2026-03-30', remarks: 'Expired' },
  { memberName: 'Khanak Sharma', certCode: 'DP-700', completionDate: '2026-05-27', expiryDate: null },
  { memberName: 'Pankaj Bana', certCode: 'DP-600', completionDate: '2024-12-29', expiryDate: '2026-12-30' },
  { memberName: 'Pankaj Bana', certCode: 'DP-700', completionDate: '2025-06-19', expiryDate: '2027-06-19' },
  { memberName: 'Madhav Pareek', certCode: 'DP-700', completionDate: '2026-05-27', expiryDate: '2028-06-27' },
  { memberName: 'Rishabh Jain', certCode: 'DP-700', completionDate: '2025-11-02', expiryDate: '2026-11-03' },
  { memberName: 'Nilesh Tiwari', certCode: 'DP-700', completionDate: null, expiryDate: null },
  { memberName: 'Nishi Sharma', certCode: 'DP-700', completionDate: '2026-06-22', expiryDate: '2027-06-23' },
  { memberName: 'Vaibhav Tiwari', certCode: 'DP-600', completionDate: '2024-12-29', expiryDate: '2026-12-30' },
  { memberName: 'Vaibhav Tiwari', certCode: 'DP-700', completionDate: '2026-06-17', expiryDate: '2027-06-18' },
  { memberName: 'Suhani Jain', certCode: 'DP-700', completionDate: '2026-06-23', expiryDate: '2027-06-24' },
  { memberName: 'Vinita Garg', certCode: 'DP-700', completionDate: '2025-12-30', expiryDate: '2026-12-31' },
];

function computeStatus(completionDate, expiryDate) {
  if (!completionDate) return 'COMPLETED'; 
  if (expiryDate) {
    const expiry = new Date(expiryDate);
    const now = new Date();
    if (expiry < now) return 'COMPLETED'; 
  }
  return 'COMPLETED';
}

async function main() {
  console.log('📋 Creating certification catalog entries...');

  const certMap = {};
  for (const cert of certData) {
    const existing = await prisma.certification.findFirst({ where: { name: cert.name } });
    if (existing) {
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
      certMap[cert.certCode] = created.id;
    }
  }

  const allMembers = await prisma.teamMember.findMany({ select: { id: true, name: true } });
  const memberMap = {};
  for (const m of allMembers) {
    memberMap[m.name.trim().toLowerCase()] = m.id;
  }
  // alias for NileshTiwari
  memberMap['nileshtiwari'] = memberMap['nilesh tiwari'];

  let created = 0;
  for (const a of assignments) {
    const certId = certMap[a.certCode];
    const memberId = memberMap[a.memberName.trim().toLowerCase().replace(' ', '')] || memberMap[a.memberName.trim().toLowerCase()];
    if (!certId || !memberId) continue;

    const existing = await prisma.assignedCertification.findFirst({
      where: { memberId, certificationId: certId },
    });

    if (existing) continue;

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
    created++;
  }
  console.log(`✅ Created ${created} assignments`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
