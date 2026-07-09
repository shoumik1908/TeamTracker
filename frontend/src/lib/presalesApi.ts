import api from './api';
import { PreSalesOpportunity } from '@/types';

export const presalesApi = {
  // Fetch all opportunities
  list: async (): Promise<{ data: PreSalesOpportunity[] }> => {
    const res = await api.get('/presales');
    return res.data;
  },

  // Update stage of an opportunity
  updateStage: async (id: string, stageIndex: number): Promise<{ data: PreSalesOpportunity }> => {
    const res = await api.patch(`/presales/${id}/stage`, { stageIndex });
    return res.data;
  },

  // Create PNB and/or TNM opportunities selectively based on user checkbox selection
  create: async (data: {
    name: string;
    clientName: string;
    createPnb: boolean;
    createTnm: boolean;
  }): Promise<{ data: PreSalesOpportunity }> => {
    const res = await api.post('/presales', data);
    return res.data;
  },

  // Delete records matching this Client Name and Opportunity Name (and optionally account type)
  delete: async (name: string, clientName: string, account?: 'PNB' | 'TNM'): Promise<{ success: boolean }> => {
    const res = await api.delete('/presales', {
      params: { name, clientName, account }
    });
    return res.data;
  }
};
