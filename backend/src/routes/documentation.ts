import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { deleteFile, generateSasUrl, extractBlobName, CONTAINERS, accountName } from '../services/blobStorage';
import { AppError } from '../middleware/errorHandler';

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

// Helper to verify that the team member is assigned to the project or is the manager
async function verifyProjectMember(projectId: string, memberId: string) {
  if (!memberId) {
    throw new AppError('memberId is required to perform this action.', 400);
  }
  const isMember = await prisma.projectMember.findFirst({
    where: {
      projectId,
      memberId,
    },
  });
  if (isMember) return;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { managerId: true },
  });

  if (project && project.managerId === memberId) {
    return;
  }

  throw new AppError('Access denied. Only team members assigned to this project can modify its documentation.', 403);
}

// GET /api/projects/:projectId/documentation
// Fetch all files, links, and notes for the project
router.get('/', async (req: Request, res: Response) => {
  const { projectId } = req.params;

  const [files, links, notes, project] = await Promise.all([
    prisma.projectFile.findMany({ where: { projectId }, orderBy: { uploadedAt: 'desc' } }),
    prisma.projectLink.findMany({ where: { projectId }, orderBy: { addedAt: 'desc' } }),
    prisma.projectNote.findMany({ where: { projectId }, orderBy: { updatedAt: 'desc' } }),
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        manager: {
          select: { id: true, name: true, profilePictureUrl: true, designation: true }
        },
        members: {
          include: {
            member: {
              select: { id: true, name: true, profilePictureUrl: true, designation: true }
            }
          }
        }
      }
    })
  ]);

  if (!project) {
    throw new AppError('Project not found.', 404);
  }

  res.json({ files, links, notes, project });
});

// ─── FILES ────────────────────────────────────────────────────────────────────

// POST /api/projects/:projectId/documentation/upload-url
// Request a SAS URL to upload a file directly to Azure
router.post('/upload-url', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { fileName, fileType, uploadedBy } = req.body;

  if (!uploadedBy || !fileName) {
    throw new AppError('uploadedBy and fileName are required.', 400);
  }
  await verifyProjectMember(projectId, uploadedBy);

  const ext = fileName.split('.').pop() || '';
  const blobName = `${uuidv4()}-${fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

  const uploadUrl = generateSasUrl({
    containerName: CONTAINERS.PROJECT_DOCS,
    blobName,
    permissions: "cw",
    expiryMinutes: 10,
  });

  res.json({ uploadUrl, blobName, contentType: fileType });
});

// POST /api/projects/:projectId/documentation/files
// Register uploaded file metadata in the database
router.post('/files', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { blobName, fileName, fileType, size, uploadedBy } = req.body;

  if (!uploadedBy || !blobName || !fileName) {
    throw new AppError('uploadedBy, blobName, and fileName are required.', 400);
  }
  await verifyProjectMember(projectId, uploadedBy);

  const url = `https://${accountName}.blob.core.windows.net/${CONTAINERS.PROJECT_DOCS}/${blobName}`;

  const newFile = await prisma.projectFile.create({
    data: {
      projectId,
      name: fileName,
      url: url,
      type: fileType,
      size: size,
      uploadedBy,
    },
  });

  res.status(201).json(newFile);
});

// DELETE /api/projects/:projectId/documentation/files/:fileId
// Delete a file from Azure Storage and remove it from the database
router.delete('/files/:fileId', async (req: Request, res: Response) => {
  const { projectId, fileId } = req.params;
  const memberId = (req.query.memberId as string) || req.body.memberId;

  await verifyProjectMember(projectId, memberId);

  const dbFile = await prisma.projectFile.findUnique({
    where: { id: fileId },
  });

  if (!dbFile) {
    throw new AppError('File not found in database.', 404);
  }

  // Delete file from Azure storage
  const blobName = extractBlobName(dbFile.url);
  await deleteFile(CONTAINERS.PROJECT_DOCS, blobName);

  // Delete database record
  await prisma.projectFile.delete({
    where: { id: fileId },
  });

  res.json({ success: true, message: 'File deleted successfully.' });
});

// GET /api/projects/:projectId/documentation/files/:fileId/download-url
// Generate a short-lived read-only SAS URL for file download
router.get('/files/:fileId/download-url', async (req: Request, res: Response) => {
  const { projectId, fileId } = req.params;
  const memberId = (req.query.memberId as string) || req.body.memberId;

  await verifyProjectMember(projectId, memberId);

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
  const { projectId } = req.params;
  const { title, url, description, addedBy } = req.body;

  if (!title || !url || !addedBy) {
    throw new AppError('title, url, and addedBy memberId are required.', 400);
  }
  await verifyProjectMember(projectId, addedBy);

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
  const { projectId, linkId } = req.params;
  const { title, url, description, addedBy } = req.body;

  if (!title || !url || !addedBy) {
    throw new AppError('title, url, and addedBy memberId are required.', 400);
  }
  await verifyProjectMember(projectId, addedBy);

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
  const { projectId, linkId } = req.params;
  const memberId = (req.query.memberId as string) || req.body.memberId;

  await verifyProjectMember(projectId, memberId);

  const existing = await prisma.projectLink.findUnique({
    where: { id: linkId },
  });

  if (!existing) {
    throw new AppError('Link not found.', 404);
  }

  await prisma.projectLink.delete({
    where: { id: linkId },
  });

  res.json({ success: true, message: 'Link removed successfully.' });
});

// ─── NOTES ────────────────────────────────────────────────────────────────────

// POST /api/projects/:projectId/documentation/notes
// Create in-app markdown text document notes
router.post('/notes', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { title, content, updatedBy } = req.body;

  if (!title || content === undefined || !updatedBy) {
    throw new AppError('title, content, and updatedBy memberId are required.', 400);
  }
  await verifyProjectMember(projectId, updatedBy);

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
  const { projectId, noteId } = req.params;
  const { title, content, updatedBy } = req.body;

  if (!title || content === undefined || !updatedBy) {
    throw new AppError('title, content, and updatedBy memberId are required.', 400);
  }
  await verifyProjectMember(projectId, updatedBy);

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
  const { projectId, noteId } = req.params;
  const memberId = (req.query.memberId as string) || req.body.memberId;

  await verifyProjectMember(projectId, memberId);

  const existing = await prisma.projectNote.findUnique({
    where: { id: noteId },
  });

  if (!existing) {
    throw new AppError('Note not found.', 404);
  }

  await prisma.projectNote.delete({
    where: { id: noteId },
  });

  res.json({ success: true, message: 'Note deleted successfully.' });
});

export default router;
