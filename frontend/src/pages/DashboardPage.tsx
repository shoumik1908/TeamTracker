import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/lib/api';
import type { DashboardStats, Notification } from '@/types';
import { formatRelative, formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { DashboardGreeting } from '@/components/DashboardGreeting';
import { TaskFormDialog } from './tasks/TaskFormDialog';
import { useCreateTask, useAssignableMembers } from '@/api/tasksQueries';
import { toast } from 'sonner';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const { data: members } = useAssignableMembers();
  const createTask = useCreateTask();
  
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
    NEW_MEMBER_REGISTERED: '👋', CERTIFICATE_EDIT_REQUESTED: '✏️',
    TASK_ASSIGNED: '📝',
  };

  const firstName = user?.name?.split(' ')[0] || 'Admin';

  if (statsLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading admin dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-transparent text-white p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_50%_50%,rgba(94,44,217,0.15)_0%,rgba(20,18,27,0)_70%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        
        {/* Welcome Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-[#211e28]/40 backdrop-blur-xl border border-white/5 rounded-2xl animate-fade-in-up shadow-xl">
          <div className="mb-4 md:mb-0">
            <DashboardGreeting name={firstName} />
            <div className="flex items-center gap-2 mt-1 text-sm text-[#bfadfe]">
              <span>Admin Overview</span>
              <span className="text-white/20">•</span>
              <span>All systems operational</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              className="px-4 py-2 bg-card/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-all"
              onClick={() => navigate('/members?action=new')}
            >
              + Add Member
            </button>
            <button 
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-all"
              onClick={() => navigate('/projects?action=new')}
            >
              + New Project
            </button>
            <button 
              className="px-4 py-2 bg-gradient-to-r from-[#5e2cd9] to-[#6738e2] hover:from-[#6738e2] hover:to-[#cdbdff] text-white rounded-lg text-sm font-medium transition-all hover:shadow-lg hover:shadow-[#5e2cd9]/20"
              onClick={() => setIsTaskModalOpen(true)}
            >
              + Assign Task
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          {[
            { label: 'Total Members', value: stats?.totalMembers, sub: 'Active profiles', nav: '/members', color: 'text-white' },
            { label: 'Active Projects', value: stats?.activeProjects, sub: 'In progress', nav: '/projects', color: 'text-[#cdbdff]' },
            { label: 'Completed Projects', value: stats?.completedProjects, sub: 'Delivered', nav: '/projects', color: 'text-white' },
            { label: 'Team Certs', value: stats?.completedCertifications, sub: 'Total completed', nav: '/tracker', color: 'text-[#cdbdff]' },
            { label: 'Deadlines', value: stats?.upcomingDeadlines, sub: 'Next 7 days', nav: '/deadlines', color: 'text-[#ffb4ab]' },
            { label: 'Pending Tasks', value: stats?.pendingTasks, sub: 'To do & In progress', nav: '/tasks', color: 'text-white' }
          ].map((kpi, i) => (
            <div 
              key={i}
              onClick={() => navigate(kpi.nav)}
              className="p-4 bg-[#211e28]/40 backdrop-blur-xl border border-white/5 rounded-2xl cursor-pointer hover:bg-[#2b2833]/60 hover:border-white/10 transition-all hover:-translate-y-1 group"
            >
              <div className="text-xs text-[#948ea1] mb-1 font-medium">{kpi.label}</div>
              <div className={`text-2xl font-bold ${kpi.color} group-hover:drop-shadow-md`}>{kpi.value || 0}</div>
              <div className="text-[10px] text-[#494455] mt-1">{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          
          {/* Upcoming Deadlines */}
          <div className="flex flex-col h-[400px] bg-[#211e28]/40 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-xl">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h2 className="text-lg font-bold text-white tracking-tight">Upcoming Deadlines</h2>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/deadlines'); }} className="text-xs text-[#cdbdff] hover:text-[#e7deff]">View all</a>
            </div>
            {upcomingData?.certifications?.length === 0 ? (
              <p className="text-sm text-[#948ea1] py-4">No upcoming deadlines.</p>
            ) : (
              <div className="flex flex-col overflow-y-auto space-y-2 pr-2 -mr-2">
                {upcomingData?.certifications?.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-[#1d1a24]/50 border border-white/5 rounded-xl hover:bg-white/5 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5e2cd9] to-[#6738e2] flex items-center justify-center text-white font-bold flex-shrink-0">
                      {item.member?.name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{item.certification?.name}</div>
                      <div className="text-xs text-[#bfadfe] truncate">{item.member?.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-[#ffb4ab]">{formatDate(item.deadline)}</div>
                      <div className="text-[10px] text-[#cdbdff]">{item.progress}% done</div>
                    </div>
                  </div>
                ))}
                
                {upcomingData?.tasks?.map((task: any) => (
                  <div key={task.id} className="flex items-center gap-3 p-3 bg-[#1d1a24]/50 border border-white/5 rounded-xl hover:bg-white/5 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-[#cdbdff] font-bold flex-shrink-0 border border-blue-500/20">
                      {task.assignee?.name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#cdbdff] truncate">{task.title}</div>
                      <div className="text-xs text-[#948ea1] truncate">{task.assignee?.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-[#cac3d8]">{task.dueDate ? formatDate(task.dueDate) : 'No due date'}</div>
                      <div className="text-[10px] text-[#948ea1]">{task.priority} Priority</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activities */}
          <div className="flex flex-col h-[400px] bg-[#211e28]/40 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-xl">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h2 className="text-lg font-bold text-white tracking-tight">Recent Activities</h2>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/notifications'); }} className="text-xs text-[#cdbdff] hover:text-[#e7deff]">View all</a>
            </div>
            {recentActivities?.length === 0 ? (
              <p className="text-sm text-[#948ea1] py-4">No recent activity yet.</p>
            ) : (
              <div className="flex flex-col overflow-y-auto space-y-3 pr-2 -mr-2">
                {recentActivities?.map(activity => (
                  <div key={activity.id} className="flex items-start gap-3 p-2 group">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[15px] flex-shrink-0 border border-white/5">
                      {notifTypeIcon[activity.type] || '📢'}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="text-sm font-medium text-white leading-tight truncate group-hover:whitespace-normal">{activity.title}</div>
                      <div className="text-xs text-[#948ea1] mt-1 leading-snug">
                        {user?.role?.permissions?.manageTeam && activity.member?.name 
                          ? <><span className="text-[#bfadfe]">{activity.member.name}</span>: {activity.message}</>
                          : activity.message}
                      </div>
                      <div className="text-[10px] text-[#494455] mt-1 uppercase tracking-wider">{formatRelative(activity.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {isTaskModalOpen && (
        <TaskFormDialog
          initial={null}
          members={members || []}
          isAdmin={true}
          onClose={() => setIsTaskModalOpen(false)}
          onSave={(taskData) => {
            createTask.mutate(
              {
                title: taskData.title.trim(),
                description: taskData.description?.trim() || undefined,
                assigneeId: taskData.assigneeId,
                priority: taskData.priority,
                dueDate: taskData.due || null,
              },
              {
                onSuccess: () => {
                  toast.success("Task assigned successfully");
                  setIsTaskModalOpen(false);
                },
                onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't assign task"),
              }
            );
          }}
        />
      )}
    </div>
  );
}
