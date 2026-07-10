import { BlobServiceClient, ContainerClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';
import { DataLakeServiceClient } from '@azure/storage-file-datalake';
import { v4 as uuidv4 } from 'uuid';

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
};

export async function uploadFile(
  containerName: string,
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  memberId?: string,
  memberName?: string
): Promise<{ url: string; blobName: string }> {
  const ext = originalName.split('.').pop() || '';
  const uniqueName = `${uuidv4()}.${ext}`;

  if (containerName === CONTAINERS.CERTIFICATES) {
    console.log(`[ADLS Gen2] Directing upload to Data Lake for memberId: ${memberId}, name: ${memberName}`);
    const serviceClient = getDataLakeServiceClient();
    const fileSystemClient = serviceClient.getFileSystemClient(containerName);
    
    // Create member folder: {teamMemberId}-{PersonName}
    const sanitizedName = memberName ? sanitizeDirectoryName(memberName) : 'unknown_member';
    const folderName = `${memberId || 'unknown_id'}-${sanitizedName}`;

    // Ensure directory exists
    const directoryClient = fileSystemClient.getDirectoryClient(folderName);
    await directoryClient.createIfNotExists();

    // Upload file
    const fileClient = directoryClient.getFileClient(uniqueName);
    await fileClient.create();
    await fileClient.append(fileBuffer, 0, fileBuffer.length);
    await fileClient.flush(fileBuffer.length);
    await fileClient.setHttpHeaders({
      contentType: mimeType
    });

    const url = `https://${accountName}.blob.core.windows.net/${containerName}/${folderName}/${uniqueName}`;
    const blobName = `${folderName}/${uniqueName}`;
    return { url, blobName };
  } else {
    // Normal blob client
    const containerClient = await getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(uniqueName);

    await blockBlobClient.uploadData(fileBuffer, {
      blobHTTPHeaders: { blobContentType: mimeType },
    });

    const url = `https://${accountName}.blob.core.windows.net/${containerName}/${uniqueName}`;
    return { url, blobName: uniqueName };
  }
}

export async function deleteFile(containerName: string, blobName: string): Promise<void> {
  if (containerName === CONTAINERS.CERTIFICATES) {
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

export function generateSasUrl({ containerName, blobName, permissions, expiryMinutes = 15 }: { containerName: string; blobName: string; permissions: string; expiryMinutes?: number }): string {
  if (!sharedKeyCredential) {
    throw new Error('StorageSharedKeyCredential is not configured properly. Ensure AccountKey is provided in the connection string.');
  }

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
