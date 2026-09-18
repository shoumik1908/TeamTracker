import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Route guard for pages that are admin-only.
 *
 * Hiding a link in the sidebar is not a guard: /admin/credentials and /logs were
 * reachable by typing the URL, which loaded the full access-management UI for any
 * authenticated user (audit TT-121). The API refuses the underlying calls, so this
 * was a disclosure of the interface rather than of data — but the page has role
 * dropdowns and activate/deactivate controls, and offering them to someone who
 * cannot use them is its own problem.
 */
export default function RequirePermission({ permission }: { permission: string }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
