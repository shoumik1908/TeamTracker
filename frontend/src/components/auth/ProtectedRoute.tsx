import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ChangePasswordModal from './ChangePasswordModal';

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const [skipped, setSkipped] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user must change password and hasn't skipped, show the modal blocking the rest of the app
  return (
    <>
      <Outlet />
      {user.mustChangePassword && !skipped && (
        <ChangePasswordModal forced onSkip={() => setSkipped(true)} />
      )}
    </>
  );
}
