const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Data parsed carefully from PDF 1 (Databricks) and PDF 2 (Azure/Microsoft)
const data = [
  // 1. Aditi Pachori
  {
    name: 'Aditi Pachori',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: '2026-01-01', expiry: '2028-01-01' },
      { certName: 'Databricks Certified Data Engineer Professional', completion: '2026-01-01', expiry: '2028-01-01' },
      { certName: 'Databricks Certified Data Analyst Associate', completion: '2026-01-01', expiry: '2028-01-01' },
      { certName: 'Azure Data Engineer Associate: DP-203', completion: '2024-04-07', expiry: '2025-04-08', notes: 'This Certification has been EXPIRED ! DP-900 is the renewed version' }
    ]
  },
  // 2. Aditya Aggarwal
  {
    name: 'Aditya Aggarwal',
    certs: []
  },
  // 3. Aditya Shriniwas Pallati
  {
    name: 'Aditya Shriniwas Pallati',
    certs: [
      { certName: 'Azure Fundamentals: AZ-900', completion: '2021-12-01', expiry: null, notes: 'Lifetime' },
      { certName: 'Azure Data Fundamentals: DP-900', completion: '2021-12-01', expiry: null, notes: 'Lifetime' },
      { certName: 'Azure AI Fundamentals: AI-900', completion: '2021-12-01', expiry: null, notes: 'Lifetime' }
    ]
  },
  // 4. Akshay Patel
  {
    name: 'Akshay Patel',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: '2026-06-28', expiry: '2028-06-28' },
      { certName: 'Databricks Certified Data Engineer Professional', completion: '2023-03-23', expiry: '2025-03-23', notes: 'expired' },
      { certName: 'Azure Fundamentals: AZ-900', completion: '2021-12-01', expiry: null, notes: 'Lifetime' },
      { certName: 'Azure Data Engineer Associate: DP-203', completion: '2021-06-30', expiry: '2022-07-01', notes: 'expired' }
    ]
  },
  // 5. Alka Kaushik
  {
    name: 'Alka Kaushik',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: '2025-02-01', expiry: '2027-02-01' },
      { certName: 'Databricks Certified Data Engineer Professional', completion: '2026-02-01', expiry: '2028-02-01', notes: 'In Xebia' },
      { certName: 'Databricks Certified Generative AI Associate', completion: '2025-08-01', expiry: '2027-08-01' }
    ]
  },
  // 6. Ankit Nagar
  {
    name: 'Ankit Nagar',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: '2026-02-11', expiry: '2028-02-11' }
    ]
  },
  // 7. Ashok Chaudhary
  {
    name: 'Ashok Chaudhary',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: null, expiry: null },
      { certName: 'Databricks Certified Data Engineer Professional', completion: null, expiry: null },
      { certName: 'Databricks Certified Data Analyst Associate', completion: null, expiry: null },
      { certName: 'Azure Fundamentals: AZ-900', completion: '2022-01-01', expiry: null, notes: 'Lifetime' },
      { certName: 'Azure Data Fundamentals: DP-900', completion: '2022-01-01', expiry: null, notes: 'Lifetime' }
    ]
  },
  // 8. Ayush Joshi
  {
    name: 'Ayush Joshi',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: '2025-07-28', expiry: '2027-07-28' },
      { certName: 'Azure Fundamentals: AZ-900', completion: null, expiry: null, notes: 'Lifetime' }
    ]
  },
  // 9. Ayush Paldecha
  {
    name: 'Ayush Paldecha',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: '2025-08-01', expiry: '2027-08-01', notes: 'Renewal in xebia' },
      { certName: 'Databricks Certified Data Engineer Professional', completion: null, expiry: '2026-03-01', notes: 'expired' }
    ]
  },
  // 10. Deepankar Panchal
  {
    name: 'Deepankar Panchal',
    certs: []
  },
  // 11. Dhruv Safaya
  {
    name: 'Dhruv Safaya',
    certs: [
      { certName: 'Databricks Certified Data Engineer Professional', completion: null, expiry: '2026-01-01', notes: 'expired' },
      { certName: 'Azure Fundamentals: AZ-900', completion: '2023-01-01', expiry: null, notes: 'Lifetime' }
    ]
  },
  // 12. Kamal Swami
  {
    name: 'Kamal Swami',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: null, expiry: null },
      { certName: 'Azure Fundamentals: AZ-900', completion: '2022-01-01', expiry: null, notes: 'Lifetime' },
      { certName: 'Azure Developer Associate: AZ-204', completion: null, expiry: null }
    ]
  },
  // 13. Kanchan Palkar
  {
    name: 'Kanchan Palkar',
    certs: []
  },
  // 14. Kanishka Kumawat
  {
    name: 'Kanishka Kumawat',
    certs: []
  },
  // 15. Kartik Jha
  {
    name: 'Kartik Jha',
    certs: []
  },
  // 16. Khanak Sharma
  {
    name: 'Khanak Sharma',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: '2025-08-09', expiry: '2027-08-09' },
      { certName: 'Databricks Certified Data Engineer Professional', completion: null, expiry: null, notes: 'expired' },
      { certName: 'Azure Fundamentals: AZ-900', completion: '2021-06-01', expiry: null, notes: 'Lifetime' },
      { certName: 'Azure Data Fundamentals: DP-900', completion: '2022-01-01', expiry: null, notes: 'Lifetime' }
    ]
  },
  // 17. Krishna Sharma
  {
    name: 'Krishna Sharma',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: '2025-01-01', expiry: '2027-01-01' },
      { certName: 'Databricks Certified Data Engineer Professional', completion: '2024-01-01', expiry: '2028-01-01' },
      { certName: 'Azure Fundamentals: AZ-900', completion: '2022-08-01', expiry: null, notes: 'Lifetime' },
      { certName: 'Azure Data Engineer Associate: DP-203', completion: '2023-06-01', expiry: '2024-06-01', notes: 'expired' }
    ]
  },
  // 18. Madhav Pareek
  {
    name: 'Madhav Pareek',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: '2025-08-07', expiry: '2027-08-07', notes: 'In Xebia' },
      { certName: 'Databricks Certified Data Engineer Professional', completion: '2024-01-01', expiry: '2026-01-01', notes: 'expired' },
      { certName: 'Azure Data Engineer Associate: DP-203', completion: '2022-01-01', expiry: '2023-01-01', notes: 'expired' }
    ]
  },
  // 19. Madhura Dale
  {
    name: 'Madhura Dale',
    certs: []
  },
  // 20. Nilesh Tiwari
  {
    name: 'Nilesh Tiwari',
    certs: [
      { certName: 'Databricks Certified Data Engineer Professional', completion: '2025-09-23', expiry: '2027-09-23' }
    ]
  },
  // 21. Nishi Sharma
  {
    name: 'Nishi Sharma',
    certs: []
  },
  // 22. Pankaj Bana
  {
    name: 'Pankaj Bana',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: '2025-04-01', expiry: '2027-04-01' },
      { certName: 'Databricks Certified Data Engineer Professional', completion: '2025-08-01', expiry: '2027-08-01' },
      { certName: 'Azure Fundamentals: AZ-900', completion: '2024-12-01', expiry: null, notes: 'Lifetime' },
      { certName: 'Azure Data Fundamentals: DP-900', completion: '2025-06-01', expiry: null, notes: 'Lifetime' }
    ]
  },
  // 23. Prabal Sharma
  {
    name: 'Prabal Sharma',
    certs: []
  },
  // 24. Rahul Mahato
  {
    name: 'Rahul Mahato',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: '2025-02-01', expiry: '2027-02-01' },
      { certName: 'Databricks Certified Data Engineer Professional', completion: '2025-08-01', expiry: '2027-08-01' }
    ]
  },
  // 25. Rishabh Jain
  {
    name: 'Rishabh Jain',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: '2022-12-28', expiry: '2027-09-29' },
      { certName: 'Databricks Certified Data Engineer Professional', completion: '2023-12-03', expiry: '2027-12-20' },
      { certName: 'Azure Fundamentals: AZ-900', completion: null, expiry: null },
      { certName: 'Azure Data Fundamentals: DP-900', completion: null, expiry: null }
    ]
  },
  // 26. Sachin MR
  {
    name: 'Sachin MR',
    certs: [
      { certName: 'Azure Fundamentals: AZ-900', completion: null, expiry: null }
    ]
  },
  // 27. Salman Mandal
  {
    name: 'Salman Mandal',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: '2026-02-15', expiry: '2028-02-15' },
      { certName: 'Databricks Certified Data Engineer Professional', completion: '2025-02-02', expiry: '2027-02-02' }
    ]
  },
  // 28. Sasiram Kolisetty
  {
    name: 'Sasiram Kolisetty',
    certs: []
  },
  // 29. Suhani Jain
  {
    name: 'Suhani Jain',
    certs: []
  },
  // 30. Suryadev Rathore
  {
    name: 'Suryadev Rathore',
    certs: []
  },
  // 31. Uday Gupta
  {
    name: 'Uday Gupta',
    certs: [
      { certName: 'Databricks Certified Data Engineer Professional', completion: '2025-04-01', expiry: '2027-04-01' }
    ]
  },
  // 32. Vaibhav Tiwari
  {
    name: 'Vaibhav Tiwari',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: '2025-05-01', expiry: '2027-05-01' },
      { certName: 'Databricks Certified Data Analyst Associate', completion: '2026-01-01', expiry: '2028-01-01' },
      { certName: 'Azure Fundamentals: AZ-900', completion: '2022-01-01', expiry: null, notes: 'Lifetime' },
      { certName: 'Azure Data Fundamentals: DP-900', completion: '2022-01-01', expiry: null, notes: 'Lifetime' },
      { certName: 'Azure AI Fundamentals: AI-900', completion: '2026-05-14', expiry: '2027-05-15' }
    ]
  },
  // 33. Vikas Kumawat
  {
    name: 'Vikas Kumawat',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: '2023-01-01', expiry: '2025-01-01', notes: 'expired' },
      { certName: 'Databricks Certified Data Engineer Professional', completion: '2023-09-01', expiry: '2025-09-01', notes: 'expired' },
      { certName: 'Azure Fundamentals: AZ-900', completion: null, expiry: null },
      { certName: 'Azure Data Fundamentals: DP-900', completion: null, expiry: null }
    ]
  },
  // 34. Vinita Garg
  {
    name: 'Vinita Garg',
    certs: [
      { certName: 'Databricks Certified Data Engineer Associate', completion: '2026-02-01', expiry: '2028-02-01' }
    ]
  },
  // 35. Yash Gupta
  {
    name: 'Yash Gupta',
    certs: []
  },
  // 36. Yogesh Lamba
  {
    name: 'Yogesh Lamba',
    certs: []
  },
  // 37. Zillur Rehman
  {
    name: 'Zillur Rehman',
    certs: [
      { certName: 'Databricks Certified Data Engineer Professional', completion: '2024-05-01', expiry: '2026-05-01', notes: 'expired' }
    ]
  }
];

