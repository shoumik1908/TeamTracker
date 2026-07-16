import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { deleteFile, generateSasUrl, extractBlobName, CONTAINERS, accountName } from '../services/blobStorage';
import { AppError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

router.use(authenticateToken);

// Helper to verify that the team member is assigned to the context (project or opportunity)
async function verifyContextMember(projectId?: string, opportunityId?: string, user?: any) {
  if (!user) {
    throw new AppError('User context is required to perform this action.', 401);
  }
  
  if (user.permissions?.manageTeam) {
    return; // Admin always has access
  }

  const memberId = user.teamMemberId;
  if (!memberId) {
    throw new AppError('Access denied. No team member profile associated.', 403);
  }

  if (projectId) {
    const isMember = await prisma.projectMember.findFirst({
      where: { projectId, memberId },
    });
    if (isMember) return;
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project && project.managerId === memberId) return;
  } else if (opportunityId) {
    const isMember = await prisma.projectMember.findFirst({
      where: { opportunityId, memberId },
    });
    if (isMember) return;
  }

  throw new AppError('Access denied. Only team members assigned to this context can view its documentation.', 403);
}

// GET /api/projects/:projectId/documentation (or presales/:opportunityId)
// Fetch all files, links, and notes for the project/opportunity
router.get('/', async (req: Request, res: Response) => {
  const { projectId, opportunityId } = req.params;
  const user = (req as AuthRequest).user;
  
  await verifyContextMember(projectId, opportunityId, user);

  const whereClause = projectId ? { projectId } : { opportunityId };

  const [files, links, notes, project, opp] = await Promise.all([
    prisma.projectFile.findMany({ where: whereClause, orderBy: { uploadedAt: 'desc' } }),
    prisma.projectLink.findMany({ where: whereClause, orderBy: { addedAt: 'desc' } }),
    prisma.projectNote.findMany({ where: whereClause, orderBy: { updatedAt: 'desc' } }),
    projectId ? prisma.project.findUnique({
      where: { id: projectId },
      include: {
        manager: { select: { id: true, name: true, profilePictureUrl: true, designation: true } },
        members: { include: { member: { select: { id: true, name: true, profilePictureUrl: true, designation: true } } } }
      }
    }) : Promise.resolve(null),
    opportunityId ? prisma.preSalesOpportunity.findUnique({
      where: { id: opportunityId },
      include: {
        assignments: { include: { member: { select: { id: true, name: true, profilePictureUrl: true, designation: true } } } }
      }
    }) : Promise.resolve(null)
  ]);

  if (projectId && !project) throw new AppError('Project not found.', 404);
  if (opportunityId && !opp) throw new AppError('Opportunity not found.', 404);

  res.json({ files, links, notes, project, opp });
});

// ─── FILES ────────────────────────────────────────────────────────────────────

// POST /api/projects/:projectId/documentation/upload-url
// Request a SAS URL to upload a file directly to Azure
router.post('/upload-url', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) throw new AppError('Forbidden: Only Admins can upload documents', 403);

  const { projectId, opportunityId } = req.params;
  const { fileName, fileType } = req.body;

  if (!fileName) {
    throw new AppError('fileName is required.', 400);
  }

  const ext = fileName.split('.').pop() || '';
  const blobName = `${uuidv4()}-${fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

  const uploadUrl = generateSasUrl({
    containerName: projectId ? CONTAINERS.PROJECT_DOCS : CONTAINERS.PRESALES_DOCS,
    blobName,
    permissions: "cw",
    expiryMinutes: 10,
  });

  res.json({ uploadUrl, blobName, contentType: fileType });
});

// POST /api/projects/:projectId/documentation/files
// Register uploaded file metadata in the database
router.post('/files', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) throw new AppError('Forbidden: Only Admins can upload documents', 403);

  const { projectId, opportunityId } = req.params;
  const { blobName, fileName, fileType, size, uploadedBy } = req.body;

  if (!blobName || !fileName) {
    throw new AppError('Missing required file metadata.', 400);
  }

  const url = `https://${accountName}.blob.core.windows.net/${projectId ? CONTAINERS.PROJECT_DOCS : CONTAINERS.PRESALES_DOCS}/${blobName}`;

  const file = await prisma.projectFile.create({
    data: {
      projectId: projectId || null,
      opportunityId: opportunityId || null,
      name: fileName,
      url,
      type: fileType,
      size,
      uploadedBy,
    },
  });

  res.status(201).json(file);
});

// DELETE /api/projects/:projectId/documentation/files/:fileId
// Delete a file from Azure Storage and remove it from the database
router.delete('/files/:fileId', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const { projectId, opportunityId, fileId } = req.params;

  const dbFile = await prisma.projectFile.findUnique({
    where: { id: fileId },
  });

  if (!dbFile) {
    throw new AppError('File not found in database.', 404);
  }

  const isUploader = dbFile.uploadedBy === user?.teamMemberId;
  const isAdmin = user?.permissions?.manageTeam;

  if (!isAdmin && !isUploader) {
    throw new AppError('Forbidden: Only Admins or the uploader can delete this document', 403);
  }

  // Delete file from Azure storage
  const blobName = extractBlobName(dbFile.url);
  await deleteFile(CONTAINERS.PROJECT_DOCS, blobName);

  // Delete database record
  await prisma.projectFile.delete({
    where: { id: fileId },
  });

  // Log the deletion
  await prisma.activityLog.create({
    data: {
      category: opportunityId ? 'PreSales' : 'Projects',
      action: 'DELETE',
      details: `User ${user?.name || 'Unknown'} deleted file "${dbFile.name}"`,
    }
  });

  res.json({ success: true, message: 'File deleted successfully.' });
});

