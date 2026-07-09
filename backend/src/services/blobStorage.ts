import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME || '';

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
  await containerClient.createIfNotExists();
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

export async function downloadFileStream(containerName: string, blobName: string): Promise<NodeJS.ReadableStream> {
  const containerClient = await getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const downloadResponse = await blockBlobClient.download(0);
  if (!downloadResponse.readableStreamBody) {
    throw new Error('Readable stream not available');
  }
  return downloadResponse.readableStreamBody;
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
