import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type User, useAuth } from './AuthContext';
import { SESSION_EXPIRED_EVENT, getSessionToken } from '../lib/api';

// TT-069: the token moved out of localStorage into memory, with an httpOnly cookie
// carrying the session across reloads. These assertions are the same; they just read
// the session from where it now lives.

const user: User = {
  id: 'user-1',
  name: 'Asha',
  email: 'asha@example.com',
  mustChangePassword: false,
  teamMemberId: 'member-1',
  role: {
    id: 'role-1',
    name: 'Team Member',
    permissions: { read: true, write: true, delete: false, manageTeam: false },
  },
};

function SessionHarness() {
  const { user: currentUser, login } = useAuth();
  return (
    <>
      <button onClick={() => login('test-token', user)}>Sign in</button>
      <span>{currentUser ? 'signed-in' : 'signed-out'}</span>
    </>
  );
}

describe('AuthProvider inactivity timeout', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:00:00Z'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('signs out after 12 minutes without activity', () => {
    render(<AuthProvider><SessionHarness /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('signed-in')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(12 * 60 * 1000));

    expect(screen.getByText('signed-out')).toBeInTheDocument();
    expect(getSessionToken()).toBeNull();
  });

  it('resets the 12-minute timeout when the user interacts with the app', () => {
    render(<AuthProvider><SessionHarness /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    act(() => vi.advanceTimersByTime(11 * 60 * 1000));
    act(() => window.dispatchEvent(new Event('pointerdown')));
    act(() => vi.advanceTimersByTime(11 * 60 * 1000));
    expect(screen.getByText('signed-in')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(60 * 1000));
    expect(screen.getByText('signed-out')).toBeInTheDocument();
  });
});

describe('AuthProvider session-expiry handling', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('signs out when the api client reports an expired session', () => {
    render(<AuthProvider><SessionHarness /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('signed-in')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    });

    expect(screen.getByText('signed-out')).toBeInTheDocument();
    expect(getSessionToken()).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('ignores a failure belonging to a session the user already replaced', () => {
    render(<AuthProvider><SessionHarness /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    act(() => {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { token: 'a-previous-token' } }));
    });

    expect(screen.getByText('signed-in')).toBeInTheDocument();
    expect(getSessionToken()).toBe('test-token');
  });

  it('ignores the event when nobody is signed in', () => {
    render(<AuthProvider><SessionHarness /></AuthProvider>);
    expect(screen.getByText('signed-out')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    });

    expect(screen.getByText('signed-out')).toBeInTheDocument();
  });
});
