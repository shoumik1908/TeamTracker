import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';

const AdminCredentialsPage = React.lazy(() => import('./pages/AdminCredentialsPage'));
const TeamMemberDashboard = React.lazy(() => import('./pages/TeamMemberDashboard'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const MembersPage = React.lazy(() => import('./pages/MembersPage'));
const MemberProfilePage = React.lazy(() => import('./pages/MemberProfilePage'));
const CertificationsPage = React.lazy(() => import('./pages/CertificationsPage'));
const TrackerPage = React.lazy(() => import('./pages/TrackerPage'));
const ProjectsPage = React.lazy(() => import('./pages/ProjectsPage'));
const ProjectUpdatesPage = React.lazy(() => import('./pages/ProjectUpdatesPage'));
const DeadlinesPage = React.lazy(() => import('./pages/DeadlinesPage'));
const NotificationsPage = React.lazy(() => import('./pages/NotificationsPage'));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'));
const PreSalesPage = React.lazy(() => import('./pages/PreSalesPage'));
const PreSalesDetailPage = React.lazy(() => import('./pages/PreSalesDetailPage'));
const GtmTrackerPage = React.lazy(() => import('./pages/GtmTrackerPage'));
const ProjectDetailPage = React.lazy(() => import('./pages/ProjectDetailPage'));
const FilesPage = React.lazy(() => import('./pages/FilesPage'));
const LogsPage = React.lazy(() => import('./pages/LogsPage'));
const TasksPage = React.lazy(() => import('./pages/tasks/TasksPage'));
const ChangePasswordPage = React.lazy(() => import('./pages/ChangePasswordPage'));

function DashboardRouter() {
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission('manageTeam');
  return isAdmin ? <DashboardPage /> : <TeamMemberDashboard />;
}

import ParticleBackground from './components/layout/ParticleBackground';

export default function App() {
  return (
    <AuthProvider>
      <ParticleBackground />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<DashboardRouter />} />
              <Route path="admin/credentials" element={<Suspense fallback={<div>Loading...</div>}><AdminCredentialsPage /></Suspense>} />
              <Route path="members" element={<Suspense fallback={<div>Loading...</div>}><MembersPage /></Suspense>} />
              <Route path="members/:id" element={<Suspense fallback={<div>Loading...</div>}><MemberProfilePage /></Suspense>} />
              <Route path="certifications" element={<Suspense fallback={<div>Loading...</div>}><CertificationsPage /></Suspense>} />
              <Route path="tracker" element={<Suspense fallback={<div>Loading...</div>}><TrackerPage /></Suspense>} />
              <Route path="projects" element={<Suspense fallback={<div>Loading...</div>}><ProjectsPage /></Suspense>} />
              <Route path="projects/:projectId" element={<Suspense fallback={<div>Loading...</div>}><ProjectDetailPage /></Suspense>} />
              <Route path="project-updates" element={<Suspense fallback={<div>Loading...</div>}><ProjectUpdatesPage /></Suspense>} />
              <Route path="deadlines" element={<Suspense fallback={<div>Loading...</div>}><DeadlinesPage /></Suspense>} />
              <Route path="notifications" element={<Suspense fallback={<div>Loading...</div>}><NotificationsPage /></Suspense>} />
              <Route path="reports" element={<Suspense fallback={<div>Loading...</div>}><ReportsPage /></Suspense>} />
              <Route path="presales" element={<Suspense fallback={<div>Loading...</div>}><PreSalesPage /></Suspense>} />
              <Route path="presales/:id" element={<Suspense fallback={<div>Loading...</div>}><PreSalesDetailPage /></Suspense>} />
              <Route path="gtm" element={<Suspense fallback={<div>Loading...</div>}><GtmTrackerPage /></Suspense>} />
              <Route path="files" element={<Suspense fallback={<div>Loading...</div>}><FilesPage /></Suspense>} />
              <Route path="logs" element={<Suspense fallback={<div>Loading...</div>}><LogsPage /></Suspense>} />
              <Route path="tasks" element={<Suspense fallback={<div>Loading...</div>}><TasksPage /></Suspense>} />
              <Route path="change-password" element={<Suspense fallback={<div>Loading...</div>}><ChangePasswordPage /></Suspense>} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