// GET /api/projects/:projectId/documentation/files/:fileId/download-url
// Generate a short-lived read-only SAS URL for file download
router.get('/files/:fileId/download-url', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const { projectId, opportunityId, fileId } = req.params;

  await verifyContextMember(projectId, opportunityId, user);

  const dbFile = await prisma.projectFile.findUnique({
    where: { id: fileId },
  });

  if (!dbFile) {
    throw new AppError('File not found in database.', 404);
  }

  const blobName = extractBlobName(dbFile.url);
  const downloadUrl = generateSasUrl({
    containerName: CONTAINERS.PROJECT_DOCS,
    blobName,
    permissions: "r",
    expiryMinutes: 5,
  });

  res.json({ downloadUrl, fileName: dbFile.name });
});

// ─── LINKS ────────────────────────────────────────────────────────────────────

// POST /api/projects/:projectId/documentation/links
// Add an external document URL link
router.post('/links', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) throw new AppError('Forbidden: Only Admins can add links', 403);

  const { projectId, opportunityId } = req.params;
  const { title, url, description, addedBy } = req.body;

  if (!title || !url) {
    throw new AppError('title, url are required.', 400);
  }

  const newLink = await prisma.projectLink.create({
    data: {
      projectId,
      title: title.trim(),
      url: url.trim(),
      description: description ? description.trim() : null,
      addedBy,
    },
  });

  res.status(201).json(newLink);
});

// PUT /api/projects/:projectId/documentation/links/:linkId
// Update an existing link details
router.put('/links/:linkId', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) throw new AppError('Forbidden: Only Admins can update links', 403);

  const { projectId, opportunityId, linkId } = req.params;
  const { title, url, description, addedBy } = req.body;

  if (!title || !url) {
    throw new AppError('title, url are required.', 400);
  }

  const existing = await prisma.projectLink.findUnique({
    where: { id: linkId },
  });

  if (!existing) {
    throw new AppError('Link not found.', 404);
  }

  const updatedLink = await prisma.projectLink.update({
    where: { id: linkId },
    data: {
      title: title.trim(),
      url: url.trim(),
      description: description ? description.trim() : null,
      addedBy,
    },
  });

  res.json(updatedLink);
});

// DELETE /api/projects/:projectId/documentation/links/:linkId
// Remove an external document link
router.delete('/links/:linkId', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const { projectId, opportunityId, linkId } = req.params;

  const dbLink = await prisma.projectLink.findUnique({
    where: { id: linkId },
  });

  if (!dbLink) {
    throw new AppError('Link not found in database.', 404);
  }

  const isUploader = dbLink.addedBy === user?.teamMemberId;
  const isAdmin = user?.permissions?.manageTeam;

  if (!isAdmin && !isUploader) {
    throw new AppError('Forbidden: Only Admins or the creator can delete this link', 403);
  }

  await prisma.projectLink.delete({
    where: { id: linkId },
  });

  await prisma.activityLog.create({
    data: {
      category: opportunityId ? 'PreSales' : 'Projects',
      action: 'DELETE',
      details: `User ${user?.name || 'Unknown'} deleted link "${dbLink.title}"`,
    }
  });

  res.json({ success: true, message: 'Link deleted successfully.' });
});

// ─── NOTES ────────────────────────────────────────────────────────────────────

// POST /api/projects/:projectId/documentation/notes
// Create in-app markdown text document notes
router.post('/notes', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) throw new AppError('Forbidden: Only Admins can add notes', 403);

  const { projectId, opportunityId } = req.params;
  const { title, content, updatedBy } = req.body;

  if (!title || content === undefined) {
    throw new AppError('title, content are required.', 400);
  }

  const newNote = await prisma.projectNote.create({
    data: {
      projectId,
      title: title.trim(),
      content: content.trim(),
      updatedBy,
    },
  });

  res.status(201).json(newNote);
});

// PUT /api/projects/:projectId/documentation/notes/:noteId
// Update in-app markdown notes content
router.put('/notes/:noteId', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) throw new AppError('Forbidden: Only Admins can update notes', 403);

  const { projectId, opportunityId, noteId } = req.params;
  const { title, content, updatedBy } = req.body;

  if (!title || content === undefined) {
    throw new AppError('title, content are required.', 400);
  }

  const existing = await prisma.projectNote.findUnique({
    where: { id: noteId },
  });

  if (!existing) {
    throw new AppError('Note not found.', 404);
  }

  const updatedNote = await prisma.projectNote.update({
    where: { id: noteId },
    data: {
      title: title.trim(),
      content: content.trim(),
      updatedBy,
    },
  });

  res.json(updatedNote);
});

// DELETE /api/projects/:projectId/documentation/notes/:noteId
// Remove in-app project notes
router.delete('/notes/:noteId', async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const { projectId, opportunityId, noteId } = req.params;

  const dbNote = await prisma.projectNote.findUnique({
    where: { id: noteId },
  });

  if (!dbNote) {
    throw new AppError('Note not found in database.', 404);
  }

  const isUploader = dbNote.addedBy === user?.teamMemberId;
  const isAdmin = user?.permissions?.manageTeam;

  if (!isAdmin && !isUploader) {
    throw new AppError('Forbidden: Only Admins or the creator can delete this note', 403);
  }

  await prisma.projectNote.delete({
    where: { id: noteId },
  });

  await prisma.activityLog.create({
    data: {
      category: opportunityId ? 'PreSales' : 'Projects',
      action: 'DELETE',
      details: `User ${user?.name || 'Unknown'} deleted note "${dbNote.title}"`,
    }
  });

  res.json({ success: true, message: 'Note deleted successfully.' });
});

export default router;
