import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = "kamal.swami@xebia.com";
  const newPassword = "kamal@123";
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  const updatedUser = await prisma.user.update({
    where: { email },
    data: { 
      passwordHash: hashedPassword,
      mustChangePassword: true // force him to change it after login
    }
  });
  
  console.log("Successfully updated password for:", updatedUser.name);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
