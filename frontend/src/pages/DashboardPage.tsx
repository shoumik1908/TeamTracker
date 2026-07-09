import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/lib/api';
import {
  Users, FolderKanban, CheckCircle, Calendar
} from 'lucide-react';
import type { DashboardStats, Notification } from '@/types';
import { cn, formatRelative, formatDate } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  subtitle?: string;
  to?: string;
}

function KPICard({ title, value, icon: Icon, color, bgColor, subtitle, to }: KPICardProps) {
  const navigate = useNavigate();
  return (
    <div
      onClick={to ? () => navigate(to) : undefined}
      role={to ? 'button' : undefined}
      tabIndex={to ? 0 : undefined}
      onKeyDown={to ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(to); } } : undefined}
      className={cn(
        'bg-card rounded-xl border border-border p-5 hover-card animate-fade-in',
        to && 'cursor-pointer hover:border-azure-500/50 focus:outline-none focus:ring-2 focus:ring-azure-500/40 transition-colors'
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className={cn('text-3xl font-bold mt-1.5', color)}>{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', bgColor)}>
          <Icon className={cn('w-5 h-5', color)} />
        </div>
      </div>
    </div>
  );
}



export default function DashboardPage() {
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

  const kpiCards = stats ? [
    { title: 'Total Team Members', value: stats.totalMembers, icon: Users, color: 'text-azure-400', bgColor: 'bg-azure-900/20', to: '/members' },
    { title: 'Active Projects', value: stats.activeProjects, icon: FolderKanban, color: 'text-purple-400', bgColor: 'bg-purple-900/20', to: '/projects' },
    { title: 'Completed Projects', value: stats.completedProjects, icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-900/20', to: '/projects' },
    { title: 'Total Team Certificates', value: stats.completedCertifications, icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-900/20', to: '/tracker' },
    { title: 'Upcoming Deadlines', value: stats.upcomingDeadlines, icon: Calendar, color: 'text-orange-400', bgColor: 'bg-orange-900/20', subtitle: 'Within 7 days', to: '/deadlines' },
  ] : [];

  const notifTypeIcon: Record<string, string> = {
    CERTIFICATION_ASSIGNED: '📋', DEADLINE_APPROACHING: '⏰',
    CERTIFICATE_UPLOADED: '📄', CERTIFICATION_COMPLETED: '🎉',
    PROJECT_UPDATED: '🚀', PROJECT_ASSIGNED: '👥',
  };

  if (statsLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-5 h-24 animate-pulse">
            <div className="h-3 bg-muted rounded w-1/2 mb-3" />
            <div className="h-8 bg-muted rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => (
          <KPICard key={i} {...card} />
        ))}
      </div>

      {/* Recent Activities - Full Width */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm mb-4">Recent Activities</h3>
        <div className="space-y-3">
          {recentActivities?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity yet</p>
          )}
          {recentActivities?.slice(0, 6).map(activity => (
            <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
              <span className="text-lg flex-shrink-0 mt-0.5">{notifTypeIcon[activity.type] || '📢'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{activity.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{activity.message}</p>
              </div>
              <p className="text-[10px] text-muted-foreground/60 flex-shrink-0 mt-1">{formatRelative(activity.createdAt)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Deadlines Widget */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm mb-4">Upcoming Certification Deadlines</h3>
        {upcomingData?.certifications?.length === 0 && (
          <p className="text-sm text-muted-foreground">No upcoming deadlines in the next 30 days.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {upcomingData?.certifications?.map((item: any) => (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/50">
              <div className="w-8 h-8 rounded-full bg-azure-900/40 flex items-center justify-center text-azure-300 text-xs font-bold flex-shrink-0">
                {item.member?.name?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{item.certification?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{item.member?.name}</p>
                <p className="text-xs text-orange-400 font-medium mt-0.5">{formatDate(item.deadline)}</p>
              </div>
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full border-2 border-azure-800/60 flex items-center justify-center">
                  <span className="text-xs font-bold text-azure-400">{item.progress}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
