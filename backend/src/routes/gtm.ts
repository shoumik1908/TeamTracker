import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { deleteFile, generateSasUrl, extractBlobName, CONTAINERS, accountName } from '../services/blobStorage';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// Standardized GTM stages
const gtmStages = [
  'Market Research & Positioning',
  'Strategy & Messaging Definition',
  'Channel & Partner Setup',
  'Launch Readiness & Enablement',
  'Go-Live / Launch',
  'Post-Launch Review & Iteration'
];

// GET /api/gtm
// List all GTM plans ordered by creation date
router.get('/', async (_req: Request, res: Response) => {
  const plans = await prisma.gtmPlan.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json({ data: plans });
});

// POST /api/gtm
// Create GTM plan
router.post('/', async (req: Request, res: Response) => {
  const { name, clientName, category } = req.body;

  if (!name || !clientName) {
    return res.status(400).json({ error: 'name and clientName are required.' });
  }

  if (!category || !['NEW_MARKET_ENTRY', 'EXISTING_CLIENT_EXPANSION'].includes(category)) {
    return res.status(400).json({ error: 'Valid category is required.' });
  }

  const gtmPlan = await prisma.gtmPlan.create({
    data: {
      name: name.trim(),
      clientName: clientName.trim(),
      category: category,
      stages: gtmStages,
      currentStageIndex: 0
    }
  });

  res.status(201).json({ data: gtmPlan });
});

// PATCH /api/gtm/:id/stage
// Update current stage index for a GTM plan
router.patch('/:id/stage', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { stageIndex } = req.body;

  if (stageIndex === undefined || typeof stageIndex !== 'number') {
    return res.status(400).json({ error: 'stageIndex is required.' });
  }

  const plan = await prisma.gtmPlan.findUnique({
    where: { id }
  });

  if (!plan) {
    return res.status(404).json({ error: 'GTM Plan not found.' });
  }

  if (stageIndex < 0 || stageIndex >= plan.stages.length) {
    return res.status(400).json({ error: 'Invalid stage index.' });
  }

  const updated = await prisma.gtmPlan.update({
    where: { id },
    data: { currentStageIndex: stageIndex }
  });

  res.json({ data: updated });
});

// DELETE /api/gtm
// Delete matching GTM plans
router.delete('/', async (req: Request, res: Response) => {
  const name = req.query.name as string;
  const clientName = req.query.clientName as string;
  const category = req.query.category as string;

  if (!name || !clientName) {
    return res.status(400).json({ error: 'name and clientName parameters are required.' });
  }

  const whereClause: any = {
    name: { equals: name.trim(), mode: 'insensitive' },
    clientName: { equals: clientName.trim(), mode: 'insensitive' }
  };

  if (category) {
    whereClause.category = { equals: category.trim(), mode: 'insensitive' };
  }

  await prisma.gtmPlan.deleteMany({
    where: whereClause
  });

  res.json({ success: true });
});

// PUT /api/gtm
// Update GTM plan name and client name
router.put('/', async (req: Request, res: Response) => {
  const { oldName, oldClientName, newName, newClientName } = req.body;

  if (!oldName || !oldClientName || !newName || !newClientName) {
    return res.status(400).json({ error: 'oldName, oldClientName, newName, and newClientName are required.' });
  }

  const updated = await prisma.gtmPlan.updateMany({
    where: {
      name: { equals: oldName.trim(), mode: 'insensitive' },
      clientName: { equals: oldClientName.trim(), mode: 'insensitive' }
    },
    data: {
      name: newName.trim(),
      clientName: newClientName.trim()
    }
  });

  if (updated.count === 0) {
    return res.status(404).json({ error: 'No matching GTM plans found to update.' });
  }

  res.json({ success: true, count: updated.count });
});

// ─── PARTNERS ──────────────────────────────────────────────────────────────────

// GET /api/gtm/certifications
// Get all certifications in system for partner requirements dropdown
router.get('/certifications', async (_req: Request, res: Response) => {
  const certifications = await prisma.certification.findMany({
    select: { id: true, name: true, provider: true },
    orderBy: { name: 'asc' }
  });
  res.json({ data: certifications });
});

