import { BlobServiceClient, ContainerClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';
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

function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured');
    }
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  }
  return blobServiceClient;
}

async function getContainerClient(containerName: string): Promise<ContainerClient> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(containerName);
  // await containerClient.createIfNotExists();
  return containerClient;
}

export async function uploadFile(
  containerName: string,
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{ url: string; blobName: string }> {
  const containerClient = await getContainerClient(containerName);
  const ext = originalName.split('.').pop() || '';
  const blobName = `${uuidv4()}.${ext}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(fileBuffer, {
    blobHTTPHeaders: { blobContentType: mimeType },
  });

  const url = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}`;
  return { url, blobName };
}

export async function deleteFile(containerName: string, blobName: string): Promise<void> {
  const containerClient = await getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
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

  return `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(blobName)}?${sasToken}`;
}

export function extractBlobName(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1];
}

export const CONTAINERS = {
  CERTIFICATES: process.env.AZURE_CONTAINER_CERTIFICATES || 'certificates',
  PROFILE_IMAGES: process.env.AZURE_CONTAINER_PROFILE_IMAGES || 'profile-images',
  PROJECT_DOCS: process.env.AZURE_CONTAINER_PROJECT_DOCS || 'project-documents',
  REPORTS: process.env.AZURE_CONTAINER_REPORTS || 'reports',
};
