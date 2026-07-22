const baseURL = (import.meta as any).env.VITE_API_URL || '/api';

// Typed error for duplicate-certificate 409 responses
export class DuplicateCertificateError extends Error {
  existingAssignmentId: string;
  constructor(message: string, existingAssignmentId: string) {
    super(message);
    this.name = 'DuplicateCertificateError';
    this.existingAssignmentId = existingAssignmentId;
  }
}

async function fetchApi(method: string, url: string, data?: any, config?: any) {
  let fullUrl = url.startsWith('http') ? url : `${baseURL}${url}`;
  
  if (config?.params) {
    const searchParams = new URLSearchParams();
    for (const key in config.params) {
      if (config.params[key] !== undefined && config.params[key] !== null) {
        searchParams.append(key, String(config.params[key]));
      }
    }
    const query = searchParams.toString();
    if (query) fullUrl += (fullUrl.includes('?') ? '&' : '?') + query;
  }

  const headers = new Headers();
  if (!(data instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  const token = localStorage.getItem('token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  
  if (config?.headers) {
    for (const key in config.headers) {
      if (config.headers[key] === 'multipart/form-data') continue; // Let browser set boundary
      headers.set(key, config.headers[key]);
    }
  }

  const options: RequestInit = { method, headers };
  if (data && data instanceof FormData) options.body = data;
  else if (data) options.body = JSON.stringify(data);

  const res = await fetch(fullUrl, options);

  if (config?.responseType === 'blob') {
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res; // Fetch blob response is handled by caller via res.blob() or just return res
  }

  const text = await res.text();
  const resData = text ? JSON.parse(text) : {};

  if (!res.ok) {
    if (res.status === 409 && resData.error === 'DUPLICATE_CERTIFICATE') {
      throw new DuplicateCertificateError(resData.message, resData.existingAssignmentId);
    }
    const message = resData.error || resData.message || 'Something went wrong';
    throw new Error(message);
  }

  return { data: resData, status: res.status, headers: res.headers };
}

const api = {
  get: <T = any>(url: string, config?: any) => fetchApi('GET', url, undefined, config) as Promise<{data: T, status: number, headers: Headers}>,
  post: <T = any>(url: string, data?: any, config?: any) => fetchApi('POST', url, data, config) as Promise<{data: T, status: number, headers: Headers}>,
  put: <T = any>(url: string, data?: any, config?: any) => fetchApi('PUT', url, data, config) as Promise<{data: T, status: number, headers: Headers}>,
  patch: <T = any>(url: string, data?: any, config?: any) => fetchApi('PATCH', url, data, config) as Promise<{data: T, status: number, headers: Headers}>,
  delete: <T = any>(url: string, config?: any) => fetchApi('DELETE', url, undefined, config) as Promise<{data: T, status: number, headers: Headers}>,
};

export default api;

// ---- Members ----
export const membersApi = {
  list: (params?: Record<string, unknown>) => api.get('/members', { params }),
  get: (id: string) => api.get(`/members/${id}`),
  create: (data: FormData) => api.post('/members', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: string, data: FormData) => api.put(`/members/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: string) => api.delete(`/members/${id}`),
  departments: () => api.get('/members/departments/list'),
  uploadCv: (id: string, formData: FormData) =>
    api.post(`/members/${id}/upload-cv`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteCv: (id: string) => api.delete(`/members/${id}/cv`),
  getWithResumes: () => api.get('/members/with-resumes'),
  getResumeProfile: (id: string) => api.get(`/members/${id}/resume-profile`),
};

// ---- Resume Generation ----
export const resumeGenerationApi = {
  generateFixed: (id: string) => api.post(`/resume-generation/${id}/generate`),
  generateTailored: (id: string, data: FormData) => api.post(`/resume-generation/${id}/generate-tailored`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  generateTailoredFromFile: (data: FormData) => api.post(`/resume-generation/generate-tailored-from-file`, data, { 
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'blob' 
  })
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
  enroll: (id: string) => api.post(`/projects/${id}/enroll`),
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

// ---- Tasks ----
export const tasksApi = {
  list: (params?: Record<string, unknown>) => api.get('/tasks', { params }),
  create: (data: Record<string, unknown>) => api.post('/tasks', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
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

export const meetingRecordsApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/meeting-records`),
  create: (projectId: string, formData: FormData) => 
    api.post(`/projects/${projectId}/meeting-records`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  delete: (projectId: string, recordId: string) => 
    api.delete(`/projects/${projectId}/meeting-records/${recordId}`),
  toggleActionItem: (projectId: string, itemId: string, completed: boolean) =>
    api.patch(`/projects/${projectId}/meeting-records/action-items/${itemId}`, { completed }),
  reanalyze: (projectId: string, recordId: string) =>
    api.post(`/projects/${projectId}/meeting-records/${recordId}/reanalyze`),
  updateTranscript: (projectId: string, recordId: string, transcriptText: string) =>
    api.patch(`/projects/${projectId}/meeting-records/${recordId}/transcript`, { transcriptText })
};

// ---- PreSales Documentation ----
export const presalesDocumentationApi = {
  getUploadUrl: (opportunityId: string, data: { fileName: string; fileType: string; uploadedBy: string }) =>
    api.post(`/presales/${opportunityId}/documentation/upload-url`, data),
    
  createFileMetadata: (opportunityId: string, data: { blobName: string; fileName: string; fileType: string; size: number; uploadedBy: string }) =>
    api.post(`/presales/${opportunityId}/documentation/files`, data),
    
  deleteFile: (opportunityId: string, fileId: string, memberId: string) =>
    api.delete(`/presales/${opportunityId}/documentation/files/${fileId}`, { params: { memberId } }),

  getDownloadUrl: (opportunityId: string, fileId: string, memberId: string) =>
    api.get(`/presales/${opportunityId}/documentation/files/${fileId}/download-url`, { params: { memberId } }),

  createLink: (opportunityId: string, data: Record<string, unknown>) =>
    api.post(`/presales/${opportunityId}/documentation/links`, data),
  updateLink: (opportunityId: string, linkId: string, data: Record<string, unknown>) =>
    api.put(`/presales/${opportunityId}/documentation/links/${linkId}`, data),
  deleteLink: (opportunityId: string, linkId: string, memberId: string) =>
    api.delete(`/presales/${opportunityId}/documentation/links/${linkId}`, { params: { memberId } }),

  createNote: (opportunityId: string, data: Record<string, unknown>) =>
    api.post(`/presales/${opportunityId}/documentation/notes`, data),
  updateNote: (opportunityId: string, noteId: string, data: Record<string, unknown>) =>
    api.put(`/presales/${opportunityId}/documentation/notes/${noteId}`, data),
  deleteNote: (opportunityId: string, noteId: string, memberId: string) =>
    api.delete(`/presales/${opportunityId}/documentation/notes/${noteId}`, { params: { memberId } }),
};

// ---- PreSales Meeting Records ----
export const presalesMeetingRecordsApi = {
  list: (opportunityId: string) => api.get(`/presales/${opportunityId}/meeting-records`),
  create: (opportunityId: string, formData: FormData) => 
    api.post(`/presales/${opportunityId}/meeting-records`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  delete: (opportunityId: string, recordId: string) => 
    api.delete(`/presales/${opportunityId}/meeting-records/${recordId}`),
  toggleActionItem: (opportunityId: string, itemId: string, completed: boolean) =>
    api.patch(`/presales/${opportunityId}/meeting-records/action-items/${itemId}`, { completed }),
  reanalyze: (opportunityId: string, recordId: string) =>
    api.post(`/presales/${opportunityId}/meeting-records/${recordId}/reanalyze`),
  updateTranscript: (opportunityId: string, recordId: string, transcriptText: string) =>
    api.patch(`/presales/${opportunityId}/meeting-records/${recordId}/transcript`, { transcriptText })
};

// ---- Auth & Admin ----
export const authApi = {
  login: (data: Record<string, string>) => api.post('/auth/login', data),
  register: (data: Record<string, string>) => api.post('/auth/register', data),
  changePassword: (data: Record<string, string>) => api.post('/auth/change-password', data),
  getMe: () => api.get('/auth/me')
};

export const adminApi = {
  getUsers: () => api.get('/admin/users'),
  getRoles: () => api.get('/admin/roles'),
  updateRole: (userId: string, roleId: string) => api.patch(`/admin/users/${userId}/role`, { roleId }),
  updateStatus: (userId: string, isActive: boolean) => api.patch(`/admin/users/${userId}/status`, { isActive }),
  resetPassword: (userId: string) => api.post(`/admin/users/${userId}/reset-password`)
};