async function main() {
  console.log('🧹 Clearing old assigned certifications...');
  const deleted = await prisma.assignedCertification.deleteMany();
  console.log(`🧹 Deleted ${deleted.count} existing records.`);

  console.log('👥 Fetching team members...');
  const allMembers = await prisma.teamMember.findMany();
  const memberMap = {};
  for (const m of allMembers) {
    memberMap[m.name.trim().toLowerCase()] = m.id;
  }

  console.log('📋 Fetching certifications...');
  const allCerts = await prisma.certification.findMany();
  const certMap = {};
  for (const c of allCerts) {
    certMap[c.name.trim().toLowerCase()] = c.id;
  }

  let createdCount = 0;

  console.log('🚀 Assigning parsed certifications to team members...');
  for (const person of data) {
    const memberId = memberMap[person.name.trim().toLowerCase()];
    if (!memberId) {
      console.log(`⚠️ Member not found in database: ${person.name}`);
      continue;
    }

    for (const certInfo of person.certs) {
      const certId = certMap[certInfo.certName.trim().toLowerCase()];
      if (!certId) {
        console.log(`⚠️ Certification not found in database: ${certInfo.certName}`);
        continue;
      }

      // Compute status based on expiry
      let status = 'COMPLETED';
      let progress = 100;
      if (certInfo.expiry) {
        const expiryDateObj = new Date(certInfo.expiry);
        if (expiryDateObj < new Date()) {
          status = 'EXPIRED'; // It is expired
          progress = 100;
        }
      }

      const assignedDate = certInfo.completion ? new Date(certInfo.completion) : new Date();
      const deadline = certInfo.expiry ? new Date(certInfo.expiry) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year default if no expiry

      await prisma.assignedCertification.create({
        data: {
          memberId,
          certificationId: certId,
          assignedDate,
          deadline,
          status,
          progress,
          completionDate: certInfo.completion ? new Date(certInfo.completion) : null,
          expiryDate: certInfo.expiry ? new Date(certInfo.expiry) : null,
          notes: certInfo.notes || null,
          priority: 'MEDIUM'
        }
      });

      createdCount++;
    }
  }

  console.log(`✅ Success! Carefully inserted ${createdCount} certification records.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
