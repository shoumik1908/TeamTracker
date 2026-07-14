import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { generateSasUrl, extractBlobName, CONTAINERS, deleteFile } from '../services/blobStorage';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  try {
    const files = [];

    // 1. Fetch CVs
    const membersWithCvs = await prisma.teamMember.findMany({
      where: { cvBlobUrl: { not: null } },
      select: { id: true, name: true, cvBlobUrl: true, cvOriginalFilename: true, cvUploadedAt: true }
    });

    for (const member of membersWithCvs) {
      if (member.cvBlobUrl) {
        files.push({
          id: `cv-${member.id}`,
          fileName: member.cvOriginalFilename || extractBlobName(member.cvBlobUrl).split('/').pop() || 'Resume.pdf',
          blobUrl: member.cvBlobUrl,
          container: CONTAINERS.CVS,
          category: 'CV',
          entityId: member.id,
          entityName: member.name,
          entityGroup: 'By Team Member',
          uploadDate: member.cvUploadedAt || new Date(0)
        });
      }
    }

    // 2. Fetch Certificates
    const assignedCerts = await prisma.assignedCertification.findMany({
      where: { certificateUrl: { not: null } },
      include: {
        member: { select: { id: true, name: true } },
        certification: { select: { name: true } }
      }
    });

    for (const cert of assignedCerts) {
      if (cert.certificateUrl) {
        files.push({
          id: `cert-${cert.id}`,
          fileName: cert.originalFilename || extractBlobName(cert.certificateUrl).split('/').pop() || `${cert.certification.name}.pdf`,
          blobUrl: cert.certificateUrl,
          container: CONTAINERS.CERTIFICATES,
          category: 'Certificate',
          entityId: cert.member.id,
          entityName: cert.member.name,
          entityGroup: 'By Team Member',
          uploadDate: cert.uploadDate || cert.updatedAt
        });
      }
    }

    // 3. Fetch PreSales/GTM Documents
    const stageLogs = await prisma.stageChangeLog.findMany({
      where: { blobUrl: { not: null } },
      orderBy: { createdAt: 'desc' }
    });

    if (stageLogs.length > 0) {
      const oppIds = [...new Set(stageLogs.map(l => l.opportunityId))];
      const opps = await prisma.preSalesOpportunity.findMany({
        where: { id: { in: oppIds } }
      });
      const oppMap = new Map(opps.map(o => [o.id, o]));

      for (const log of stageLogs) {
        if (log.blobUrl) {
          const opp = oppMap.get(log.opportunityId);
          if (opp) {
            files.push({
              id: `presales-${log.id}`,
              fileName: log.originalFilename || extractBlobName(log.blobUrl).split('/').pop() || 'Document.pdf',
              blobUrl: log.blobUrl,
              container: CONTAINERS.PRESALES_DOCS,
              category: 'GTM Document',
              entityId: opp.id,
              entityName: `${opp.clientName} - ${opp.name}`,
              entityGroup: 'By Client / Opportunity',
              uploadDate: log.createdAt
            });
          }
        }
      }
    }

    // 4. Fetch ProjectFile records for PreSales (opportunityId is not null)
    const projectFiles = await prisma.projectFile.findMany({
      where: { opportunityId: { not: null } },
      include: { opportunity: true },
      orderBy: { uploadedAt: 'desc' }
    });

    for (const pFile of projectFiles) {
      if (pFile.opportunity) {
        const container = pFile.url.includes(`/${CONTAINERS.PROJECT_DOCS}/`)
          ? CONTAINERS.PROJECT_DOCS
          : CONTAINERS.PRESALES_DOCS;

        files.push({
          id: `opp-file-${pFile.id}`,
          fileName: pFile.name,
          blobUrl: pFile.url,
          container,
          category: 'GTM Document',
          entityId: pFile.opportunity.id,
          entityName: `${pFile.opportunity.clientName} - ${pFile.opportunity.name}`,
          entityGroup: 'By Client / Opportunity',
          uploadDate: pFile.uploadedAt
        });
      }
    }

    // Sort all files by upload date descending
    files.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());

    // Grouping
    const grouped = {
      'By Team Member': {} as Record<string, any[]>,
      'By Client / Opportunity': {} as Record<string, any[]>
    };

    files.forEach(file => {
      const group = file.entityGroup as 'By Team Member' | 'By Client / Opportunity';
      if (!grouped[group][file.entityName]) {
        grouped[group][file.entityName] = [];
      }
      grouped[group][file.entityName].push(file);
    });

    res.json({
      data: {
        flat: files,
        grouped
      }
    });

  } catch (error: any) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// POST /api/files/sas
