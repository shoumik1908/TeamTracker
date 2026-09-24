import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NotificationsPage from './NotificationsPage';

// The page only needs to know whether the viewer is an admin; a team member is not.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => false }) }));

const body = {
  data: [
    { id: 'n1', type: 'CERTIFICATION_ASSIGNED', title: 'New certification assigned', message: 'You have been assigned CKA.', read: false, createdAt: new Date().toISOString(), memberId: 'm1' },
  ],
  unreadCount: 1,
  pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
};

vi.mock('@/lib/api', () => ({
  notificationsApi: {
    // api.get resolves an envelope; the page unwraps it with .then(r => r.data).
    list: vi.fn(() => Promise.resolve({ data: body, status: 200, headers: new Headers() })),
    markRead: vi.fn(), markAllRead: vi.fn(), delete: vi.fn(),
  },
  certificationsApi: { approveEditRequest: vi.fn(), rejectEditRequest: vi.fn() },
}));

function renderWith(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <NotificationsPage />
    </QueryClientProvider>,
  );
}

describe('NotificationsPage', () => {
  afterEach(cleanup);

  it('renders the notifications returned by the API', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderWith(client);
    expect(await screen.findByText('New certification assigned')).toBeInTheDocument();
    expect(await screen.findByText('1 unread · 1 total')).toBeInTheDocument();
  });

  it('survives a cache entry written in the raw-envelope shape', async () => {
    // The team-member dashboard used to write {data,status,headers} under this very key,
    // while this page expects the unwrapped body. One shared QueryClient meant a member
    // who opened the dashboard first crashed this page on `data.pagination.total`, which
    // unmounted the whole app to a white screen. The keys are distinct now; this asserts
    // the page cannot be blanked by a mismatched cache entry even so.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['notifications'], { data: body, status: 200, headers: new Headers() });

    expect(() => renderWith(client)).not.toThrow();
    expect(await screen.findByText('Notifications')).toBeInTheDocument();
  });
});
