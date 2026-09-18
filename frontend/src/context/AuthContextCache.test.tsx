import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

  afterEach(cleanup);

  it('recovers to a signed-out state instead of hanging on the spinner', () => {
    // A truncated write used to throw before setIsLoading(false), leaving the app on
    // ProtectedRoute's spinner forever with no in-app way to recover.
    localStorage.setItem('token', 'tok');
    localStorage.setItem('user', '{"id":"user-1","name":"Ali');

    render(<AuthProvider><Harness /></AuthProvider>);

    expect(screen.getByText('nobody')).toBeTruthy();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('still restores a valid stored session', () => {
    localStorage.setItem('token', 'tok');
    localStorage.setItem('user', JSON.stringify(alice));

    render(<AuthProvider><Harness /></AuthProvider>);

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(localStorage.getItem('token')).toBe('tok');
  });
});
