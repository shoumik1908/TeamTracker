import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { membersApi, notificationsApi, tasksApi } from '../lib/api';
import { DashboardGreeting } from '../components/DashboardGreeting';
import { filesApi } from '../lib/filesApi';
import { format, formatDistanceToNow } from 'date-fns';
import { TaskFormDialog } from './tasks/TaskFormDialog';
import { useAssignableMembers, useUpdateTask } from '../api/tasksQueries';
import { toast } from 'sonner';
import { TaskRow } from '../types/tasks';

class ErrorBoundary extends React.Component<any, { hasError: boolean, error: any }> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return <div style={{ color: 'red', padding: '2rem', background: 'black', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
        <h1>Dashboard Crash!</h1>
        <pre>{this.state.error?.toString()}</pre>
        <pre>{this.state.error?.stack}</pre>
      </div>;
    }
    return this.props.children;
  }
}

function TeamMemberDashboardContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingAllocation, setEditingAllocation] = useState(false);
  const [tempAllocation, setTempAllocation] = useState(100);
  
  const notifTypeIcon: Record<string, string> = {
    CERTIFICATION_ASSIGNED: '📋', DEADLINE_APPROACHING: '⏰',
    CERTIFICATE_UPLOADED: '📄', CERTIFICATION_COMPLETED: '🎉',
    PROJECT_UPDATED: '🚀', PROJECT_ASSIGNED: '👥',
    NEW_MEMBER_REGISTERED: '👋', CERTIFICATE_EDIT_REQUESTED: '✏️',
  };
  
  // 1. Fetch Member Profile
  const { data: memberRes, isLoading: memberLoading } = useQuery({
    queryKey: ['members', user?.teamMemberId],
    queryFn: () => membersApi.get(user?.teamMemberId as string),
    enabled: !!user?.teamMemberId
  });
  const member = memberRes?.data;
  
  const [modalTask, setModalTask] = useState<TaskRow | null | undefined>(undefined);
  const { data: assignableMembers } = useAssignableMembers();
  const updateTask = useUpdateTask();

  // 2. Fetch Notifications
  const { data: notifRes } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ limit: '5' }),
  });
  const notifications = notifRes?.data?.notifications || [];

  // 3. Fetch Recent Files
  const { data: filesRes } = useQuery({
    queryKey: ['files'],
    queryFn: () => filesApi.getFiles(),
  });

  const { data: tasksRes } = useQuery({
    queryKey: ['dashboard-tasks'],
    queryFn: () => tasksApi.list({}).then(r => r.data),
  });
  
  // Calculate recent files
  const recentFiles = useMemo(() => {
    if (!filesRes?.data?.flat) return [];
    return filesRes.data.flat.slice(0, 4);
  }, [filesRes]);

  // Fallbacks if no data
  const firstName = user?.name?.split(' ')[0] || 'Team Member';
  const designation = member?.designation || 'Team Member';
  const allocatedProject = member?.currentProjectName || 'Bench';
  
  const updateMember = useMutation({
    mutationFn: (data: { allocationPercentage: number }) => membersApi.update(user?.teamMemberId as string, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', user?.teamMemberId] });
      setEditingAllocation(false);
      toast.success('Allocation percentage updated!');
    },
    onError: (err: any) => {
      toast.error('Failed to update allocation: ' + (err.response?.data?.error || err.message));
    }
  });
  
  // KPI Stats
  const activeProjectsCount = member?.activeProjectsCount || 0;
  const activeCertsCount = (member?.stats?.completedCertifications || 0) + (member?.stats?.inProgressCertifications || 0);

  // Parse Action Items (Tasks)
  const tasks = [...(tasksRes || [])]
    .filter((task: any) => {
      if (task.status === 'DONE') {
        const completed = task.completedAt || task.updatedAt;
        if (!completed) return false;
        const diffMs = new Date().getTime() - new Date(completed).getTime();
        return diffMs < 2 * 60 * 1000;
      }
      return true;
    })
    .sort((a: any, b: any) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, 5)
    .map((task: any) => ({
      ...task,
      status: task.status === 'DONE' ? 'done' : 'open',
    }));

  // Parse Upcoming Events from Certifications and Projects
  const upcomingEvents = useMemo(() => {
    const events: any[] = [];
    if (member?.assignedCertifications) {
      member.assignedCertifications.forEach((c: any) => {
        if (c.status !== 'COMPLETED' && c.deadline) {
          events.push({ id: `cert-${c.id}`, date: new Date(c.deadline), label: `${c.certification?.name} deadline` });
        }
      });
    }
    if (member?.projectMembers) {
      member.projectMembers.forEach((pm: any) => {
        const p = pm.project || pm.opportunity;
        if (p?.endDate) {
          events.push({ id: `proj-${pm.id}`, date: new Date(p.endDate), label: `${p.name} deadline` });
        }
      });
    }
    return events.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 3);
  }, [member]);

  // Generate AI Suggestions dynamically
  const aiSuggestions = useMemo(() => {
    const suggestions: string[] = [];
    
    // CV Check
    if (!member?.cvUploadedAt) {
      suggestions.push("You haven't uploaded a CV yet. Consider uploading one to help with project allocations.");
    } else {
      const cvAgeDays = (new Date().getTime() - new Date(member.cvUploadedAt).getTime()) / (1000 * 3600 * 24);
      if (cvAgeDays > 180) {
        suggestions.push("Your CV hasn't been updated in over 6 months — consider a refresh if you've gained new skills.");
      }
    }
    
    // Task check
    const openTasks = tasks.filter((t: any) => t.status === 'open').length;
    if (openTasks > 0) {
      suggestions.push(`You have ${openTasks} open action items on your plate.`);
    }

    // Cert check
    const overdueCerts = member?.stats?.overdueCertifications || 0;
    if (overdueCerts > 0) {
      suggestions.push(`You have ${overdueCerts} overdue certification(s). Please prioritize completing them.`);
    }

    // Progress check
    const inProgress = member?.stats?.inProgressCertifications || 0;
    if (inProgress > 0 && overdueCerts === 0) {
      suggestions.push("You are making steady progress on your active certifications. Keep going!");
    }

    if (suggestions.length === 0) {
      suggestions.push("You're all caught up! Great job staying on top of your assignments and certifications.");
    }
    return suggestions;
  }, [member, tasks]);

  if (memberLoading) {
    return <div className="p-8 text-center text-white/50 animate-pulse">Loading dashboard...</div>;
  }

  return (
    <div className="app-dashboard">
      <div className="app-page">
        
        {/* Welcome Row */}
        <div className="welcome-row animate-fade-in" style={{ animationDelay: '0ms' }}>
          <div className="welcome">
            <DashboardGreeting name={firstName} />
            <div className="meta">
              <span><b>{designation}</b></span>
              <span className="sep">·</span>
              <span>Allocated to <b>{allocatedProject}</b></span>
              <span className="sep">·</span>
              <span>Last login <b>Today</b></span>
            </div>
          </div>
          <div className="quick-actions">
            <button className="qa-btn" onClick={() => navigate(`/members/${user?.teamMemberId}`)}>
              <span className="plus">+</span> Upload CV
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="kpi-strip animate-fade-in" style={{ animationDelay: '50ms', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <Link to="/projects" className="kpi">
            <div className="label">Assigned projects</div>
            <div className="value">{activeProjectsCount}</div>
            <div className="sub mono">Active assignments</div>
          </Link>
          <Link to="/certifications" className="kpi">
            <div className="label">Active certifications</div>
            <div className="value">{activeCertsCount}</div>
            <div className="sub mono">In progress & completed</div>
          </Link>
          <Link to="/tasks" className="kpi">
            <div className="label">Tasks due this week</div>
            <div className="value">{tasks.filter((t: any) => t.status === 'open').length}</div>
            <div className="sub mono">0 overdue</div>
          </Link>
        </div>

        {/* Main Grid */}
        <div className="grid-main animate-fade-in" style={{ animationDelay: '100ms' }}>
          
          {/* My Projects */}
          <div className="card">
            <div className="card-head">
              <h2>My Projects</h2>
              <a href="/projects">View all →</a>
            </div>
            {(!member?.projectMembers || member.projectMembers.length === 0) ? (
              <p className="text-sm text-white/50 py-4">No active projects assigned.</p>
            ) : (
              member.projectMembers.map((pm: any) => {
                const isProject = !!pm.project;
                const name = pm.project?.name || pm.opportunity?.name || 'Unknown Project';
                const role = pm.role || designation;
                
                // Mock progress and status for visual fidelity
                const pct = pm.project?.progress || pm.opportunity?.progressPercent || 0; 
                const isAtRisk = pct < 60 && pm.project?.status !== 'COMPLETED';
                
                return (
                  <div className="project-item" key={pm.id}>
                    <div className="project-top">
                      <span className="project-name">{name}</span>
                      <span className={`status-pill ${isAtRisk ? 'at-risk' : 'on-track'}`}>
                        <span className="dot"></span>{isAtRisk ? 'At risk' : 'On track'}
                      </span>
                    </div>
                    <div className="project-role">{role}</div>
                    <div className="route">
                      <div className="track"></div>
                      <div className="track-fill" style={{ width: `${pct}%`, background: isAtRisk ? 'var(--amber)' : '' }}></div>
                      <div className="milestone" style={{ left: '30%' }}></div>
                      <div className="milestone" style={{ left: '70%' }}></div>
                      <div className="pin" style={{ left: `${pct}%`, background: isAtRisk ? 'var(--amber)' : '', boxShadow: isAtRisk ? '0 0 0 1px var(--amber)' : '' }}></div>
                    </div>
                    <div className="project-foot">
                      <span>Assigned to {isProject ? 'Project' : 'PreSales'}</span>
                      <span className="pct">{pct}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Certifications */}
          <div className="card">
            <div className="card-head">
              <h2>My Certifications</h2>
              <a href="/certifications">Cert tracker →</a>
            </div>
            {(!member?.assignedCertifications || member.assignedCertifications.length === 0) ? (
              <p className="text-sm text-white/50 py-4">No certifications tracking.</p>
            ) : (
              member.assignedCertifications.slice(0,5).map((cert: any) => {
                let badgeClass = 'valid';
                let subText = 'Valid';
                let subClass = '';
                
                if (cert.status === 'COMPLETED') {
                  badgeClass = 'valid'; subText = 'Completed';
                } else if (cert.status === 'EXPIRED') {
                  badgeClass = 'expired'; subText = 'Expired'; subClass = 'expired';
                } else if (cert.status === 'IN_PROGRESS') {
                  badgeClass = 'progress'; subText = `${cert.progress}% done`;
                } else if (cert.status === 'OVERDUE') {
                  badgeClass = 'expiring'; subText = 'Overdue'; subClass = 'expiring';
                } else if (cert.status === 'NOT_STARTED') {
                  badgeClass = 'not-started'; subText = 'Not Started'; subClass = 'muted';
                }

                return (
                  <div className="cert-item" key={cert.id}>
                    <span className={`cert-badge ${badgeClass}`}></span>
                    <span className="cert-name truncate">{cert.certification?.name}</span>
                    <span className={`cert-sub mono ${subClass}`}>{subText}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Action Items */}
          <div className="card">
            <div className="card-head">
              <h2>Task List</h2>
              {user?.role?.permissions?.manageTeam || user?.role?.permissions?.['tasks:manage'] ? (
                <a href="/tasks?create=1" onClick={(e) => { e.preventDefault(); navigate('/tasks?create=1'); }}>Add task</a>
              ) : null}
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-white/50 py-4">No tasks pending.</p>
            ) : (
              tasks.slice(0, 5).map((t: any) => (
                <div 
                  className={`task ${t.status} hover:bg-neutral-800/50 transition-colors p-2 rounded`} 
                  key={t.id}
                >
                  <span 
                    className="mark cursor-pointer hover:bg-neutral-700/50" 
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTask.mutate({ id: t.id, input: { status: t.status === 'done' ? 'TODO' : 'DONE' } }, {
                        onSuccess: () => toast.success(`Task marked as ${t.status === 'done' ? 'To do' : 'Done'}`),
                        onError: () => toast.error("Couldn't update task")
                      });
                    }}
                  >
                    {t.status === 'done' ? '✓' : ''}
                  </span>
                  <span 
                    className="label truncate cursor-pointer flex-1" 
                    onClick={() => setModalTask(t)}
                  >
                    {t.title}
                  </span>
                </div>
              ))
            )}
          </div>

        </div>

        {/* Secondary Grid */}
        <div className="grid-secondary animate-fade-in" style={{ animationDelay: '150ms' }}>
          
          {/* Notifications */}
          <div className="card">
            <div className="card-head"><h2>Recent notifications</h2></div>
            {notifications.length === 0 ? (
              <p className="text-sm text-white/50 py-4">No recent notifications.</p>
            ) : (
              notifications.map((n: any) => (
                <div className="notif" key={n.id}>
                  <div className="bell">{notifTypeIcon[n.type] || '🔔'}</div>
                  <div className="flex-1">
                    <div className="font-medium text-[13.5px] leading-tight text-ink">{n.title}</div>
                    <div className="text-xs text-ink-soft mt-0.5 leading-snug">{n.message}</div>
                    <span className="when">{n.createdAt ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }) : ''}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Calendar */}
          <div className="card">
            <div className="card-head"><h2>Upcoming</h2></div>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-white/50 py-4">No upcoming deadlines.</p>
            ) : (
              upcomingEvents.map(ev => (
                <div className="cal-item" key={ev.id}>
                  <div className="cal-date">
                    <div className="d">{format(ev.date, 'd')}</div>
                    <div className="m">{format(ev.date, 'MMM')}</div>
                  </div>
                  <div className="cal-label">{ev.label}</div>
                </div>
              ))
            )}
          </div>

          {/* AI Suggestions */}
          <div className="card ai-card">
            <div className="card-head">
              <h2>AI suggestions</h2>
              <span className="tag">AUTO</span>
            </div>
            {aiSuggestions.map((sug, idx) => (
              <div className="ai-item" key={idx}>
                <span className="mark">▸</span>
                <span>{sug}</span>
              </div>
            ))}
          </div>

        </div>

        {/* Footer Grid */}
        <div className="grid-footer animate-fade-in" style={{ animationDelay: '200ms' }}>
          
          {/* Recent Files */}
          <div className="card">
            <div className="card-head"><h2>Recent files</h2></div>
            {recentFiles.length === 0 ? (
              <p className="text-sm text-white/50 py-4">No files uploaded recently.</p>
            ) : (
              recentFiles.map((f: any) => {
                const isPdf = f.fileName?.toLowerCase().endsWith('.pdf');
                return (
                  <div className="file-item" key={f.id}>
                    <span className="file-icon">{isPdf ? 'PDF' : 'DOC'}</span>
                    <span className="file-name truncate">{f.fileName || 'Document'}</span>
                    <span className="file-meta">{f.uploadDate ? formatDistanceToNow(new Date(f.uploadDate), { addSuffix: true }) : ''}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Utilization */}
          <div className="card">
            <div className="card-head flex items-center justify-between">
              <h2>My utilization</h2>
              {editingAllocation ? (
                <div className="flex gap-2">
                  <button 
                    onClick={() => updateMember.mutate({ allocationPercentage: tempAllocation })} 
                    disabled={updateMember.isPending}
                    className="text-xs bg-azure-500 text-white px-2 py-1 rounded hover:bg-azure-600 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => setEditingAllocation(false)}
                    className="text-xs bg-zinc-700 text-white px-2 py-1 rounded hover:bg-zinc-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => {
                    setTempAllocation(member?.allocationPercentage ?? (activeProjectsCount > 0 ? 100 : 0));
                    setEditingAllocation(true);
                  }}
                  className="text-[10px] uppercase font-bold text-azure-400 hover:text-azure-300"
                >
                  Edit
                </button>
              )}
            </div>
            
            {editingAllocation ? (
              <div className="py-4 space-y-2">
                <div className="flex justify-between text-xs text-white/50">
                  <span>0%</span>
                  <span className="font-bold text-azure-400">{tempAllocation}%</span>
                  <span>100%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" step="5"
                  value={tempAllocation}
                  onChange={e => setTempAllocation(parseInt(e.target.value))}
                  className="w-full accent-azure-500 cursor-pointer"
                />
              </div>
            ) : (
              <>
                <div className="util-bar mt-4">
                  <div className="fill" style={{ width: `${member?.allocationPercentage ?? (activeProjectsCount > 0 ? 100 : 0)}%` }}></div>
                </div>
                <div className="util-labels">
                  <span>Allocated <b>{member?.allocationPercentage ?? (activeProjectsCount > 0 ? 100 : 0)}%</b></span>
                  <span>Available <b>{100 - (member?.allocationPercentage ?? (activeProjectsCount > 0 ? 100 : 0))}%</b></span>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
      
      {modalTask !== undefined && (
        <TaskFormDialog
          initial={modalTask}
          members={assignableMembers || []}
          isAdmin={!!(user?.role?.permissions?.manageTeam || user?.role?.permissions?.['tasks:manage'])}
          onClose={() => setModalTask(undefined)}
          onSave={(taskData) => {
            const input = (user?.role?.permissions?.manageTeam || user?.role?.permissions?.['tasks:manage'])
              ? {
                  title: taskData.title.trim(),
                  description: taskData.description?.trim() || undefined,
                  assigneeId: taskData.assigneeId,
                  priority: taskData.priority,
                  dueDate: taskData.due || null,
                  status: taskData.status,
                }
              : { status: taskData.status };

            if (modalTask) {
              updateTask.mutate(
                { id: modalTask.id, input },
                {
                  onSuccess: () => {
                    toast.success("Task updated");
                    setModalTask(undefined);
                  },
                  onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't update task"),
                }
              );
            }
          }}
        />
      )}
    </div>
  );
}

export default function TeamMemberDashboard() {
  return (
    <ErrorBoundary>
      <TeamMemberDashboardContent />
    </ErrorBoundary>
  );
}
