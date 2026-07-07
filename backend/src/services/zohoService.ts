import axios from 'axios';

let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Gets a valid access token using the refresh token.
 */
export const getValidZohoToken = async (): Promise<string> => {
  // If we have a valid token that hasn't expired yet (adding 10s buffer), return it
  if (accessToken && Date.now() < tokenExpiresAt - 10000) {
    return accessToken;
  }

  try {
    const response = await axios.post('https://accounts.zoho.in/oauth/v2/token', null, {
      params: {
        grant_type: 'refresh_token',
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      },
    });

    accessToken = response.data.access_token;
    // expires_in is usually in seconds (e.g., 3600)
    tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);
    
    return accessToken as string;
  } catch (error: any) {
    console.error('Error refreshing Zoho token:', error.response?.data || error.message);
    throw new Error('Failed to refresh Zoho token');
  }
};

/**
 * Fetches the employee records for the authenticated user
 */
export const getMyZohoProfile = async () => {
  try {
    const token = await getValidZohoToken();
    
    const response = await axios.get(
      'https://people.zoho.in/people/api/forms/employee/getRecords',
      { 
        headers: { 
          Authorization: `Zoho-oauthtoken ${token}` 
        } 
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Error fetching Zoho profile:', error.response?.data || error.message);
    throw error;
  }
};
