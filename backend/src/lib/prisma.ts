import { PrismaClient } from '@prisma/client';
import { requestContext } from './context';

const rawPrisma = new PrismaClient();

const WRITE_OPS = ['create', 'update', 'upsert', 'delete', 'updateMany', 'deleteMany', 'createMany'];
const SKIP_FIELDS = ['passwordHash', 'password', 'token', 'id', 'createdAt', 'updatedAt'];

// Friendly model names
const MODEL_LABELS: Record<string, string> = {
  TeamMember: 'Team Member', ProjectMember: 'Project Member', ProjectUpdate: 'Project Update',
  ProjectFile: 'Project File', ProjectLink: 'Project Link', ProjectNote: 'Project Note',
  AssignedCertification: 'Certification Assignment', CertificateEditRequest: 'Certificate Edit Request',
  PreSalesOpportunity: 'Pre-Sales Opportunity', MeetingRecord: 'Meeting', ActivityLog: 'Log',
  ResumeProfile: 'Resume', GeneratedResume: 'Generated Resume', GtmPlan: 'GTM Plan',
  GtmPartner: 'GTM Partner', GtmCampaign: 'GTM Campaign',
};

// Friendly operation verbs
const OP_LABELS: Record<string, string> = {
  create: 'Created', update: 'Updated', upsert: 'Updated', delete: 'Deleted',
  createMany: 'Created multiple', updateMany: 'Updated multiple', deleteMany: 'Deleted multiple',
};

function pickLabel(data: any): string {
  if (!data || typeof data !== 'object') return '';
  return data.name || data.title || data.label || data.email || '';
}

function pickChangedFields(data: any): string[] {
  if (!data || typeof data !== 'object') return [];
  return Object.keys(data)
    .filter(k => !SKIP_FIELDS.includes(k) && typeof data[k] !== 'object')
    .slice(0, 4);
}

const prisma = rawPrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        const result = await query(args);
        if (WRITE_OPS.includes(operation) && model !== 'ActivityLog') {
          try {
            const user = requestContext.getStore()?.user;
            const performedBy = user ? user.name : 'System';

            const a = args as any;
            const data = a?.data || a?.create || a?.update;
            const friendly = MODEL_LABELS[model!] || model;
            const verb = OP_LABELS[operation] || operation;
            const label = pickLabel(data);
            const changed = pickChangedFields(data);

            let details: string;

            if (model === 'Notification' && operation === 'create' && a?.data) {
              details = `Notification: ${a.data.title || 'Untitled'} – ${a.data.message || ''}`;
            } else if (label) {
              details = `${verb} ${friendly} "${label}"`;
              if (operation === 'update' && changed.length) {
                details += ` (changed: ${changed.join(', ')})`;
              }
            } else if (changed.length && (operation === 'update' || operation === 'updateMany')) {
              details = `${verb} ${friendly} (changed: ${changed.join(', ')})`;
            } else {
              details = `${verb} ${friendly}`;
            }

            await rawPrisma.activityLog.create({
              data: {
                category: model || 'System',
                action: operation.toUpperCase(),
                details,
                performedBy
              }
            });
          } catch (_) { /* never break the actual operation */ }
        }
        return result;
      }
    }
  }
});

export default prisma as unknown as PrismaClient;