// GET /api/gtm/partners
// List all partners and requirements
router.get('/partners', async (_req: Request, res: Response) => {
  const partners = await prisma.gtmPartner.findMany({
    include: { requirements: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ data: partners });
});

// POST /api/gtm/partners
// Create partner with requirements
router.post('/partners', async (req: Request, res: Response) => {
  const { name, tier, renewalDate, requirements } = req.body;

  if (!name || !tier || !renewalDate) {
    return res.status(400).json({ error: 'name, tier, and renewalDate are required.' });
  }

  const partner = await prisma.gtmPartner.create({
    data: {
      name: name.trim(),
      tier: tier.trim(),
      renewalDate: new Date(renewalDate),
      requirements: {
        create: (requirements || []).map((r: any) => ({
          certificationName: r.certificationName,
          minimumCount: parseInt(r.minimumCount) || 1
        }))
      }
    },
    include: { requirements: true }
  });

  res.status(201).json({ data: partner });
});

// PUT /api/gtm/partners/:id
// Update partner and requirements
router.put('/partners/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, tier, renewalDate, requirements } = req.body;

  if (!name || !tier || !renewalDate) {
    return res.status(400).json({ error: 'name, tier, and renewalDate are required.' });
  }

  // Delete old requirements and create new ones
  await prisma.gtmPartnerRequirement.deleteMany({ where: { partnerId: id } });

  const partner = await prisma.gtmPartner.update({
    where: { id },
    data: {
      name: name.trim(),
      tier: tier.trim(),
      renewalDate: new Date(renewalDate),
      requirements: {
        create: (requirements || []).map((r: any) => ({
          certificationName: r.certificationName,
          minimumCount: parseInt(r.minimumCount) || 1
        }))
      }
    },
    include: { requirements: true }
  });

  res.json({ data: partner });
});

// DELETE /api/gtm/partners/:id
// Delete partner
router.delete('/partners/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.gtmPartner.delete({ where: { id } });
  res.json({ success: true });
});

// ─── AUDIT ─────────────────────────────────────────────────────────────────────

// GET /api/gtm/audit
// Compute status for all partner requirements against team member certifications
router.get('/audit', async (_req: Request, res: Response) => {
  const requirements = await prisma.gtmPartnerRequirement.findMany({
    include: { partner: true }
  });

  const completedCerts = await prisma.assignedCertification.findMany({
    where: { status: 'COMPLETED' },
    include: { certification: true }
  });

  const auditResults = requirements.map(req => {
    // Count how many distinct team members hold this certification
    const currentCount = completedCerts.filter(ac => ac.certification.name === req.certificationName).length;
    const min = req.minimumCount;
    let status: 'Met' | 'At Risk' | 'Not Met' = 'Not Met';

    if (currentCount >= min) {
      status = 'Met';
    } else if (currentCount >= min * 0.7) {
      status = 'At Risk';
    }

    return {
      id: req.id,
      partnerId: req.partnerId,
      partnerName: req.partner.name,
      certificationName: req.certificationName,
      minimumCount: min,
      currentCount,
      status
    };
  });

  res.json({ data: auditResults });
});

// ─── CAMPAIGNS ─────────────────────────────────────────────────────────────────

// GET /api/gtm/campaigns
// List all campaigns
router.get('/campaigns', async (_req: Request, res: Response) => {
  const campaigns = await prisma.gtmCampaign.findMany({
    include: { launch: true, partner: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ data: campaigns });
});

// POST /api/gtm/campaigns
// Create campaign
router.post('/campaigns', async (req: Request, res: Response) => {
  const { name, launchId, partnerId, status, startDate, endDate, description } = req.body;

  if (!name || !status) {
    return res.status(400).json({ error: 'name and status are required.' });
  }

  const campaign = await prisma.gtmCampaign.create({
    data: {
      name: name.trim(),
      launchId: launchId || null,
      partnerId: partnerId || null,
      status,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      description: description || null
    },
    include: { launch: true, partner: true }
  });

  res.status(201).json({ data: campaign });
});

// PUT /api/gtm/campaigns/:id
// Update campaign
router.put('/campaigns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, launchId, partnerId, status, startDate, endDate, description } = req.body;

  if (!name || !status) {
    return res.status(400).json({ error: 'name and status are required.' });
  }

  const campaign = await prisma.gtmCampaign.update({
    where: { id },
    data: {
      name: name.trim(),
      launchId: launchId || null,
      partnerId: partnerId || null,
      status,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      description: description || null
    },
    include: { launch: true, partner: true }
  });

  res.json({ data: campaign });
});

