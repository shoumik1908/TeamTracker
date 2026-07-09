import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Standardized stage lists
const pnbStages = [
  'Opportunity Identification',
  'Qualification',
  'Requirement Analysis',
  'Solution Design',
  'Effort Estimation',
  'Costing & Pricing',
  'Proposal Preparation',
  'Internal Review & Approval',
  'Client Presentation/Demo',
  'Negotiation',
  'Contract Award',
  'Project Handover'
];

const tnmStages = [
  'Requirement Discussion',
  'Resource Planning',
  'Rate Card Preparation',
  'Proposal Submission',
  'Client Approval',
  'Resource Onboarding',
  'Time Tracking',
  'Progress Reporting',
  'Change Requests',
  'Billing & Invoicing',
  'Project Closure'
];

// GET /api/presales
// List all PreSales opportunities ordered by creation date
router.get('/', async (_req: Request, res: Response) => {
  const opportunities = await prisma.preSalesOpportunity.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json({ data: opportunities });
});

// POST /api/presales
// Create PNB and/or TNM timelines conditionally
router.post('/', async (req: Request, res: Response) => {
  const { name, clientName, createPnb, createTnm } = req.body;

  if (!name || !clientName) {
    return res.status(400).json({ error: 'name and clientName are required.' });
  }

  if (!createPnb && !createTnm) {
    return res.status(400).json({ error: 'At least one timeline option (PNB or TNM) must be checked.' });
  }

  const createdRecords: any[] = [];

  // Create PNB record
  if (createPnb) {
    const pnbRecord = await prisma.preSalesOpportunity.create({
      data: {
        name: name.trim(),
        clientName: clientName.trim(),
        account: 'PNB',
        stages: pnbStages,
        currentStageIndex: 0
      }
    });
    createdRecords.push(pnbRecord);
  }

  // Create TNM record
  if (createTnm) {
    const tnmRecord = await prisma.preSalesOpportunity.create({
      data: {
        name: name.trim(),
        clientName: clientName.trim(),
        account: 'TNM',
        stages: tnmStages,
        currentStageIndex: 0
      }
    });
    createdRecords.push(tnmRecord);
  }

  // Return the first created record as frontend expects { data: PreSalesOpportunity }
  res.status(201).json({ data: createdRecords[0] });
});

// PATCH /api/presales/:id/stage
// Update current stage index for an opportunity
router.patch('/:id/stage', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { stageIndex } = req.body;

  if (stageIndex === undefined || typeof stageIndex !== 'number') {
    return res.status(400).json({ error: 'stageIndex is required.' });
  }

  const opportunity = await prisma.preSalesOpportunity.findUnique({
    where: { id }
  });

  if (!opportunity) {
    return res.status(404).json({ error: 'Opportunity not found.' });
  }

  if (stageIndex < 0 || stageIndex >= opportunity.stages.length) {
    return res.status(400).json({ error: 'Invalid stage index.' });
  }

  const updated = await prisma.preSalesOpportunity.update({
    where: { id },
    data: { currentStageIndex: stageIndex }
  });

  res.json({ data: updated });
});

router.delete('/', async (req: Request, res: Response) => {
  const name = req.query.name as string;
  const clientName = req.query.clientName as string;
  const account = req.query.account as string;

  if (!name || !clientName) {
    return res.status(400).json({ error: 'name and clientName parameters are required.' });
  }

  const whereClause: any = {
    name: { equals: name.trim(), mode: 'insensitive' },
    clientName: { equals: clientName.trim(), mode: 'insensitive' }
  };

  if (account) {
    whereClause.account = { equals: account.trim(), mode: 'insensitive' };
  }

  await prisma.preSalesOpportunity.deleteMany({
    where: whereClause
  });

  res.json({ success: true });
});

export default router;
