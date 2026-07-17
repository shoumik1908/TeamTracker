import api from './api';

export interface ActivityLog {
  id: string;
  category: string;
  action: string;
  details: string;
  performedBy: string;
  createdAt: string;
}

export interface LogsResponse {
  data: ActivityLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const fetchLogs = async (
  page: number = 1,
  limit: number = 50,
  category: string = 'All',
  search: string = ''
): Promise<LogsResponse> => {
  const params: Record<string, string | number> = {
    page,
    limit,
    category,
  };
  
  if (search) {
    params.search = search;
  }

  const response = await api.get('/logs', { params });
  return response.data;
};
