import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type User, useAuth } from './AuthContext';
import { queryClient } from '../lib/queryClient';

const alice: User = {
  id: 'user-1',
  name: 'Alice',
  email: 'alice@example.com',
  mustChangePassword: false,
  teamMemberId: 'member-1',
  role: { id: 'r1', name: 'Admin', permissions: { read: true, write: true, delete: true, manageTeam: true } },
};

function Harness() {
  const { user, login, logout } = useAuth();
  return (
    <>
      <button onClick={() => login('tok', alice)}>in</button>
      <button onClick={logout}>out</button>
      <span>{user ? user.name : 'nobody'}</span>
    </>
  );
}

describe('logout and the query cache (TT-068)', () => {
  beforeEach(() => {
    localStorage.clear();
    queryClient.clear();
  });

  afterEach(cleanup);

  it('discards cached responses so the next user cannot see them', () => {
    // These are the real keys the app caches under.
    queryClient.setQueryData(['admin-users'], [{ id: 'u1', email: 'alice@example.com' }]);
    queryClient.setQueryData(['current-user'], alice);
    queryClient.setQueryData(['notifications-panel'], [{ id: 'n1', title: 'Private' }]);

    render(<AuthProvider><Harness /></AuthProvider>);
    act(() => { screen.getByText('in').click(); });
    expect(queryClient.getQueryData(['admin-users'])).toBeDefined();

    act(() => { screen.getByText('out').click(); });

    expect(queryClient.getQueryData(['admin-users'])).toBeUndefined();
    expect(queryClient.getQueryData(['current-user'])).toBeUndefined();
    expect(queryClient.getQueryData(['notifications-panel'])).toBeUndefined();
    expect(screen.getByText('nobody')).toBeTruthy();
  });
});

describe('bootstrap with a corrupted stored user (TT-135)', () => {
  beforeEach(() => {
    localStorage.clear();
    queryClient.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  // TT-069 changed how a session is restored: there is no token in localStorage any
  // more, and the provider asks the server who is signed in using the httpOnly cookie.
  // The cached user object survives only so the shell can render without a flash. These
  // tests were rewritten for that, deliberately — the property under test is unchanged:
  // a corrupt cache must not leave the app stuck on the loading spinner.
  const mockMe = (status: number, body: unknown) => vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify(body),
    blob: async () => new Blob(),
  })));

  it('recovers to a signed-out state instead of hanging on the spinner', async () => {
    // A truncated write used to throw before setIsLoading(false).
    localStorage.setItem('user', '{"id":"user-1","name":"Ali');
    mockMe(401, { error: 'No auth token provided' });

    render(<AuthProvider><Harness /></AuthProvider>);

    await waitFor(() => expect(screen.getByText('nobody')).toBeTruthy());
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('restores the session the server reports, not one read from storage', async () => {
    // The cached copy is deliberately stale: the server's answer must win.
    localStorage.setItem('user', JSON.stringify({ ...alice, name: 'Stale Name' }));
    mockMe(200, { user: alice });

    render(<AuthProvider><Harness /></AuthProvider>);

    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());
  });

  it('signs out when the cookie no longer identifies anyone', async () => {
    localStorage.setItem('user', JSON.stringify(alice));
    mockMe(401, { error: 'Invalid or expired token' });

    render(<AuthProvider><Harness /></AuthProvider>);

    await waitFor(() => expect(screen.getByText('nobody')).toBeTruthy());
  });
});
