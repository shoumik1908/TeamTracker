import { PrismaClient, Priority, CertificationStatus, ProjectStatus, NotificationType } from '@prisma/client';

const taskPermission = { read: true, write: true, delete: true, manageTeam: true, 'tasks:manage': true };
const memberPermission = { read: true, write: true, delete: false, manageTeam: false, 'tasks:manage': false };

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  await prisma.role.upsert({
    where: { name: 'Admin' },
    update: { permissions: taskPermission },
    create: { name: 'Admin', permissions: taskPermission },
  });

  await prisma.role.upsert({
    where: { name: 'Manager' },
    update: { permissions: taskPermission },
    create: { name: 'Manager', permissions: taskPermission },
  });

  await prisma.role.upsert({
    where: { name: 'Team Member' },
    update: { permissions: memberPermission },
    create: { name: 'Team Member', permissions: memberPermission },
  });

  const findOrCreateTeamMember = async (data: { name: string; phone?: string; designation?: string; joiningDate: Date; skills: string[] }) => {
    const existing = await prisma.teamMember.findFirst({ where: { name: data.name } });
    if (existing) return existing;
    return prisma.teamMember.create({ data });
  };

  const findOrCreateCertification = async (data: { name: string; provider: string; description?: string; duration?: string; learningLink?: string }) => {
    const existing = await prisma.certification.findFirst({ where: { name: data.name } });
    if (existing) return existing;
    return prisma.certification.create({ data });
  };

  const findOrCreateProject = async (data: { name: string; description?: string; client?: string; startDate: Date; endDate?: Date; priority: Priority; status: ProjectStatus; progress: number }) => {
    const existing = await prisma.project.findFirst({ where: { name: data.name } });
    if (existing) return existing;
    return prisma.project.create({ data });
  };

  // Create Team Members
  const alice = await findOrCreateTeamMember({
    name: 'Alice Johnson',
    phone: '+1-555-0101',
    designation: 'Senior Software Engineer',
    joiningDate: new Date('2022-03-15'),
    skills: ['React', 'TypeScript', 'Node.js', 'Azure'],
  });

  const bob = await findOrCreateTeamMember({
    name: 'Bob Martinez',
    phone: '+1-555-0102',
    designation: 'Cloud Architect',
    joiningDate: new Date('2021-06-01'),
    skills: ['Azure', 'Kubernetes', 'Terraform', 'DevOps'],
  });

  const carol = await findOrCreateTeamMember({
    name: 'Carol Smith',
    phone: '+1-555-0103',
    designation: 'Data Scientist',
    joiningDate: new Date('2023-01-10'),
    skills: ['Python', 'Machine Learning', 'Azure ML', 'SQL'],
  });

  const david = await findOrCreateTeamMember({
    name: 'David Lee',
    phone: '+1-555-0104',
    designation: 'DevOps Engineer',
    joiningDate: new Date('2022-09-20'),
    skills: ['Docker', 'CI/CD', 'Azure DevOps', 'Linux'],
  });

  const emma = await findOrCreateTeamMember({
    name: 'Emma Wilson',
    phone: '+1-555-0105',
    designation: 'Product Manager',
    joiningDate: new Date('2021-11-15'),
    skills: ['Agile', 'Scrum', 'Jira', 'Stakeholder Management'],
  });

  console.log('✅ Team members created');

  // Create Certifications
  const azureFundamentals = await findOrCreateCertification({
    name: 'Microsoft Azure Fundamentals',
    provider: 'Microsoft',
    description: 'Foundational knowledge of cloud services and Azure',
    duration: '40 hours',
    learningLink: 'https://learn.microsoft.com/en-us/certifications/azure-fundamentals/',
  });

  const azureDevOps = await findOrCreateCertification({
    name: 'Azure DevOps Engineer Expert',
    provider: 'Microsoft',
    description: 'Design and implement DevOps practices using Azure',
    duration: '80 hours',
    learningLink: 'https://learn.microsoft.com/en-us/certifications/devops-engineer/',
  });

  const awsSolutions = await findOrCreateCertification({
    name: 'AWS Solutions Architect Associate',
    provider: 'Amazon Web Services',
    description: 'Design distributed systems on AWS',
    duration: '60 hours',
    learningLink: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
  });

  const gcpProfessional = await findOrCreateCertification({
    name: 'Google Cloud Professional Data Engineer',
    provider: 'Google Cloud',
    description: 'Design and build data processing systems on Google Cloud',
    duration: '70 hours',
    learningLink: 'https://cloud.google.com/certification/data-engineer',
  });

  const kubernetesAdmin = await findOrCreateCertification({
    name: 'Certified Kubernetes Administrator',
    provider: 'CNCF',
    description: 'Administer Kubernetes clusters',
    duration: '50 hours',
    learningLink: 'https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/',
  });

  const scrumMaster = await findOrCreateCertification({
    name: 'Professional Scrum Master I',
    provider: 'Scrum.org',
    description: 'Scrum framework and servant-leadership',
    duration: '20 hours',
    learningLink: 'https://www.scrum.org/assessments/professional-scrum-master-i-certification',
  });

  console.log('✅ Certifications created');

  // Assign Certifications
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const twoMonths = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate());

  await prisma.assignedCertification.createMany({
    skipDuplicates: true,
    data: [
      {
        memberId: alice.id,
        certificationId: azureFundamentals.id,
        assignedDate: lastMonth,
        deadline: nextWeek,
        priority: Priority.HIGH,
        progress: 85,
        status: CertificationStatus.IN_PROGRESS,
        notes: 'Priority completion needed for project eligibility',
      },
      {
        memberId: alice.id,
        certificationId: awsSolutions.id,
        assignedDate: lastMonth,
        deadline: twoMonths,
        priority: Priority.MEDIUM,
        progress: 30,
        status: CertificationStatus.IN_PROGRESS,
      },
      {
        memberId: bob.id,
        certificationId: azureDevOps.id,
        assignedDate: new Date('2024-01-15'),
        deadline: new Date('2024-03-15'),
        priority: Priority.CRITICAL,
        progress: 100,
        status: CertificationStatus.COMPLETED,
        completionDate: new Date('2024-03-10'),
        credentialId: 'AZ-400-BOB-2024',
      },
      {
        memberId: bob.id,
        certificationId: kubernetesAdmin.id,
        assignedDate: lastMonth,
        deadline: nextMonth,
        priority: Priority.HIGH,
        progress: 65,
        status: CertificationStatus.IN_PROGRESS,
      },
      {
        memberId: carol.id,
        certificationId: gcpProfessional.id,
        assignedDate: lastMonth,
        deadline: yesterday,
        priority: Priority.CRITICAL,
        progress: 45,
        status: CertificationStatus.OVERDUE,
        notes: 'Overdue - requires immediate attention',
      },
      {
        memberId: carol.id,
        certificationId: azureFundamentals.id,
        assignedDate: new Date('2023-11-01'),
        deadline: new Date('2023-12-31'),
        priority: Priority.MEDIUM,
        progress: 100,
        status: CertificationStatus.COMPLETED,
        completionDate: new Date('2023-12-20'),
        credentialId: 'AZ-900-CAROL-2023',
      },
      {
        memberId: david.id,
        certificationId: kubernetesAdmin.id,
        assignedDate: new Date('2024-01-01'),
        deadline: new Date('2024-02-28'),
        priority: Priority.HIGH,
        progress: 100,
        status: CertificationStatus.COMPLETED,
        completionDate: new Date('2024-02-25'),
        credentialId: 'CKA-DAVID-2024',
      },
      {
        memberId: david.id,
        certificationId: azureDevOps.id,
        assignedDate: lastMonth,
        deadline: nextMonth,
        priority: Priority.HIGH,
        progress: 50,
        status: CertificationStatus.IN_PROGRESS,
      },
      {
        memberId: emma.id,
        certificationId: scrumMaster.id,
        assignedDate: lastMonth,
        deadline: nextWeek,
        priority: Priority.MEDIUM,
        progress: 90,
        status: CertificationStatus.IN_PROGRESS,
      },
      {
        memberId: emma.id,
        certificationId: azureFundamentals.id,
        assignedDate: lastMonth,
        deadline: twoMonths,
        priority: Priority.LOW,
        progress: 0,
        status: CertificationStatus.NOT_STARTED,
      },
    ],
  });

  console.log('✅ Certifications assigned');

  // Create Projects
  const project1 = await findOrCreateProject({
    name: 'Azure Cloud Migration',
    description: 'Migrating legacy on-premise infrastructure to Azure cloud',
    client: 'Internal',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    priority: Priority.CRITICAL,
    status: ProjectStatus.IN_PROGRESS,
    progress: 65,
  });

  const project2 = await findOrCreateProject({
    name: 'Team Tracker Dashboard',
    description: 'Building an enterprise team and certification tracking system',
    client: 'Internal',
    startDate: new Date('2024-03-01'),
    endDate: new Date('2024-06-30'),
    priority: Priority.HIGH,
    status: ProjectStatus.IN_PROGRESS,
    progress: 40,
  });

  const project3 = await findOrCreateProject({
    name: 'Data Analytics Platform',
    description: 'End-to-end data analytics pipeline on Google Cloud',
    client: 'Acme Corp',
    startDate: new Date('2023-09-01'),
    endDate: new Date('2024-02-28'),
    priority: Priority.HIGH,
    status: ProjectStatus.COMPLETED,
    progress: 100,
  });

  const project4 = await findOrCreateProject({
    name: 'DevOps Automation Framework',
    description: 'CI/CD pipeline and infrastructure automation',
    client: 'Internal',
    startDate: new Date('2024-04-01'),
    endDate: new Date('2024-09-30'),
    priority: Priority.MEDIUM,
    status: ProjectStatus.PLANNING,
    progress: 10,
  });

  // Assign members to projects
  await prisma.projectMember.createMany({
    skipDuplicates: true,
    data: [
      { projectId: project1.id, memberId: alice.id, role: 'Tech Lead' },
      { projectId: project1.id, memberId: bob.id, role: 'Cloud Architect' },
      { projectId: project1.id, memberId: david.id, role: 'DevOps Engineer' },
      { projectId: project2.id, memberId: alice.id, role: 'Frontend Developer' },
      { projectId: project2.id, memberId: emma.id, role: 'Product Manager' },
      { projectId: project3.id, memberId: carol.id, role: 'Data Engineer' },
      { projectId: project3.id, memberId: bob.id, role: 'Solutions Architect' },
      { projectId: project4.id, memberId: david.id, role: 'Lead DevOps' },
      { projectId: project4.id, memberId: bob.id, role: 'Architect' },
    ],
  });

  console.log('✅ Projects created and members assigned');

  // Create Notifications
  await prisma.notification.createMany({
    data: [
      {
        memberId: carol.id,
        type: NotificationType.DEADLINE_APPROACHING,
        title: 'Certification Overdue',
        message: 'Google Cloud Professional Data Engineer certification is overdue for Carol Smith',
      },
      {
        memberId: alice.id,
        type: NotificationType.DEADLINE_APPROACHING,
        title: 'Deadline This Week',
        message: 'Azure Fundamentals certification deadline is coming up for Alice Johnson',
      },
      {
        memberId: bob.id,
        type: NotificationType.CERTIFICATION_COMPLETED,
        title: 'Certification Completed',
        message: 'Bob Martinez completed the Azure DevOps Engineer Expert certification',
      },
      {
        memberId: david.id,
        type: NotificationType.CERTIFICATION_COMPLETED,
        title: 'Certification Completed',
        message: 'David Lee completed the Certified Kubernetes Administrator certification',
      },
      {
        memberId: emma.id,
        type: NotificationType.CERTIFICATION_ASSIGNED,
        title: 'New Certification Assigned',
        message: 'Azure Fundamentals has been assigned to Emma Wilson',
      },
      {
        type: NotificationType.PROJECT_UPDATED,
        title: 'Project Progress Updated',
        message: 'Azure Cloud Migration project progress updated to 65%',
      },
    ],
  });

  console.log('✅ Notifications created');
  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
