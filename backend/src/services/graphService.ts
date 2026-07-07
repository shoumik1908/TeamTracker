import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import 'isomorphic-fetch';

let graphClient: Client | null = null;

export function getGraphClient(): Client {
  if (graphClient) return graphClient;

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Azure Graph API credentials are not fully configured in the environment.');
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });

  graphClient = Client.initWithMiddleware({
    authProvider,
  });

  return graphClient;
}

export async function getMeetingTranscript(userId: string, meetingId: string) {
  try {
    const client = getGraphClient();
    const transcripts = await client
      .api(`/users/${userId}/onlineMeetings/${meetingId}/transcripts`)
      .get();
      
    if (transcripts.value && transcripts.value.length > 0) {
      const transcriptId = transcripts.value[0].id;
      // In production, you would fetch actual text/vtt content.
      return "Meeting transcript text will appear here. Note: Microsoft Graph APIs for online meeting transcripts require specific application permissions or delegated flow.";
    }
    return null;
  } catch (error) {
    console.error(`Failed to fetch transcript for meeting ${meetingId}:`, error);
    return null;
  }
}

export async function getMeetingRecording(userId: string, meetingId: string) {
  try {
    const client = getGraphClient();
    const recordings = await client
      .api(`/users/${userId}/onlineMeetings/${meetingId}/recordings`)
      .get();
      
    if (recordings.value && recordings.value.length > 0) {
      return recordings.value[0].webUrl || recordings.value[0].contentCorrelationId;
    }
    return null;
  } catch (error) {
    console.error(`Failed to fetch recording for meeting ${meetingId}:`, error);
    return null;
  }
}
