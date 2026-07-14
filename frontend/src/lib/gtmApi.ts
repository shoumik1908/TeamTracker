import api from './api';
import { GtmPlan, GtmCategory, GtmPartner, GtmCampaign, GtmCollateral, GtmAuditResult } from '@/types';

export const gtmApi = {
  // ─── LAUNCHES (EXISTING) ──────────────────────────────────────────────────────
  // Fetch all GTM plans
  list: async (): Promise<{ data: GtmPlan[] }> => {
    const res = await api.get('/gtm');
    return res.data;
  },

  // Update stage of a GTM plan
  updateStage: async (id: string, stageIndex: number): Promise<{ data: GtmPlan }> => {
    const res = await api.patch(`/gtm/${id}/stage`, { stageIndex });
    return res.data;
  },

  // Create a new GTM plan
  create: async (data: {
    name: string;
    clientName: string;
    category: GtmCategory;
  }): Promise<{ data: GtmPlan }> => {
    const res = await api.post('/gtm', data);
    return res.data;
  },

  // Delete records matching this Client Name and GTM Plan Name (and optionally category)
  delete: async (name: string, clientName: string, category?: GtmCategory): Promise<{ success: boolean }> => {
    const res = await api.delete('/gtm', {
      params: { name, clientName, category }
    });
    return res.data;
  },

  // Update name and clientName for a GTM plan group
  updateDetails: async (params: {
    oldName: string;
    oldClientName: string;
    newName: string;
    newClientName: string;
  }): Promise<{ success: boolean; count: number }> => {
    const res = await api.put('/gtm', params);
    return res.data;
  },

  // ─── PARTNERS ────────────────────────────────────────────────────────────────
  // List all certifications for dropdown
  getCertificationsCatalog: async (): Promise<{ data: Array<{ id: string; name: string; provider: string }> }> => {
    const res = await api.get('/gtm/certifications');
    return res.data;
  },

  // List all partners
  listPartners: async (): Promise<{ data: GtmPartner[] }> => {
    const res = await api.get('/gtm/partners');
    return res.data;
  },

  // Create partner
  createPartner: async (data: {
    name: string;
    tier: string;
    renewalDate: string;
    requirements: Array<{ certificationName: string; minimumCount: number }>;
  }): Promise<{ data: GtmPartner }> => {
    const res = await api.post('/gtm/partners', data);
    return res.data;
  },

  // Update partner
  updatePartner: async (id: string, data: {
    name: string;
    tier: string;
    renewalDate: string;
    requirements: Array<{ certificationName: string; minimumCount: number }>;
  }): Promise<{ data: GtmPartner }> => {
    const res = await api.put(`/gtm/partners/${id}`, data);
    return res.data;
  },

  // Delete partner
  deletePartner: async (id: string): Promise<{ success: boolean }> => {
    const res = await api.delete(`/gtm/partners/${id}`);
    return res.data;
  },

  // ─── AUDIT ───────────────────────────────────────────────────────────────────
  // Get GTM partner requirements audit results
  getAudit: async (): Promise<{ data: GtmAuditResult[] }> => {
    const res = await api.get('/gtm/audit');
    return res.data;
  },

  // ─── CAMPAIGNS ───────────────────────────────────────────────────────────────
  // List all campaigns
  listCampaigns: async (): Promise<{ data: GtmCampaign[] }> => {
    const res = await api.get('/gtm/campaigns');
    return res.data;
  },

  // Create campaign
  createCampaign: async (data: {
    name: string;
    launchId?: string | null;
    partnerId?: string | null;
    status: string;
    startDate?: string | null;
    endDate?: string | null;
    description?: string | null;
  }): Promise<{ data: GtmCampaign }> => {
    const res = await api.post('/gtm/campaigns', data);
    return res.data;
  },

  // Update campaign
  updateCampaign: async (id: string, data: {
    name: string;
    launchId?: string | null;
    partnerId?: string | null;
    status: string;
    startDate?: string | null;
    endDate?: string | null;
    description?: string | null;
  }): Promise<{ data: GtmCampaign }> => {
    const res = await api.put(`/gtm/campaigns/${id}`, data);
    return res.data;
  },

  // Delete campaign
  deleteCampaign: async (id: string): Promise<{ success: boolean }> => {
    const res = await api.delete(`/gtm/campaigns/${id}`);
    return res.data;
  },

  // ─── COLLATERAL ──────────────────────────────────────────────────────────────
  // List all GTM collateral files
  listCollaterals: async (): Promise<{ data: GtmCollateral[] }> => {
    const res = await api.get('/gtm/collaterals');
    return res.data;
  },

  // Get upload SAS URL
  getCollateralUploadUrl: async (data: { fileName: string; fileType: string }): Promise<{ uploadUrl: string; blobName: string; contentType: string }> => {
    const res = await api.post('/gtm/collaterals/upload-url', data);
    return res.data;
  },

  // Create file metadata record
  createCollateral: async (data: {
    blobName: string;
    fileName: string;
    fileType: string;
    size: number;
    uploadedBy: string;
    launchId?: string | null;
    partnerId?: string | null;
  }): Promise<{ data: GtmCollateral }> => {
    const res = await api.post('/gtm/collaterals', data);
    return res.data;
  },

  // Get download link
  getCollateralDownloadUrl: async (id: string): Promise<{ downloadUrl: string; fileName: string }> => {
    const res = await api.get(`/gtm/collaterals/${id}/download-url`);
    return res.data;
  },

  // Delete collateral file
  deleteCollateral: async (id: string): Promise<{ success: boolean }> => {
    const res = await api.delete(`/gtm/collaterals/${id}`);
    return res.data;
  }
};
