const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const mapping = [
  { name: "Aditi Pachori", projects: ["Etihad UC Migration"] },
  { name: "Aditya Aggarwal", projects: ["Etihad UC Migration", "Agthia – Master Data Management"] },
  { name: "Aditya Shriniwas Pallati", projects: ["Etihad UC Migration"] },
  { name: "Akshay Patel", projects: ["VSB Energy"] },
  { name: "Alka Kaushik", projects: ["Alvarez & Marshal (A&M)", "MoHESR"] },
  { name: "Ankit Nagar", projects: ["Cofra (Anthos)"] },
  { name: "Ashok Chaudhary", projects: ["MoHESR"] },
  { name: "Ayush Joshi", projects: ["Alvarez & Marshal (A&M)"] },
  { name: "Ayush Paldecha", projects: ["SK Finance"] },
  { name: "Deepankar Panchal", projects: ["Etihad UC Migration"] },
  { name: "Dhruv Safaya", projects: ["Skyshowtime (T&M)"] },
  { name: "Kamal Swami", projects: ["Sandoz"] },
  { name: "Kanchan Palkar", projects: ["MoHESR"] },
  { name: "Kanishka Kumawat", projects: ["Etihad UC Migration"] },
  { name: "Kartik Jha", projects: ["Alvarez & Marshal (A&M)", "A&m"] },
  { name: "Khanak Sharma", projects: ["Delta Vacations"] },
  { name: "Krishna Sharma", projects: ["Aleef"] },
  { name: "Madhav Pareek", projects: ["Etihad UC Migration"] },
  { name: "Madhura Dale", projects: ["Aleef"] },
  { name: "Nilesh Tiwari", projects: ["MoHESR"] },
  { name: "Nishi Sharma", projects: ["Etihad UC Migration"] },
  { name: "Pankaj Bana", projects: ["MoHESR"] },
  { name: "Prabal Sharma", projects: ["Aleef"] },
  { name: "Rahul Mahato", projects: ["MoHESR"] },
  { name: "Rishabh Jain", projects: ["Alvarez & Marshal (A&M)", "ABFRL T&M (yet to start)"] },
  { name: "Sachin MR", projects: ["EPC"] },
  { name: "Salman Mandal", projects: ["MoHESR"] },
  { name: "Sasiram Kolisetty", projects: [] },
  { name: "Suhani Jain", projects: ["Delta Vacations", "Etihad UC Migration"] },
  { name: "Suryadev Rathore", projects: ["WCL", "MoHESR"] },
  { name: "Uday Gupta", projects: ["Etihad UC Migration"] },
  { name: "Vaibhav Tiwari", projects: ["SK Finance"] },
  { name: "Vikas Kumawat", projects: ["Etihad UC Migration"] },
  { name: "Vinita Garg", projects: ["SK Finance"] },
  { name: "Yash Gupta", projects: ["Etihad UC Migration"] },
  { name: "Yogesh Lamba", projects: ["MoHESR"] },
  { name: "Zillur Rehman", projects: ["Etihad UC Migration"] }
];

async function main() {
  console.log("Ensuring special projects from PDF exist in DB...");
  const extraProjects = [
    { name: "Delta Vacations", client: "Delta", status: "IN_PROGRESS", priority: "MEDIUM" },
    { name: "Aleef", client: "Aleef", status: "IN_PROGRESS", priority: "MEDIUM" },
    { name: "ABFRL T&M (yet to start)", client: "ABFRL", status: "PLANNING", priority: "LOW" }
  ];

  for (const ep of extraProjects) {
    const existing = await prisma.project.findFirst({ where: { name: ep.name } });
    if (!existing) {
      await prisma.project.create({
        data: {
          name: ep.name,
          client: ep.client,
          status: ep.status,
          priority: ep.priority,
          progress: 0,
          startDate: new Date()
        }
      });
      console.log(`✅ Created extra project: ${ep.name}`);
    }
  }

  console.log("\nDeleting existing project member assignments to start clean...");
  await prisma.projectMember.deleteMany({});
  console.log("✅ Cleared project member assignments.");

  const allProjects = await prisma.project.findMany();
  const allMembers = await prisma.teamMember.findMany();

  const projectMap = {};
  allProjects.forEach(p => {
    projectMap[p.name.toLowerCase().trim()] = p.id;
  });

  const memberMap = {};
  allMembers.forEach(m => {
    memberMap[m.name.toLowerCase().trim()] = m.id;
  });

  console.log("\nAssigning members to their respective projects...");
  let count = 0;
  for (const item of mapping) {
    const memberId = memberMap[item.name.toLowerCase().trim()];
    if (!memberId) {
      console.error(`❌ Member not found in database: ${item.name}`);
      continue;
    }

    for (const pName of item.projects) {
      const projectId = projectMap[pName.toLowerCase().trim()];
      if (!projectId) {
        console.error(`❌ Project not found in database: ${pName}`);
        continue;
      }

      await prisma.projectMember.create({
        data: {
          projectId,
          memberId,
          role: "DEVELOPER"
        }
      });
      count++;
    }
  }

  console.log(`\nSuccessfully assigned members to projects! Total project-member links created: ${count}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
