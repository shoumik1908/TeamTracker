import api from './api';

export interface FileItem {
  id: string;
  fileName: string;
  blobUrl: string;
  container: string;
  category: 'CV' | 'Certificate' | 'GTM Document' | 'Project Document' | 'PDF' | 'Word Doc';
  entityId: string;
  entityName: string;
  entityGroup: 'By Team Member' | 'By Client / Opportunity' | 'By Project';
  uploadDate: string;
}

export interface FilesResponse {
  flat: FileItem[];
  grouped: {
    'By Team Member': Record<string, FileItem[]>;
    'By Client / Opportunity': Record<string, FileItem[]>;
    'By Project': Record<string, FileItem[]>;
  };
}

export const filesApi = {
  getFiles: async (): Promise<{ data: FilesResponse }> => {
    const res = await api.get('/files');
    return res.data;
  },

  // Send the file's id, not its blob path: the server resolves the blob and
  // re-checks ownership, so a caller cannot ask for an arbitrary object.
  getSasUrl: async (fileId: string): Promise<{ data: { sasUrl: string } }> => {
    const res = await api.post('/files/sas', { fileId });
    return res.data;
  },

  deleteFile: async (id: string): Promise<{ success: boolean }> => {
    const res = await api.delete(`/files/${id}`);
    return res.data;
  },
};
