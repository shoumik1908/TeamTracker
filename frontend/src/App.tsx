import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import AdminCredentialsPage from './pages/AdminCredentialsPage';
import TeamMemberDashboard from './pages/TeamMemberDashboard';
import DashboardPage from './pages/DashboardPage';
import MembersPage from './pages/MembersPage';
import MemberProfilePage from './pages/MemberProfilePage';
import CertificationsPage from './pages/CertificationsPage';
import TrackerPage from './pages/TrackerPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectUpdatesPage from './pages/ProjectUpdatesPage';
import DeadlinesPage from './pages/DeadlinesPage';
import NotificationsPage from './pages/NotificationsPage';
import ReportsPage from './pages/ReportsPage';
import PreSalesPage from './pages/PreSalesPage';
import PreSalesDetailPage from './pages/PreSalesDetailPage';
import GtmTrackerPage from './pages/GtmTrackerPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import FilesPage from './pages/FilesPage';
import LogsPage from './pages/LogsPage';

function DashboardRouter() {
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission('manageTeam');
  return isAdmin ? <DashboardPage /> : <TeamMemberDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<DashboardRouter />} />
              <Route path="admin/credentials" element={<AdminCredentialsPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="members/:id" element={<MemberProfilePage />} />
              <Route path="certifications" element={<CertificationsPage />} />
              <Route path="tracker" element={<TrackerPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:projectId" element={<ProjectDetailPage />} />
              <Route path="project-updates" element={<ProjectUpdatesPage />} />
              <Route path="deadlines" element={<DeadlinesPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="presales" element={<PreSalesPage />} />
              <Route path="presales/:opportunityId" element={<PreSalesDetailPage />} />
              <Route path="gtm" element={<GtmTrackerPage />} />
              <Route path="files" element={<FilesPage />} />
              <Route path="logs" element={<LogsPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
