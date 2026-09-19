import { BlobServiceClient, ContainerClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';
import { DataLakeServiceClient } from '@azure/storage-file-datalake';
import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';

const connectionString = (process.env.AZURE_STORAGE_CONNECTION_STRING || '').trim();

function parseConnectionString(connStr: string) {
  const parts = connStr.split(';');
  const dict: Record<string, string> = {};
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx > 0) {
      dict[p.substring(0, idx)] = p.substring(idx + 1);
    }
  }
  return dict;
}

const parsedCreds = parseConnectionString(connectionString);
export const accountName = parsedCreds['AccountName']?.trim() || process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim() || '';
const accountKey = parsedCreds['AccountKey']?.trim() || process.env.AZURE_STORAGE_ACCOUNT_KEY?.trim() || '';

const sharedKeyCredential = (accountName && accountKey) ? new StorageSharedKeyCredential(accountName, accountKey) : null;

let blobServiceClient: BlobServiceClient | null = null;
let dataLakeServiceClient: DataLakeServiceClient | null = null;

function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured');
    }
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  }
  return blobServiceClient;
}

function getDataLakeServiceClient(): DataLakeServiceClient {
  if (!dataLakeServiceClient) {
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured');
    }
    dataLakeServiceClient = DataLakeServiceClient.fromConnectionString(connectionString);
  }
  return dataLakeServiceClient;
}

async function getContainerClient(containerName: string): Promise<ContainerClient> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(containerName);
  return containerClient;
}

