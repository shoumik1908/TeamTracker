import React, { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { membersApi, notificationsApi } from '../lib/api';
import { filesApi } from '../lib/filesApi';
import { format, formatDistanceToNow, isValid } from 'date-fns';

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
  
  // 1. Fetch Member Profile
  const { data: memberRes, isLoading: memberLoading } = useQuery({
    queryKey: ['members', user?.teamMemberId],
    queryFn: () => membersApi.get(user?.teamMemberId as string),
    enabled: !!user?.teamMemberId
  });
  const member = memberRes?.data;

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
  
  // Calculate recent files
  const recentFiles = useMemo(() => {
    if (!filesRes?.data?.flat) return [];
    return filesRes.data.flat.slice(0, 4);
  }, [filesRes]);

  // Fallbacks if no data
  const firstName = user?.name?.split(' ')[0] || 'Team Member';
  const designation = member?.designation || 'Team Member';
  const allocatedProject = member?.currentProjectName || 'Bench';
  
  // KPI Stats
  const activeProjectsCount = member?.activeProjectsCount || 0;
  const activeCertsCount = (member?.stats?.completedCertifications || 0) + (member?.stats?.inProgressCertifications || 0);

  // Parse Action Items (Tasks)
  const tasks = (member?.meetingActionItems || []).map((item: any) => ({
    id: item.id,
    title: item.task,
    status: item.completed || item.status === 'completed' ? 'done' : 'open'
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
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading dashboard...</div>;
  }

  return (
    <div className="app-dashboard">
      <div className="app-page">
        
        {/* Welcome Row */}
        <div className="welcome-row animate-fade-in" style={{ animationDelay: '0ms' }}>
          <div className="welcome">
            <h1>Good afternoon, {firstName} 👋</h1>
            <div className="meta">
              <span><b>{designation}</b></span>
              <span className="sep">·</span>
              <span>Allocated to <b>{allocatedProject}</b></span>
              <span className="sep">·</span>
              <span>Last login <b>Today</b></span>
            </div>
          </div>
          <div className="quick-actions">
            <button className="qa-btn"><span className="plus">+</span> Upload CV</button>
            <button className="qa-btn"><span className="plus">+</span> Update status</button>
            <button className="qa-btn"><span className="plus">+</span> Request leave</button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="kpi-strip animate-fade-in" style={{ animationDelay: '50ms' }}>
          <div className="kpi">
            <div className="label">Assigned projects</div>
            <div className="value">{activeProjectsCount}</div>
            <div className="sub mono">Active assignments</div>
          </div>
          <div className="kpi">
            <div className="label">Active certifications</div>
            <div className="value">{activeCertsCount}</div>
            <div className="sub mono">In progress & completed</div>
          </div>
          <div className="kpi">
            <div className="label">Tasks due this week</div>
            <div className="value">{tasks.filter((t: any) => t.status === 'open').length}</div>
            <div className="sub mono">0 overdue</div>
          </div>
          <div className="kpi">
            <div className="label">Pending actions</div>
            <div className="value">2</div>
            <div className="sub mono">Needs attention</div>
          </div>
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
              <p className="text-sm text-muted-foreground py-4">No active projects assigned.</p>
            ) : (
              member.projectMembers.map((pm: any) => {
                const isProject = !!pm.project;
                const name = pm.project?.name || pm.opportunity?.name || 'Unknown Project';
                const role = pm.role || designation;
                
                // Mock progress and status for visual fidelity
                const pct = Math.floor(Math.random() * 40) + 40; 
                const isAtRisk = pct < 60;
                
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
              <p className="text-sm text-muted-foreground py-4">No certifications tracking.</p>
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
              <h2>Today's Tasks</h2>
              <a href="#">Add task</a>
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No tasks pending.</p>
            ) : (
              tasks.slice(0, 5).map((t: any) => (
                <div className={`task ${t.status}`} key={t.id}>
                  <span className="mark">{t.status === 'done' ? '✓' : ''}</span>
                  <span className="label truncate">{t.title}</span>
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
              <p className="text-sm text-muted-foreground py-4">No recent notifications.</p>
            ) : (
              notifications.map((n: any) => (
                <div className="notif" key={n.id}>
                  <span className="bell">🔔</span>
                  <div>
                    {n.title}
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
              <p className="text-sm text-muted-foreground py-4">No upcoming deadlines.</p>
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
              <p className="text-sm text-muted-foreground py-4">No files uploaded recently.</p>
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
            <div className="card-head"><h2>My utilization</h2></div>
            <div className="util-bar">
              <div className="fill" style={{ width: activeProjectsCount > 0 ? '100%' : '0%' }}></div>
            </div>
            <div className="util-labels">
              <span>Allocated <b>{activeProjectsCount > 0 ? '100%' : '0%'}</b></span>
              <span>Available <b>{activeProjectsCount > 0 ? '0%' : '100%'}</b></span>
            </div>
          </div>

        </div>

      </div>
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
