import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/lib/api';
import type { DashboardStats, Notification } from '@/types';
import { formatRelative, formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.stats().then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: recentActivities } = useQuery<Notification[]>({
    queryKey: ['recent-activities'],
    queryFn: () => dashboardApi.recentActivities().then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: upcomingData } = useQuery({
    queryKey: ['upcoming-deadlines-widget'],
    queryFn: () => dashboardApi.upcomingDeadlines().then(r => r.data),
    refetchInterval: 30000,
  });

  const notifTypeIcon: Record<string, string> = {
    CERTIFICATION_ASSIGNED: '📋', DEADLINE_APPROACHING: '⏰',
    CERTIFICATE_UPLOADED: '📄', CERTIFICATION_COMPLETED: '🎉',
    PROJECT_UPDATED: '🚀', PROJECT_ASSIGNED: '👥',
  };

  const firstName = user?.name?.split(' ')[0] || 'Admin';

  if (statsLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading admin dashboard...</div>;
  }

  return (
    <div className="app-dashboard">
      <div className="app-page">
        
        {/* Welcome Row */}
        <div className="welcome-row animate-fade-in" style={{ animationDelay: '0ms' }}>
          <div className="welcome">
            <h1>Welcome back, {firstName} ⚡</h1>
            <div className="meta">
              <span>Admin Overview</span>
              <span className="sep">•</span>
              <span>All systems operational</span>
            </div>
          </div>
          <div className="quick-actions">
            <button className="qa-btn" onClick={() => navigate('/members?action=new')}>
              <span className="plus">+</span> Add Member
            </button>
            <button className="qa-btn" onClick={() => navigate('/projects?action=new')}>
              <span className="plus">+</span> New Project
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="kpi-strip animate-fade-in" style={{ animationDelay: '50ms', gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <div className="kpi cursor-pointer" onClick={() => navigate('/members')}>
            <div className="label">Total Members</div>
            <div className="value">{stats?.totalMembers || 0}</div>
            <div className="sub">Active profiles</div>
          </div>
          <div className="kpi cursor-pointer" onClick={() => navigate('/projects')}>
            <div className="label">Active Projects</div>
            <div className="value">{stats?.activeProjects || 0}</div>
            <div className="sub">In progress</div>
          </div>
          <div className="kpi cursor-pointer" onClick={() => navigate('/projects')}>
            <div className="label">Completed Projects</div>
            <div className="value">{stats?.completedProjects || 0}</div>
            <div className="sub">Delivered</div>
          </div>
          <div className="kpi cursor-pointer" onClick={() => navigate('/tracker')}>
            <div className="label">Team Certs</div>
            <div className="value">{stats?.completedCertifications || 0}</div>
            <div className="sub">Total completed</div>
          </div>
          <div className="kpi cursor-pointer" onClick={() => navigate('/deadlines')}>
            <div className="label">Deadlines</div>
            <div className="value" style={{ color: 'var(--amber)' }}>{stats?.upcomingDeadlines || 0}</div>
            <div className="sub">Next 7 days</div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid-main animate-fade-in" style={{ animationDelay: '100ms', gridTemplateColumns: '1fr 1fr' }}>
          
          {/* Upcoming Deadlines */}
          <div className="card flex flex-col h-[400px]">
            <div className="card-head flex-shrink-0">
              <h2>Upcoming Deadlines</h2>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/deadlines'); }}>View all</a>
            </div>
            {upcomingData?.certifications?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No upcoming deadlines.</p>
            ) : (
              <div className="flex flex-col overflow-y-auto pr-2 -mr-2">
                {upcomingData?.certifications?.map((item: any) => (
                  <div key={item.id} className="cert-item">
                    <div className="w-8 h-8 rounded-full bg-brand-tint flex items-center justify-center text-brand font-bold flex-shrink-0">
                      {item.member?.name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="cert-name truncate">{item.certification?.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.member?.name}</div>
                    </div>
                    <div className="cert-sub text-right">
                      <div className="font-semibold" style={{ color: 'var(--amber)' }}>{formatDate(item.deadline)}</div>
                      <div className="text-[10px]" style={{ color: 'var(--brand)' }}>{item.progress}% done</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activities */}
          <div className="card flex flex-col h-[400px]">
            <div className="card-head flex-shrink-0">
              <h2>Recent Activities</h2>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/notifications'); }}>View all</a>
            </div>
            {recentActivities?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No recent activity yet.</p>
            ) : (
              <div className="flex flex-col overflow-y-auto pr-2 -mr-2">
                {recentActivities?.map(activity => (
                  <div key={activity.id} className="notif">
                    <div className="bell">{notifTypeIcon[activity.type] || '📢'}</div>
                    <div className="flex-1">
                      <div className="font-medium text-[13.5px] leading-tight text-ink">{activity.title}</div>
                      <div className="text-xs text-ink-soft mt-0.5 leading-snug">{activity.message}</div>
                      <span className="when">{formatRelative(activity.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
