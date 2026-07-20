const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findUnique({ where: { email: 'shoumik1908@gmail.com' }, include: { role: true } });
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name, roleId: user.roleId, teamMemberId: user.teamMemberId, permissions: user.role.permissions }, process.env.JWT_SECRET || 'fallback-secret-key-do-not-use-in-prod');
  try {
    const res = await fetch('http://localhost:3001/api/presales/cmrk61rbq0000b54r5hhpoba2', { headers: { Authorization: 'Bearer ' + token } });
    const data = await res.json();
    console.log('Status:', res.status, 'Response:', data);
  } catch (e) {
    console.error('Error:', e);
  }
}
run();
