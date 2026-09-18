import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RequirePermission from './RequirePermission';

const hasPermission = vi.fn();
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ hasPermission }) }));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>dashboard</p>} />
        <Route element={<RequirePermission permission="manageTeam" />}>
          <Route path="/admin/credentials" element={<p>access management</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequirePermission', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('renders the guarded page for a caller who holds the permission', () => {
    hasPermission.mockReturnValue(true);
    renderAt('/admin/credentials');
    expect(screen.getByText('access management')).toBeInTheDocument();
  });

  it('redirects away when the caller does not hold it', () => {
    // Typing the URL previously loaded the full access-management UI for anyone.
    hasPermission.mockReturnValue(false);
    renderAt('/admin/credentials');
    expect(screen.queryByText('access management')).not.toBeInTheDocument();
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('asks about the permission it was given', () => {
    hasPermission.mockReturnValue(true);
    renderAt('/admin/credentials');
    expect(hasPermission).toHaveBeenCalledWith('manageTeam');
  });
});
