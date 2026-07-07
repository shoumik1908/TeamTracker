import { Router, Request, Response } from 'express';
import { getMyZohoProfile } from '../services/zohoService';

const router = Router();

// GET /api/my-profile - (matches the path Claude suggested)
// Can also be prefixed as /api/zoho/my-profile depending on index.ts
router.get('/my-profile', async (req: Request, res: Response) => {
  try {
    const profileData = await getMyZohoProfile();
    res.json(profileData);
  } catch (error: any) {
    const zohoError = error.response?.data || error.message;
    res.status(500).json({ 
      error: 'Failed to fetch profile from Zoho People', 
      details: zohoError 
    });
  }
});

export default router;
