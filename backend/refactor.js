const fs = require('fs');
const glob = require('glob');
const path = require('path');

const prismaContent = `import { PrismaClient } from '@prisma/client';

const rawPrisma = new PrismaClient();
const prisma = rawPrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        const result = await query(args);
        if (['create', 'update', 'delete', 'updateMany', 'deleteMany', 'createMany'].includes(operation) && model !== 'ActivityLog') {
          try {
            await rawPrisma.activityLog.create({
              data: {
                category: model || 'System',
                action: operation.toUpperCase(),
                details: \`Performed \${operation} on \${model}\`,
                performedBy: 'System'
              }
            });
          } catch(e) {}
        }
        return result;
      }
    }
  }
});

export default prisma as unknown as PrismaClient;
`;

fs.mkdirSync('src/lib', { recursive: true });
fs.writeFileSync('src/lib/prisma.ts', prismaContent);

const files = glob.sync('src/**/*.ts', { ignore: ['src/lib/prisma.ts'] });
let updated = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('new PrismaClient()')) {
    // Remove the import if it exists
    content = content.replace(/import\s+\{\\s*PrismaClient\s*\}\s+from\s+['"]@prisma\/client['"];?\r?\n/g, '');
    
    // Calculate relative path to lib/prisma
    const dir = path.dirname(file);
    let relPath = path.relative(dir, 'src/lib/prisma');
    relPath = relPath.replace(/\\/g, '/');
    if (!relPath.startsWith('.')) relPath = './' + relPath;
    
    // Add our import
    content = `import prisma from '${relPath}';\n` + content;
    
    // Replace instantiation
    content = content.replace(/const\s+prisma\s*=\s*new\s+PrismaClient\(\);?\r?\n/g, '');
    
    fs.writeFileSync(file, content);
    updated++;
  }
}
console.log('Updated ' + updated + ' files.');
