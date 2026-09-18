import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 dark:bg-gray-900">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // TT-130: this used to render the app with a modal over it and a "skip" button,
  // so a forced password change could be dismissed — or simply scrolled past, since
  // the routes underneath were live either way. Now it is a redirect, and the only
  // page reachable until the password changes is the one that changes it.
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