// Generates a short-lived SAS URL for a given blobUrl and container
router.post('/sas', async (req: Request, res: Response) => {
  try {
    const { blobUrl, container } = req.body;
    
    if (!blobUrl || !container) {
      return res.status(400).json({ error: 'blobUrl and container are required.' });
    }

    const blobName = extractBlobName(blobUrl);
    
    const sasUrl = generateSasUrl({
      containerName: container,
      blobName: blobName,
      permissions: 'r', // read only
      expiryMinutes: 15
    });

    res.json({ data: { sasUrl } });
  } catch (error: any) {
    console.error('Error generating SAS URL:', error);
    res.status(500).json({ error: 'Failed to generate access URL.' });
  }
});

// DELETE /api/files/:id
// General endpoint to delete CVs, Certificates, Stage Change Logs or ProjectFiles
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    if (id.startsWith('cv-')) {
      const memberId = id.substring(3);
      const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
      if (!member) return res.status(404).json({ error: 'Member not found' });
      if (member.cvBlobUrl) {
        const blobName = extractBlobName(member.cvBlobUrl);
        if (blobName) await deleteFile(CONTAINERS.CVS, blobName);
      }
      await prisma.teamMember.update({
        where: { id: memberId },
        data: {
          cvBlobUrl: null,
          cvOriginalFilename: null,
          cvUploadedAt: null,
          cvSummary: null,
          atsScore: null,
          atsScoreBreakdown: Prisma.DbNull,
          atsSuggestions: Prisma.DbNull,
        }
      });
      await prisma.activityLog.create({
        data: {
          category: 'CVs',
          action: 'DELETE',
          details: `Removed CV for ${member.name}`,
        }
      });
    } 
    else if (id.startsWith('cert-')) {
      const certId = id.substring(5);
      const cert = await prisma.assignedCertification.findUnique({
        where: { id: certId },
        include: { member: true, certification: true }
      });
      if (!cert) return res.status(404).json({ error: 'Assigned certification not found' });
      if (cert.certificateUrl) {
        const blobName = extractBlobName(cert.certificateUrl);
        if (blobName) await deleteFile(CONTAINERS.CERTIFICATES, blobName).catch(console.error);
      }
      await prisma.assignedCertification.update({
        where: { id: certId },
        data: {
          certificateUrl: null,
          originalFilename: null,
          uploadDate: null,
          status: 'NOT_STARTED',
          progress: 0
        }
      });
      await prisma.activityLog.create({
        data: {
          category: 'Certificate',
          action: 'DELETE',
          details: `Deleted certificate for ${cert.member.name} - ${cert.certification.name}`,
        }
      });
    } 
    else if (id.startsWith('presales-')) {
      const logId = id.substring(9);
      const log = await prisma.stageChangeLog.findUnique({ where: { id: logId } });
      if (!log) return res.status(404).json({ error: 'Document record not found' });
      if (log.blobUrl) {
        const blobName = extractBlobName(log.blobUrl);
        if (blobName) await deleteFile(CONTAINERS.PRESALES_DOCS, blobName);
      }
      await prisma.stageChangeLog.update({
        where: { id: logId },
        data: {
          blobUrl: null,
          reasoning: log.reasoning ? `${log.reasoning}\n\n[Source document deleted]` : '[Source document deleted]'
        }
      });
      await prisma.activityLog.create({
        data: {
          category: 'PreSales',
          action: 'DELETE',
          details: `Deleted presales document "${log.originalFilename || 'Unknown'}" (Log ID: ${log.id})`,
        }
      });
    } 
    else if (id.startsWith('opp-file-')) {
      const fileId = id.substring(9);
      const dbFile = await prisma.projectFile.findUnique({ where: { id: fileId } });
      if (!dbFile) return res.status(404).json({ error: 'File not found in database.' });
      
      const container = dbFile.url.includes(`/${CONTAINERS.PROJECT_DOCS}/`)
        ? CONTAINERS.PROJECT_DOCS
        : CONTAINERS.PRESALES_DOCS;
        
      const blobName = extractBlobName(dbFile.url);
      if (blobName) await deleteFile(container, blobName);
      
      await prisma.projectFile.delete({ where: { id: fileId } });
      await prisma.activityLog.create({
        data: {
          category: 'PreSales',
          action: 'DELETE',
          details: `Deleted file "${dbFile.name}" (File ID: ${dbFile.id})`,
        }
      });
    } 
    else {
      return res.status(400).json({ error: 'Invalid file ID format.' });
    }

    res.json({ success: true, message: 'File deleted successfully.' });
  } catch (err: any) {
    console.error('Error deleting file:', err);
    res.status(500).json({ error: err.message || 'Failed to delete file.' });
  }
});

export default router;
