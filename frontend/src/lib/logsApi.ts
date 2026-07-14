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
  const query = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    category,
  });
  
  if (search) {
    query.append('search', search);
  }

  const response = await fetch(`/api/logs?${query.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch logs');
  }
  return response.json();
};
