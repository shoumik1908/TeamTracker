import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="members/:id" element={<MemberProfilePage />} />
          <Route path="certifications" element={<CertificationsPage />} />
          <Route path="tracker" element={<TrackerPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="project-updates" element={<ProjectUpdatesPage />} />
          <Route path="deadlines" element={<DeadlinesPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="presales" element={<PreSalesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

