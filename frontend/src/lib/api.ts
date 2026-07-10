import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta as any).env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Typed error for duplicate-certificate 409 responses
export class DuplicateCertificateError extends Error {
  existingAssignmentId: string;
  constructor(message: string, existingAssignmentId: string) {
    super(message);
    this.name = 'DuplicateCertificateError';
    this.existingAssignmentId = existingAssignmentId;
  }
}

api.interceptors.response.use(
  res => res,
  err => {
    if (
      err.response?.status === 409 &&
      err.response?.data?.error === 'DUPLICATE_CERTIFICATE'
    ) {
      return Promise.reject(
        new DuplicateCertificateError(
          err.response.data.message,
          err.response.data.existingAssignmentId
        )
      );
    }
    const message = err.response?.data?.error || err.message || 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export default api;

// ---- Members ----
export const membersApi = {
  list: (params?: Record<string, unknown>) => api.get('/members', { params }),
  get: (id: string) => api.get(`/members/${id}`),
  create: (data: FormData) => api.post('/members', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: string, data: FormData) => api.put(`/members/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: string) => api.delete(`/members/${id}`),
  departments: () => api.get('/members/departments/list'),
};

// ---- Certifications ----
export const certificationsApi = {
  list: (params?: Record<string, unknown>) => api.get('/certifications', { params }),
  get: (id: string) => api.get(`/certifications/${id}`),
  create: (data: Record<string, unknown>) => api.post('/certifications', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/certifications/${id}`, data),
  delete: (id: string) => api.delete(`/certifications/${id}`),

  // Assignments
  assignments: (params?: Record<string, unknown>) => api.get('/certifications/assignments/all', { params }),
  assign: (data: Record<string, unknown>) => api.post('/certifications/assign', data),
  updateAssignment: (id: string, data: Record<string, unknown>) => api.put(`/certifications/assignments/${id}`, data),
  uploadCertificate: (id: string, data: FormData) =>
    api.post(`/certifications/assignments/${id}/certificate`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  analyzeCertificate: (id: string, data: FormData) =>
    api.post(`/certifications/assignments/${id}/certificate/analyze`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteAssignment: (id: string) => api.delete(`/certifications/assignments/${id}`),
  deleteCertificate: (id: string) => api.delete(`/certifications/assignments/${id}/certificate`),

  // Edit requests
  requestEdit: (id: string, data: { proposedChanges: Record<string, unknown>; requestedBy: string }) =>
    api.post(`/certifications/assignments/${id}/request-edit`, data),
  editRequests: (params?: Record<string, unknown>) => api.get('/certifications/edit-requests', { params }),
  approveEditRequest: (id: string, data?: { reviewedBy?: string; reviewNotes?: string }) =>
    api.post(`/certifications/edit-requests/${id}/approve`, data || {}),
  rejectEditRequest: (id: string, data?: { reviewedBy?: string; reviewNotes?: string }) =>
    api.post(`/certifications/edit-requests/${id}/reject`, data || {}),

  // Universal Certificate upload
  analyzeCertificateUniversal: (data: FormData) =>
    api.post('/certifications/certificate/analyze-universal', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadCertificateUniversal: (data: FormData) =>
    api.post('/certifications/certificate/upload-universal', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// ---- Projects ----
export const projectsApi = {
  list: (params?: Record<string, unknown>) => api.get('/projects', { params }),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (data: Record<string, unknown>) => api.post('/projects', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  addMember: (id: string, data: Record<string, unknown>) => api.post(`/projects/${id}/members`, data),
  updateMember: (id: string, memberId: string, data: Record<string, unknown>) => api.put(`/projects/${id}/members/${memberId}`, data),
  removeMember: (id: string, memberId: string) => api.delete(`/projects/${id}/members/${memberId}`),
};

// ---- Dashboard ----
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
  certificationStatus: () => api.get('/dashboard/certification-status'),
  projectProgress: () => api.get('/dashboard/project-progress'),
  monthlyCompletions: () => api.get('/dashboard/monthly-completions'),
  recentActivities: () => api.get('/dashboard/recent-activities'),
  upcomingDeadlines: () => api.get('/dashboard/upcoming-deadlines'),
};

// ---- Notifications ----
export const notificationsApi = {
  list: (params?: Record<string, unknown>) => api.get('/notifications', { params }),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all/mark'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
};

// ---- Search ----
export const searchApi = {
  global: (q: string) => api.get('/search', { params: { q } }),
  deadlines: () => api.get('/search/deadlines'),
};

// ---- Reports ----
export const reportsApi = {
  team: (format: string) => api.get(`/reports/team?format=${format}`, { responseType: format === 'json' ? 'json' : 'blob' }),
  certifications: (format: string) => api.get(`/reports/certifications?format=${format}`, { responseType: format === 'json' ? 'json' : 'blob' }),
  projects: (format: string) => api.get(`/reports/projects?format=${format}`, { responseType: format === 'json' ? 'json' : 'blob' }),
  deadlines: (format: string) => api.get(`/reports/deadlines?format=${format}`, { responseType: format === 'json' ? 'json' : 'blob' }),
};

// ---- Project Updates ----
export const projectUpdatesApi = {
  list: (params?: Record<string, unknown>) => api.get('/project-updates', { params }),
  create: (data: Record<string, unknown>) => api.post('/project-updates', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/project-updates/${id}`, data),
  delete: (id: string) => api.delete(`/project-updates/${id}`),
};

// ---- Documentation ----
export const documentationApi = {
  get: (projectId: string) => api.get(`/projects/${projectId}/documentation`),
  
  getUploadUrl: (projectId: string, data: { fileName: string; fileType: string; uploadedBy: string }) =>
    api.post(`/projects/${projectId}/documentation/upload-url`, data),
    
  createFileMetadata: (projectId: string, data: { blobName: string; fileName: string; fileType: string; size: number; uploadedBy: string }) =>
    api.post(`/projects/${projectId}/documentation/files`, data),
    
  deleteFile: (projectId: string, fileId: string, memberId: string) =>
    api.delete(`/projects/${projectId}/documentation/files/${fileId}`, { params: { memberId } }),

  getDownloadUrl: (projectId: string, fileId: string, memberId: string) =>
    api.get(`/projects/${projectId}/documentation/files/${fileId}/download-url`, { params: { memberId } }),

  createLink: (projectId: string, data: Record<string, unknown>) =>
    api.post(`/projects/${projectId}/documentation/links`, data),
  updateLink: (projectId: string, linkId: string, data: Record<string, unknown>) =>
    api.put(`/projects/${projectId}/documentation/links/${linkId}`, data),
  deleteLink: (projectId: string, linkId: string, memberId: string) =>
    api.delete(`/projects/${projectId}/documentation/links/${linkId}`, { params: { memberId } }),

  createNote: (projectId: string, data: Record<string, unknown>) =>
    api.post(`/projects/${projectId}/documentation/notes`, data),
  updateNote: (projectId: string, noteId: string, data: Record<string, unknown>) =>
    api.put(`/projects/${projectId}/documentation/notes/${noteId}`, data),
  deleteNote: (projectId: string, noteId: string, memberId: string) =>
    api.delete(`/projects/${projectId}/documentation/notes/${noteId}`, { params: { memberId } }),
};

