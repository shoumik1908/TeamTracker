import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Standardized stage lists
const pnbStages = [
  'Opportunity & Qualification',
  'Requirement Analysis',
  'Solution & Estimation',
  'Proposal & Pricing',
  'Client Engagement',
  'Project Award & Handover'
];

const tnmStages = [
  'Requirement & Resource Planning',
  'Rate Card & Proposal',
  'Client Approval & Onboarding',
  'Execution & Tracking',
  'Change Management',
  'Billing & Project Closure'
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

// PUT /api/presales
// Update opportunity and client names for all matching timelines
router.put('/', async (req: Request, res: Response) => {
  const { oldName, oldClientName, newName, newClientName } = req.body;

  if (!oldName || !oldClientName || !newName || !newClientName) {
    return res.status(400).json({ error: 'oldName, oldClientName, newName, and newClientName are required.' });
  }

  const updated = await prisma.preSalesOpportunity.updateMany({
    where: {
      name: { equals: oldName.trim(), mode: 'insensitive' },
      clientName: { equals: oldClientName.trim(), mode: 'insensitive' }
    },
    data: {
      name: newName.trim(),
      clientName: newClientName.trim()
    }
  });

  res.json({ success: true, count: updated.count });
});

export default router;

