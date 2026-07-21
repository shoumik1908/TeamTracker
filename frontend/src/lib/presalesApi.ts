import api from './api';
import { PreSalesOpportunity } from '@/types';

export interface PresalesAnalysisResult {
  detected_track: 'PNB' | 'TNM' | 'unclear';
  suggested_increment_percent: number;
  current_stage_still_applies: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export const presalesApi = {
  // Fetch all opportunities
  list: async (): Promise<{ data: PreSalesOpportunity[] }> => {
    const res = await api.get('/presales');
    return res.data;
  },

  // Update stage of an opportunity — optionally with audit metadata
  updateStage: async (
    id: string,
    stageIndex: number,
    source?: 'manual' | 'ai_suggested',
    reasoning?: string,
    blobUrl?: string
  ): Promise<{ data: PreSalesOpportunity }> => {
    const res = await api.patch(`/presales/${id}/stage`, {
      stageIndex,
      ...(source && { source }),
      ...(reasoning && { reasoning }),
      ...(blobUrl && { blobUrl }),
    });
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
  },

  // Update name and clientName for an opportunity group
  updateDetails: async (params: {
    oldName: string;
    oldClientName: string;
    newName: string;
    newClientName: string;
  }): Promise<{ success: boolean }> => {
    const res = await api.put('/presales', params);
    return res.data;
  },

  // Convert opportunity to Project
  convert: async (id: string): Promise<{ data: any }> => {
    const res = await api.post(`/presales/${id}/convert`);
    return res.data;
  },

  // Upload a document for AI track + incremental progress analysis
  analyzeDoc: async (
    formData: FormData
  ): Promise<{ data: { analysis: PresalesAnalysisResult; blobUrl: string | null; originalFilename?: string; currentPercent: number; newTotalPercent: number } }> => {
    const res = await api.post('/presales/analyze-doc', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // Apply an AI-suggested incremental progress update (PATCH /:id/progress)
  updateProgress: async (
    id: string,
    incrementPercent: number,
    source: 'ai_suggested',
    reasoning?: string,
    blobUrl?: string,
    originalFilename?: string
  ): Promise<{ data: PreSalesOpportunity }> => {
    const res = await api.patch(`/presales/${id}/progress`, {
      incrementPercent,
      source,
      ...(reasoning && { reasoning }),
      ...(blobUrl && { blobUrl }),
      ...(originalFilename && { originalFilename }),
    });
    return res.data;
  },
  // Fetch all documents (stage change logs with blobs) for given opportunity IDs
  getDocs: async (oppIds: string[]): Promise<{ data: any[] }> => {
    if (oppIds.length === 0) return { data: [] };
    const res = await api.get('/presales/docs', {
      params: { oppIds: oppIds.join(',') },
    });
    return res.data;
  },

  // Delete a specific document by log ID
  deleteDoc: async (id: string): Promise<{ data: any }> => {
    const res = await api.delete(`/presales/docs/${id}`);
    return res.data;
  },

  // Get a single opportunity with its related data
  get: async (id: string): Promise<{ data: any }> => {
    const res = await api.get(`/presales/${id}`);
    return res.data;
  },

  // Update a specific section or description of an opportunity
  updateSection: async (id: string, data: Record<string, string>): Promise<{ data: PreSalesOpportunity }> => {
    const res = await api.patch(`/presales/${id}`, data);
    return res.data;
  },

  // Convert an opportunity to a project
  convertToProject: async (id: string): Promise<{ data: any }> => {
    const res = await api.post(`/presales/${id}/convert`);
    return res.data;
  },

  // Add a member to an opportunity
  addMember: async (id: string, data: Record<string, unknown>): Promise<{ data: any }> => {
    const res = await api.post(`/presales/${id}/members`, data);
    return res.data;
  },

  // Remove a member from an opportunity
  removeMember: async (id: string, memberId: string): Promise<{ data: any }> => {
    const res = await api.delete(`/presales/${id}/members/${memberId}`);
    return res.data;
  },

  // Reset an opportunity back to initial state
  reset: async (id: string): Promise<{ data: PreSalesOpportunity }> => {
    const res = await api.post(`/presales/${id}/reset`);
    return res.data;
  },

  // Generate a 9-section proposal summary from one or more uploaded documents
  generateProposal: async (id: string, formData: FormData): Promise<{ data: any }> => {
    const res = await api.post(`/presales/${id}/generate-proposal`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // Alias for backward compatibility/modal routes
  addToProposal: async (id: string, formData: FormData): Promise<{ data: any }> => {
    return presalesApi.generateProposal(id, formData);
  },

  // Generate content for a single section from an uploaded document
  generateSection: async (id: string, formData: FormData): Promise<{ data: { proposedContent: string | null } }> => {
    const res = await api.post(`/presales/${id}/generate-section`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};
