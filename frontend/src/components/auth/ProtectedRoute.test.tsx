import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProtectedRoute from './ProtectedRoute';

const state: { user: any; isLoading: boolean } = { user: null, isLoading: false };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => state }));

const member = { id: 'u1', name: 'Asha', mustChangePassword: false };

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>login</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<p>dashboard</p>} />
          <Route path="/change-password" element={<p>change password</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  afterEach(() => { cleanup(); state.user = null; state.isLoading = false; });

  it('sends a signed-out visitor to the login page', () => {
    renderAt('/');
    expect(screen.getByText('login')).toBeInTheDocument();
  });

  it('renders the app for a signed-in user', () => {
    state.user = member;
    renderAt('/');
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('forces a password change by redirecting, not by an overlay that can be dismissed', () => {
    // Previously the app rendered underneath a modal carrying a "skip" button.
    state.user = { ...member, mustChangePassword: true };
    renderAt('/');
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('change password')).toBeInTheDocument();
  });

  it('does not redirect the change-password page onto itself', () => {
    state.user = { ...member, mustChangePassword: true };
    renderAt('/change-password');
    expect(screen.getByText('change password')).toBeInTheDocument();
  });

  it('shows a spinner while the session is still loading', () => {
    state.isLoading = true;
    const { container } = renderAt('/');
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });
});
