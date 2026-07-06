const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const certsToAdd = [
  { name: 'Fabric Analytics Engineer Associate: DP-600', provider: 'Microsoft' },
  { name: 'Fabric Data Engineer Associate: DP-700', provider: 'Microsoft' },
  { name: 'Power BI Data Analyst Associate: PL-300', provider: 'Microsoft' },
  { name: 'Azure Fundamentals: AZ-900', provider: 'Microsoft' },
  { name: 'Azure Data Engineer Associate: DP-203', provider: 'Microsoft' },
  { name: 'Azure Data Fundamentals: DP-900', provider: 'Microsoft' },
  { name: 'Azure Developer Associate: AZ-204', provider: 'Microsoft' },
  { name: 'Azure Databricks Data Engineer Associate (beta)', provider: 'Microsoft' },
  { name: 'Azure Cosmos DB Developer Specialty: DP-420', provider: 'Microsoft' },
  { name: 'Azure Network Engineer Associate: AZ-700', provider: 'Microsoft' },
  { name: 'Azure AI Fundamentals: AI-900', provider: 'Microsoft' },
  { name: 'Azure Solutions Architect Expert: AZ-305', provider: 'Microsoft' },
  { name: 'SQL AI Developer Associate (beta)', provider: 'Microsoft' },
  { name: 'Azure DevOps Engineer Expert: AZ-400', provider: 'Microsoft' },
  { name: 'Databricks Certified Data Engineer Associate', provider: 'Databricks' },
  { name: 'Databricks Certified Data Engineer Professional', provider: 'Databricks' },
  { name: 'Databricks Certified Data Analyst Associate', provider: 'Databricks' },
  { name: 'Databricks Certified Generative AI Associate', provider: 'Databricks' },
  { name: 'GitHub Actions', provider: 'GitHub' },
  { name: 'GitHub Foundations', provider: 'GitHub' },
  { name: 'GitHub Copilot', provider: 'GitHub' }
];

async function main() {
  console.log('🌱 Injecting new certifications...');
  for (const cert of certsToAdd) {
    const existing = await prisma.certification.findFirst({
      where: {
        name: {
          equals: cert.name,
          mode: 'insensitive'
        }
      }
    });

    if (!existing) {
      await prisma.certification.create({
        data: cert
      });
      console.log(`Created: ${cert.name}`);
    } else {
      console.log(`Already Exists: ${cert.name}`);
    }
  }
  console.log('✅ Done adding certifications.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