// DELETE /api/gtm/campaigns/:id
// Delete campaign
router.delete('/campaigns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.gtmCampaign.delete({ where: { id } });
  res.json({ success: true });
});

// ─── COLLATERAL ────────────────────────────────────────────────────────────────

// GET /api/gtm/collaterals
// List all GTM collateral materials
router.get('/collaterals', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const isAdmin = user?.permissions?.manageTeam;
  
  const where: any = {};
  if (!isAdmin && user?.teamMemberId) {
    where.uploadedBy = user.teamMemberId;
  }

  const collaterals = await prisma.gtmCollateral.findMany({
    where,
    include: { launch: true, partner: true },
    orderBy: { uploadedAt: 'desc' }
  });
  res.json({ data: collaterals });
});

// POST /api/gtm/collaterals/upload-url
// Request a SAS URL to upload file directly to Azure
router.post('/collaterals/upload-url', async (req: Request, res: Response) => {
  const { fileName, fileType } = req.body;

  if (!fileName) {
    return res.status(400).json({ error: 'fileName is required.' });
  }

  const blobName = `gtm-collateral/${uuidv4()}-${fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

  const uploadUrl = generateSasUrl({
    containerName: CONTAINERS.PROJECT_DOCS,
    blobName,
    permissions: "cw",
    expiryMinutes: 10
  });

  res.json({ uploadUrl, blobName, contentType: fileType });
});

// POST /api/gtm/collaterals
// Save collateral file metadata
router.post('/collaterals', async (req: Request, res: Response) => {
  const { blobName, fileName, fileType, size, uploadedBy, launchId, partnerId } = req.body;

  if (!blobName || !fileName || !uploadedBy) {
    return res.status(400).json({ error: 'Missing required collateral metadata.' });
  }

  const url = `https://${accountName}.blob.core.windows.net/${CONTAINERS.PROJECT_DOCS}/${blobName}`;

  const collateral = await prisma.gtmCollateral.create({
    data: {
      name: fileName,
      url,
      type: fileType,
      size,
      uploadedBy,
      launchId: launchId || null,
      partnerId: partnerId || null
    },
    include: { launch: true, partner: true }
  });

  res.status(201).json({ data: collateral });
});

// GET /api/gtm/collaterals/:id/download-url
// Generate a read SAS URL for file download
router.get('/collaterals/:id/download-url', async (req: Request, res: Response) => {
  const { id } = req.params;

  const collateral = await prisma.gtmCollateral.findUnique({
    where: { id }
  });

  if (!collateral) {
    return res.status(404).json({ error: 'Collateral not found.' });
  }

  const blobName = extractBlobName(collateral.url);
  const downloadUrl = generateSasUrl({
    containerName: CONTAINERS.PROJECT_DOCS,
    blobName,
    permissions: "r",
    expiryMinutes: 15
  });

  res.json({ downloadUrl, fileName: collateral.name });
});

// DELETE /api/gtm/collaterals/:id
// Delete collateral file from database & Azure storage
router.delete('/collaterals/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const collateral = await prisma.gtmCollateral.findUnique({
    where: { id }
  });

  if (!collateral) {
    return res.status(404).json({ error: 'Collateral not found.' });
  }

  const blobName = extractBlobName(collateral.url);
  await deleteFile(CONTAINERS.PROJECT_DOCS, blobName);

  await prisma.gtmCollateral.delete({
    where: { id }
  });

  res.json({ success: true });
});

export default router;