export function sanitizeDirectoryName(name: string): string {
  // strip invalid chars: < > : " / \ | ? * and control characters
  return name.replace(/[\u0000-\u001F\u007F-\u009F<>:"/\\|?*]/g, "").trim();
}

export const CONTAINERS = {
  CERTIFICATES: process.env.AZURE_CONTAINER_CERTIFICATES || 'certificates',
  PROFILE_IMAGES: process.env.AZURE_CONTAINER_PROFILE_IMAGES || 'profile-images',
  PROJECT_DOCS: process.env.AZURE_CONTAINER_PROJECT_DOCS || 'project-documents',
  REPORTS: process.env.AZURE_CONTAINER_REPORTS || 'reports',
  CVS: process.env.AZURE_CONTAINER_CVS || 'resume',
  PRESALES_DOCS: process.env.AZURE_CONTAINER_PRESALES_DOCS || 'presales-documents',
  PROJECT_RECORDINGS: process.env.AZURE_CONTAINER_PROJECT_RECORDINGS || 'project-recordings',
  TASK_FILES: process.env.AZURE_CONTAINER_TASK_FILES || 'task-files',
  COE_RESOURCES: process.env.AZURE_CONTAINER_COE_RESOURCES || 'coe-resources',
  COE_TRANSCRIPTS: process.env.AZURE_CONTAINER_COE_TRANSCRIPTS || 'coe-transcripts',
  LEARNING_PROJECTS: process.env.AZURE_CONTAINER_LEARNING_PROJECTS || 'learning-projects',
};

/**
 * The stored key for a blob.
 *
 * Every upload gets a uuid segment, so two people uploading the same filename can
 * never land on the same key. Exported so the guarantee can be tested without Azure
 * credentials — see src/tests/blobNaming.test.ts.
 */
export function buildBlobName(originalName: string, customBlobPrefix?: string): string {
  const targetName = sanitizeBlobFileName(originalName);
  const unique = crypto.randomUUID();
  return customBlobPrefix ? `${customBlobPrefix}/${unique}-${targetName}` : `${unique}-${targetName}`;
}

export function sanitizeBlobFileName(originalName: string): string {
  return originalName.replace(/[^a-zA-Z0-9.\-_ \(\)]/g, '_');
}

export async function uploadFile(
  containerName: string,
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  memberId?: string,
  memberName?: string,
  customBlobPrefix?: string
): Promise<{ url: string; blobName: string }> {
  // Sanitize original name to prevent path issues but keep it otherwise unchanged
  const targetName = sanitizeBlobFileName(originalName);

  if (containerName === CONTAINERS.CERTIFICATES || containerName === CONTAINERS.PROJECT_RECORDINGS) {
    console.log(`[ADLS Gen2] Directing upload to Data Lake for container: ${containerName}`);
    try {
    const serviceClient = getDataLakeServiceClient();
    const fileSystemClient = serviceClient.getFileSystemClient(containerName);
    await fileSystemClient.createIfNotExists();
    
    let folderName = '';
    if (containerName === CONTAINERS.CERTIFICATES) {
      const sanitizedName = memberName ? sanitizeDirectoryName(memberName) : 'unknown_member';
      folderName = `${memberId || 'unknown_id'}-${sanitizedName}`;
    } else {
      // For PROJECT_RECORDINGS, memberId is repurposed as projectId
      folderName = memberId || 'unknown_project';
    }

    // Ensure directory exists
    const directoryClient = fileSystemClient.getDirectoryClient(folderName);
    await directoryClient.createIfNotExists();

    // Upload file
    const fileClient = directoryClient.getFileClient(targetName);
    await fileClient.create();
    await fileClient.append(fileBuffer, 0, fileBuffer.length);
    await fileClient.flush(fileBuffer.length);
    await fileClient.setHttpHeaders({
      contentType: mimeType
    });

    const url = `https://${accountName}.blob.core.windows.net/${containerName}/${folderName}/${targetName}`;
    const blobName = `${folderName}/${targetName}`;
    return { url, blobName };
  } catch (err: any) {
    // The Azure SDK's RestError often arrives with an empty message, which used to
    // travel all the way out as `{"error":""}` — a 500 that told the caller nothing and
    // gave the UI nothing to show. Say which step failed and keep the real cause in the
    // log, where an operator can use it.
    console.error('[ADLS Gen2] upload failed:', err?.code || err?.name || err, err?.statusCode ?? '', err?.message ?? '');
    throw new AppError(
      `Could not store the file. The ${containerName} storage backend rejected the upload.`,
      502,
    );
  }
  } else {
    // Normal blob client
    const containerClient = await getContainerClient(containerName);
    await containerClient.createIfNotExists();
    // TT-063: the blob key used to be the sanitized original filename whenever a
    // caller did not pass a prefix — and most of the sixteen call sites do not. Two
    // people uploading "resume.pdf" landed on the same key and the second silently
    // overwrote the first, across members. Namespacing here rather than asking every
    // caller to remember means the guarantee cannot be lost by adding a new one.
    //
    // This is also the root cause behind TT-048 (CV and profile-picture keys), so
    // those uploads are covered without touching routes/members.ts.
    const finalBlobName = buildBlobName(originalName, customBlobPrefix);
    const blockBlobClient = containerClient.getBlockBlobClient(finalBlobName);

    await blockBlobClient.uploadData(fileBuffer, {
      blobHTTPHeaders: { blobContentType: mimeType },
    });

    const url = `https://${accountName}.blob.core.windows.net/${containerName}/${finalBlobName}`;
    return { url, blobName: finalBlobName };
  }
}

export async function deleteFile(containerName: string, blobName: string): Promise<void> {
  if (containerName === CONTAINERS.CERTIFICATES || containerName === CONTAINERS.PROJECT_RECORDINGS) {
    console.log(`[ADLS Gen2] Deleting file via Data Lake Client: ${blobName}`);
    const serviceClient = getDataLakeServiceClient();
    const fileSystemClient = serviceClient.getFileSystemClient(containerName);
    const fileClient = fileSystemClient.getFileClient(blobName);
    await fileClient.deleteIfExists();
  } else {
    const containerClient = await getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
  }
}

/**
 * TT-062: this signed whatever it was handed. The account key can mint a readable URL
 * for any blob in the storage account, so a caller-supplied container and path meant
 * every application-level authorization check could be walked around — other members'
 * CVs, certificates and meeting recordings included.
 *
 * Signing is the last line: it refuses containers this application does not own, and
 * paths that try to climb out of one. Callers are still expected to establish that the
 * requester may see the blob; this only makes sure a mistake there cannot become a key
 * to the whole account.
 */
export function assertSignableBlob(containerName: string, blobName: string): void {
  if (!Object.values(CONTAINERS).includes(containerName)) {
    throw new Error(`Refusing to sign a URL for unknown container "${containerName}".`);
  }
  if (!blobName || typeof blobName !== 'string') {
    throw new Error('Refusing to sign a URL without a blob name.');
  }
  // A leading slash makes the path absolute; ".." climbs; a backslash is a separator on
  // some clients and would slip past a naive check for "../".
  const normalized = blobName.replace(/\\/g, '/');
  if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error('Refusing to sign a URL for a blob path that escapes its container.');
  }
}

export function generateSasUrl({ containerName, blobName, permissions, expiryMinutes = 15 }: { containerName: string; blobName: string; permissions: string; expiryMinutes?: number }): string {
  if (!sharedKeyCredential) {
    throw new Error('StorageSharedKeyCredential is not configured properly. Ensure AccountKey is provided in the connection string.');
  }

  assertSignableBlob(containerName, blobName);

  const sasOptions = {
    containerName,
    blobName,
    permissions: BlobSASPermissions.parse(permissions),
    startsOn: new Date(Date.now() - 15 * 60 * 1000), // 15 min clock skew buffer
    expiresOn: new Date(Date.now() + expiryMinutes * 60 * 1000),
    protocol: "https" as any,
  };

  const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
  const encodedBlobName = blobName.split('/').map(encodeURIComponent).join('/');

  return `https://${accountName}.blob.core.windows.net/${containerName}/${encodedBlobName}?${sasToken}`;
}

export function extractBlobName(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const parts = parsed.pathname.split('/').filter(Boolean);
    // parts[0] is containerName, parts[1..] is the blobName path
    return decodeURIComponent(parts.slice(1).join('/'));
  } catch {
    const parts = urlStr.split('/');
    return decodeURIComponent(parts[parts.length - 1]);
  }
}

export function getContainerNameFromUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return decodeURIComponent(parts[0]);
  } catch {
    return CONTAINERS.PROJECT_DOCS;
  }
}

export async function listCertificatesForMember(memberId: string, memberName: string): Promise<string[]> {
  const serviceClient = getDataLakeServiceClient();
  const fileSystemClient = serviceClient.getFileSystemClient(CONTAINERS.CERTIFICATES);
  const sanitizedName = sanitizeDirectoryName(memberName);
  const folderName = `${memberId}-${sanitizedName}`;

  const files: string[] = [];
  try {
    const paths = fileSystemClient.listPaths({ path: folderName });
    for await (const path of paths) {
      if (!path.isDirectory) {
        files.push(`https://${accountName}.blob.core.windows.net/${CONTAINERS.CERTIFICATES}/${path.name}`);
      }
    }
  } catch (err: any) {
    console.error(`[ADLS Gen2] Failed to list paths for folder ${folderName}:`, err?.message);
  }
  return files;
}
