const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const newMembers = [
  { name: 'Aditi Pachori', designation: 'Consultant' },
  { name: 'Aditya Aggarwal', designation: 'Apprentice' },
  { name: 'Aditya Shriniwas Pallati', designation: 'Senior Consultant' },
  { name: 'Akshay Patel', designation: 'Senior Consultant' },
  { name: 'Alka Kaushik', designation: 'Junior Consultant' },
  { name: 'Ankit Nagar', designation: 'Senior Consultant' },
  { name: 'Ashok Chaudhary', designation: 'Lead Consultant' },
  { name: 'Ayush Joshi', designation: 'Junior Consultant' },
  { name: 'Ayush Paldecha', designation: 'Senior Consultant' },
  { name: 'Deepankar Panchal', designation: 'Consultant' },
  { name: 'Dhruv Safaya', designation: 'Consultant' },
  { name: 'Kamal Swami', designation: 'Junior Consultant' },
  { name: 'Kanchan Palkar', designation: 'Consultant' },
  { name: 'Kanishka Kumawat', designation: 'Apprentice' },
  { name: 'Kartik Jha', designation: 'Senior Consultant' },
  { name: 'Khanak Sharma', designation: 'Senior Consultant' },
  { name: 'Krishna Sharma', designation: 'Senior Consultant' },
  { name: 'Madhav Pareek', designation: 'Consultant' },
  { name: 'Madhura Dale', designation: 'Consultant' },
  { name: 'Nilesh Tiwari', designation: 'Senior Consultant' },
  { name: 'Nishi Sharma', designation: 'Apprentice' },
  { name: 'Pankaj Bana', designation: 'Technical Trainee' },
  { name: 'Prabal Sharma', designation: 'Senior Consultant' },
  { name: 'Rahul Mahato', designation: 'Junior Consultant' },
  { name: 'Rishabh Jain', designation: 'Senior Consultant' },
  { name: 'Sachin MR', designation: 'Senior Consultant' },
  { name: 'Salman Mandal', designation: 'Junior Consultant' },
  { name: 'Sasiram Kolisetty', designation: 'Senior Consultant' },
  { name: 'Suhani Jain', designation: 'Apprentice' },
  { name: 'Suryadev Rathore', designation: 'Apprentice' },
  { name: 'Uday Gupta', designation: 'Senior Consultant' },
  { name: 'Vaibhav Tiwari', designation: 'Junior Consultant' },
  { name: 'Vikas Kumawat', designation: 'Senior Consultant' },
  { name: 'Vinita Garg', designation: 'Junior Consultant' },
  { name: 'Yash Gupta', designation: 'Apprentice' },
  { name: 'Yogesh Lamba', designation: 'Consultant' },
  { name: 'Zillur Rehman', designation: 'Consultant' }
];

async function main() {
  console.log('🤖 Adding new team members...');
  
  const mayank = await prisma.teamMember.findFirst({
    where: { name: 'Mayank Jhamb' }
  });

  const managerId = mayank ? mayank.id : null;

  for (const m of newMembers) {
    const exists = await prisma.teamMember.findFirst({
      where: { name: m.name }
    });

    if (!exists) {
      await prisma.teamMember.create({
        data: {
          name: m.name,
          designation: m.designation,
          joiningDate: new Date('2024-01-01'),
          skills: [],
          managerId: managerId,
        }
      });
      console.log(`Created: ${m.name}`);
    } else {
      console.log(`Skipped (already exists): ${m.name}`);
    }
  }

  console.log('✅ Done adding team members.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
