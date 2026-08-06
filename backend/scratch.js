const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      name: { contains: 'Kamal', mode: 'insensitive' }
    }
  });
  console.log('Kamal users:', users);

  if (users.length > 0) {
    const user = users[0];
    const passwordHash = await bcrypt.hash('Kamal+xebia1', 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: true }
    });
    console.log(`Reset password for ${user.name} (${user.email}) to Kamal+xebia1`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
