import api from './api';

export interface FileItem {
  id: string;
  fileName: string;
  blobUrl: string;
  container: string;
  category: 'CV' | 'Certificate' | 'GTM Document';
  entityId: string;
  entityName: string;
  entityGroup: 'By Team Member' | 'By Client / Opportunity';
  uploadDate: string;
}

export interface FilesResponse {
  flat: FileItem[];
  grouped: {
    'By Team Member': Record<string, FileItem[]>;
    'By Client / Opportunity': Record<string, FileItem[]>;
  };
}

export const filesApi = {
  getFiles: async (): Promise<{ data: FilesResponse }> => {
    const res = await api.get('/files');
    return res.data;
  },

  getSasUrl: async (blobUrl: string, container: string): Promise<{ data: { sasUrl: string } }> => {
    const res = await api.post('/files/sas', { blobUrl, container });
    return res.data;
  },

  deleteFile: async (id: string): Promise<{ success: boolean }> => {
    const res = await api.delete(`/files/${id}`);
    return res.data;
  },
};
