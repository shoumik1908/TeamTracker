import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, membersApi } from '@/lib/api';
import { Plus, Search, Pencil, Trash2, Users, X, Loader2, Calendar, UserPlus, MoreVertical, Video, Play, FileText, Sparkles } from 'lucide-react';
import { cn, formatDate, formatStatus, getStatusColor, getPriorityColor, getProgressColor } from '@/lib/utils';
import type { Project, PaginatedResponse, TeamMember, TeamsMeeting } from '@/types';

const STATUSES = ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface ProjectFormData {
  name: string; description: string; client: string;
  startDate: string; endDate: string; priority: string; status: string; progress: string;
  managerId: string;
}
const INIT: ProjectFormData = { name: '', description: '', client: '', startDate: '', endDate: '', priority: 'MEDIUM', status: 'PLANNING', progress: '0', managerId: '' };

function ProjectMenu({ onEdit, onDelete }: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative flex justify-end" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 text-white/50 hover:text-foreground hover:bg-[#1c1926]/80 backdrop-blur-md/5 rounded-lg transition-colors"
        title="Options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-30 w-36 bg-popover border border-white/5 rounded-xl shadow-xl overflow-hidden animate-fade-in">
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors text-left"
          >
            <Pencil className="w-3.5 h-3.5 text-white/50" />
            Edit
          </button>
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-950/40 transition-colors text-left"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function ProjectModal({ project, onClose, onSave }: { project?: Project; onClose: () => void; onSave: (d: Record<string, unknown>) => void }) {
  const [form, setForm] = useState<ProjectFormData>(project ? {
    name: project.name, description: project.description || '', client: project.client || '',
    startDate: project.startDate.split('T')[0], endDate: project.endDate?.split('T')[0] || '',
    priority: project.priority, status: project.status, progress: String(project.progress),
    managerId: project.managerId || '',
  } : INIT);

  const { data: members } = useQuery<PaginatedResponse<TeamMember>>({
    queryKey: ['members-proj-form'], queryFn: () => membersApi.list({ limit: 100 }).then(r => r.data),
  });
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    project?.members?.map(pm => pm.memberId) || []
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/5">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="font-semibold text-lg">{project ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">Project Name *</label>
            <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30"
              placeholder="Azure Cloud Migration" />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30 resize-none"
              placeholder="Brief description..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Client</label>
              <input value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                placeholder="Acme Corp / Internal" />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30">
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Start Date *</label>
              <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">End Date</label>
              <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg bg-[#1c1926]/80 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-azure-500/30">
                {STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Progress ({form.progress}%)</label>
              <input type="range" min={0} max={100} value={form.progress}
                onChange={e => setForm(p => ({ ...p, progress: e.target.value }))} className="w-full accent-azure-500 mt-2" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">Project Manager</label>
            <select value={form.managerId} onChange={e => setForm(p => ({ ...p, managerId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg bg-[#1c1926]/80 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-azure-500/30">
              <option value="">No Manager Assigned</option>
              {members?.data.map(m => <option key={m.id} value={m.id}>{m.name} ({m.designation})</option>)}
            </select>
          </div>
          {!project && (
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">Assign Members</label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {members?.data.map(m => (
                  <button key={m.id} type="button"
                    onClick={() => setSelectedMembers(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                    className={cn('text-xs px-2.5 py-1 rounded-full border transition-colors',
                      selectedMembers.includes(m.id) ? 'bg-azure-500 text-white border-azure-500 shadow-lg shadow-azure-500/20' : 'border-white/5 hover:border-azure-500/50 bg-muted/10')}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-white/5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-white/5 rounded-lg hover:bg-muted bg-[#1c1926]/80 backdrop-blur-md">Cancel</button>
          <button onClick={() => { if (form.name && form.startDate) onSave({ ...form, progress: parseInt(form.progress), memberIds: selectedMembers, managerId: form.managerId || null }); }}
            className="flex-1 px-4 py-2 text-sm bg-azure-500 text-white rounded-lg hover:bg-azure-600">
            {project ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [, setPage] = useState(1);
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams.get('action') === 'new');
  const [editProject, setEditProject] = useState<Project | undefined>();
  const [manageTeamProject, setManageTeamProject] = useState<Project | undefined>();
  const [meetingsProject, setMeetingsProject] = useState<Project | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery<PaginatedResponse<Project>>({
    queryKey: ['projects', search, statusFilter],
    queryFn: () => projectsApi.list({ search, status: statusFilter || undefined, page: 1, limit: 1000 }).then(r => r.data),
  });

  const create = useMutation({ mutationFn: (d: Record<string, unknown>) => projectsApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); qc.invalidateQueries({ queryKey: ['project-progress-chart'] }); setShowForm(false); } });
  const update = useMutation({ mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) => projectsApi.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); qc.invalidateQueries({ queryKey: ['project-progress-chart'] }); setEditProject(undefined); } });
  const del = useMutation({ mutationFn: (id: string) => projectsApi.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); qc.invalidateQueries({ queryKey: ['project-progress-chart'] }); setDeleteId(null); } });

  const sortedProjects = data?.data ? [...data.data].sort((a, b) => {
    if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return 1;
    if (a.status !== 'COMPLETED' && b.status === 'COMPLETED') return -1;
    return 0;
  }) : [];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Projects</h2>
          <p className="page-subtitle">{data?.pagination.total || 0} total projects</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-azure-500 text-white text-sm font-medium rounded-xl hover:bg-azure-600 transition-colors shadow-lg shadow-azure-500/25">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5 p-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <input type="text" placeholder="Search projects…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-white/5 rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30 focus:border-azure-500" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30 bg-[#1c1926]/80 backdrop-blur-md">
          <option value="">All</option>
          {STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
        </select>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5 p-5 h-48 animate-pulse">
            <div className="h-5 bg-muted rounded w-2/3 mb-2" />
            <div className="h-3 bg-muted rounded w-1/3 mb-4" />
            <div className="h-12 bg-muted rounded mb-3" />
          </div>
        ))}
        {sortedProjects.map(project => (
          <div key={project.id} 
            onClick={() => navigate(`/projects/${project.id}`)}
            className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5 p-5 hover-card cursor-pointer hover:border-azure-500/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate group-hover:text-azure-400">{project.name}</h3>
                {project.client && <p className="text-xs text-white/50 mt-0.5">Client: {project.client}</p>}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  {project.manager && (
                    <p className="text-xs text-azure-400 font-semibold flex items-center gap-1">
                      👤 PM: {project.manager.name}
                    </p>
                  )}
                  {project.members?.find(pm => pm.role === 'TEAM_LEADER') && (
                    <p className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                      👑 Lead: {project.members.find(pm => pm.role === 'TEAM_LEADER')?.member.name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', getStatusColor(project.status))}>
                  {formatStatus(project.status)}
                </span>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', getPriorityColor(project.priority))}>
                  {project.priority}
                </span>
              </div>
            </div>

            {project.description && <p className="text-xs text-white/50 line-clamp-2 mb-3">{project.description}</p>}

            {/* Progress */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white/50">Progress</span>
                <span className="font-semibold">{project.progress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className={cn('h-2 rounded-full transition-all duration-700', getProgressColor(project.progress))}
                  style={{ width: `${project.progress}%` }} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Member avatars */}
                {project.members && project.members.length > 0 ? (
                  <div className="flex items-center">
                    <div className="flex -space-x-2">
                      {project.members.slice(0, 3).map(pm => (
                        <div key={pm.id} className="w-6 h-6 rounded-full bg-azure-500/10 border-2 border-card flex items-center justify-center text-[9px] text-azure-600 font-bold overflow-hidden">
                          {pm.member.profilePictureUrl
                            ? <img src={pm.member.profilePictureUrl} alt="" className="w-full h-full object-cover" />
                            : pm.member.name[0]}
                        </div>
                      ))}
                    </div>
                    {project.members.length > 3 && (
                      <span className="text-xs text-white/50 ml-1">+{project.members.length - 3}</span>
                    )}
                    <span className="text-xs text-white/50 ml-1.5 flex items-center gap-1">
                      <Users className="w-3 h-3 text-azure-500" />{project.members.length}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-white/50 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Assign Team
                  </span>
                )}
                {project.endDate && (
                  <span className="text-xs text-white/50 flex items-center gap-1 ml-3">
                    <Calendar className="w-3 h-3" />{formatDate(project.endDate)}
                  </span>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); setMeetingsProject(project); }} 
                  className="px-2.5 py-1 text-[11px] font-medium bg-azure-900/30 text-azure-400 border border-azure-800/40 rounded-lg hover:bg-azure-800/50 transition-colors flex items-center gap-1.5 ml-4"
                >
                  <Video className="w-3 h-3" /> Meetings
                </button>
              </div>
              <ProjectMenu
                onEdit={() => setEditProject(project)}
                onDelete={() => setDeleteId(project.id)}
              />
            </div>
          </div>
        ))}
        {!isLoading && data?.data.length === 0 && (
          <div className="col-span-2 text-center py-12 text-white/50 bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5">
            No projects found
          </div>
        )}
      </div>


      {(showForm || editProject) && (
        <ProjectModal project={editProject} onClose={() => { setShowForm(false); setEditProject(undefined); }}
          onSave={d => { if (editProject) update.mutate({ id: editProject.id, d }); else create.mutate(d); }} />
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-white/5">
            <h3 className="font-semibold text-lg mb-2">Delete Project?</h3>
            <p className="text-sm text-white/50 mb-6">This will permanently delete the project and all member assignments.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 text-sm border border-white/5 rounded-lg hover:bg-muted">Cancel</button>
              <button onClick={() => del.mutate(deleteId)} disabled={del.isPending}
                className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {del.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {manageTeamProject && (
        <ManageTeamModal project={manageTeamProject} onClose={() => setManageTeamProject(undefined)} />
      )}

      {meetingsProject && (
        <ProjectMeetingsModal project={meetingsProject} onClose={() => setMeetingsProject(undefined)} />
      )}
    </div>
  );
}

function getRoleBadgeStyle(role: string) {
  switch (role) {
    case 'PROJECT_MANAGER':
      return 'bg-purple-950/50 text-purple-300 border-purple-800/40';
    case 'TEAM_LEADER':
      return 'bg-amber-950/50 text-amber-300 border-amber-800/40';
    case 'BUSINESS_ANALYST':
    case 'DATA_ANALYST':
    case 'DATA_ENGINEER':
    case 'BI_DEVELOPER':
    case 'DASHBOARD_DEVELOPER':
      return 'bg-cyan-950/50 text-cyan-300 border-cyan-800/40';
    case 'DESIGNER':
      return 'bg-rose-950/50 text-rose-300 border-rose-800/40';
    case 'QA_SPECIALIST':
      return 'bg-red-950/50 text-red-300 border-red-800/40';
    case 'DEVELOPER':
    case 'FRONTEND_DEVELOPER':
    case 'BACKEND_DEVELOPER':
    case 'CLOUD_ENGINEER':
    case 'SOLUTION_ARCHITECT':
      return 'bg-emerald-950/50 text-emerald-300 border-emerald-800/40';
    default:
      return 'bg-slate-900/60 text-slate-300 border-slate-800/40';
  }
}

function ManageTeamModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const qc = useQueryClient();
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [role, setRole] = useState('DEVELOPER');

  const { data: projectDetail } = useQuery<Project>({
    queryKey: ['project-detail', project.id],
    queryFn: () => projectsApi.get(project.id).then(r => r.data),
    initialData: project,
  });

  const { data: allMembers } = useQuery<PaginatedResponse<TeamMember>>({
    queryKey: ['members-all'],
    queryFn: () => membersApi.list({ limit: 100 }).then(r => r.data),
  });

  const addMember = useMutation({
    mutationFn: (d: { memberId: string; role: string }) => projectsApi.addMember(project.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project-detail', project.id] });
      setSelectedMemberId('');
      setRole('DEVELOPER');
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => projectsApi.removeMember(project.id, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project-detail', project.id] });
    },
  });

  const currentMemberIds = projectDetail.members?.map(pm => pm.memberId) || [];
  const assignableMembers = allMembers?.data.filter(m => !currentMemberIds.includes(m.id)) || [];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/5/80 flex flex-col max-h-[85vh] transform transition-all">
        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-5 border-b border-white/5/80 bg-gradient-to-b from-muted/30 to-card">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-azure-500/20 via-azure-500 to-azure-500/20" />
          <div className="space-y-1">
            <h2 className="font-bold text-lg text-foreground tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-azure-400" />
              Manage Project Team
            </h2>
            <p className="text-xs text-white/50 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-azure-500 animate-pulse" />
              {projectDetail.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/50 hover:text-foreground hover:bg-muted/50 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Current Members Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Current Members ({projectDetail.members?.length || 0})
            </h3>
            <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-1">
              {projectDetail.members && projectDetail.members.length > 0 ? (
                projectDetail.members.map(pm => (
                  <div key={pm.id} className="group flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/10/40 hover:border-azure-500/30 transition-all hover:bg-muted/35">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-azure-500/10 border border-azure-500/20 flex items-center justify-center text-azure-400 text-sm font-bold flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                        {pm.member.profilePictureUrl ? (
                          <img src={pm.member.profilePictureUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          pm.member.name[0]
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-foreground tracking-tight group-hover:text-azure-400 transition-colors">
                          {pm.member.name}
                        </p>
                        <p className="text-[10px] text-white/50 font-medium">
                          {pm.member.designation || 'Team Member'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn('text-[10px] px-2.5 py-0.5 rounded-full border font-semibold tracking-wide', getRoleBadgeStyle(pm.role || ''))}>
                        {pm.role === 'TEAM_LEADER' ? '👑 Team Leader' : pm.role ? pm.role.replace(/_/g, ' ') : 'Developer'}
                      </span>
                      <button 
                        onClick={() => removeMember.mutate(pm.memberId)}
                        disabled={removeMember.isPending}
                        className="p-1.5 text-white/50 hover:text-red-400 hover:bg-red-950/40 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-dashed border-white/5/60 bg-muted/5 text-center">
                  <Users className="w-10 h-10 text-white/50/20 mb-2.5" />
                  <p className="text-xs text-white/50 font-medium">No team members assigned yet</p>
                  <p className="text-[10px] text-white/50/50 mt-0.5">Assign members below to get started</p>
                </div>
              )}
            </div>
          </div>

          {/* Add Member Form Section */}
          <div className="pt-5 border-t border-white/5/80 space-y-3 bg-[#1c1926]/80 backdrop-blur-md">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-azure-400" />
              Add Project Team Member
            </h3>
            <div className="grid grid-cols-1 gap-3.5 p-4 rounded-2xl bg-muted/15 border border-white/5/60">
              <div>
                <label className="block text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-1.5">Select Member</label>
                <select 
                  value={selectedMemberId} 
                  onChange={e => setSelectedMemberId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-white/5 rounded-xl bg-background/80 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/40 focus:border-azure-500/60 transition-all cursor-pointer"
                >
                  <option value="">Choose a team member…</option>
                  {assignableMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.designation || 'No designation'})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-1.5">Select Role</label>
                  <select 
                    value={role} 
                    onChange={e => setRole(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-white/5 rounded-xl bg-background/80 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/40 focus:border-azure-500/60 transition-all cursor-pointer"
                  >
                    <option value="PROJECT_MANAGER">Project Manager</option>
                    <option value="TEAM_LEADER">Team Leader</option>
                    <option value="BUSINESS_ANALYST">Business Analyst</option>
                    <option value="DATA_ANALYST">Data Analyst</option>
                    <option value="DATA_ENGINEER">Data Engineer</option>
                    <option value="BI_DEVELOPER">BI Developer</option>
                    <option value="DASHBOARD_DEVELOPER">Dashboard Developer</option>
                    <option value="DEVELOPER">Full Stack Developer</option>
                    <option value="FRONTEND_DEVELOPER">Frontend Developer</option>
                    <option value="BACKEND_DEVELOPER">Backend Developer</option>
                    <option value="CLOUD_ENGINEER">Cloud Engineer</option>
                    <option value="DESIGNER">UI/UX Designer</option>
                    <option value="QA_SPECIALIST">QA Specialist</option>
                    <option value="SOLUTION_ARCHITECT">Solution Architect</option>
                    <option value="CLIENT_LIAISON">Client Liaison</option>
                    <option value="CONSULTANT">Consultant</option>
                    <option value="TRAINEE">Trainee</option>
                  </select>
                </div>
                <button 
                  onClick={() => { if (selectedMemberId) addMember.mutate({ memberId: selectedMemberId, role }); }}
                  disabled={!selectedMemberId || addMember.isPending}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors shadow-lg shadow-azure-500/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 h-[42px]"
                >
                  {addMember.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4.5 border-t border-white/5/80 flex justify-end bg-muted/20">
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 text-sm border border-white/5/85 rounded-xl hover:bg-muted bg-[#1c1926]/80 backdrop-blur-md text-foreground font-semibold hover:border-white/5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectMeetingsModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const qc = useQueryClient();
  const [selectedMeeting, setSelectedMeeting] = useState<TeamsMeeting | null>(null);

  const { data: meetings, isLoading } = useQuery<TeamsMeeting[]>({
    queryKey: ['project-meetings', project.id],
    queryFn: () => fetch(`/api/projects/${project.id}/meetings`).then(r => r.json()),
  });

  const syncMeetings = useMutation({
    mutationFn: () => fetch(`/api/projects/${project.id}/sync-meetings`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-meetings', project.id] }),
  });

  const generateSummary = useMutation({
    mutationFn: (meetingId: string) => fetch(`/api/meetings/${meetingId}/summary`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-meetings', project.id] }),
  });

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-white/5/80 flex flex-col h-[85vh] transform transition-all">
        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-5 border-b border-white/5/80 bg-gradient-to-b from-muted/30 to-card flex-shrink-0">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-azure-500/20 via-azure-500 to-azure-500/20" />
          <div className="space-y-1">
            <h2 className="font-bold text-lg text-foreground tracking-tight flex items-center gap-2">
              <Video className="w-5 h-5 text-azure-400" />
              Recordings & Transcripts
            </h2>
            <p className="text-xs text-white/50 font-medium">
              Teams integration for {project.name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => syncMeetings.mutate()} 
              disabled={syncMeetings.isPending}
              className="px-3 py-1.5 text-xs font-medium bg-muted/40 border border-white/5 rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5"
            >
              {syncMeetings.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Sync Meetings"}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/50 hover:text-foreground hover:bg-muted/50 transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* List */}
          <div className="w-1/3 border-r border-white/5 overflow-y-auto bg-muted/5 p-4 space-y-3">
            {isLoading && <div className="text-sm text-white/50 text-center py-8">Loading meetings...</div>}
            {!isLoading && meetings?.length === 0 && <div className="text-sm text-white/50 text-center py-8">No meetings found. Click Sync to pull from Teams.</div>}
            
            {meetings?.map(m => (
              <div 
                key={m.id} 
                onClick={() => setSelectedMeeting(m)}
                className={cn(
                  "p-4 rounded-xl border cursor-pointer transition-all hover:border-azure-500/40",
                  selectedMeeting?.id === m.id ? "bg-azure-900/20 border-azure-500" : "bg-[#1c1926]/80 backdrop-blur-md border-white/5"
                )}
              >
                <h4 className="font-semibold text-sm line-clamp-1 mb-1">{m.subject}</h4>
                <div className="flex justify-between items-center text-xs text-white/50">
                  <span>{new Date(m.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                  <span>{Math.round((new Date(m.endTime).getTime() - new Date(m.startTime).getTime()) / 60000)} min</span>
                </div>
              </div>
            ))}
          </div>

          {/* Details */}
          <div className="w-2/3 overflow-y-auto p-6">
            {selectedMeeting ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold mb-2">{selectedMeeting.subject}</h3>
                  <div className="flex items-center gap-4 text-sm text-white/50">
                    <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Organizer: {selectedMeeting.organizer}</span>
                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {new Date(selectedMeeting.startTime).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  {selectedMeeting.recordingUrl && (
                    <a href={selectedMeeting.recordingUrl} target="_blank" rel="noreferrer"
                      className="px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                      <Play className="w-4 h-4" /> Watch Recording
                    </a>
                  )}
                  {selectedMeeting.transcriptText && !selectedMeeting.aiSummary && (
                    <button 
                      onClick={() => generateSummary.mutate(selectedMeeting.id)}
                      disabled={generateSummary.isPending}
                      className="px-4 py-2 bg-gradient-to-r from-azure-600 to-purple-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
                    >
                      {generateSummary.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Generate AI Summary
                    </button>
                  )}
                </div>

                {selectedMeeting.aiSummary && (
                  <div className="bg-azure-950/20 border border-azure-800/40 rounded-xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                      <Sparkles className="w-24 h-24 text-azure-400" />
                    </div>
                    <h4 className="text-sm font-bold text-azure-400 flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4" /> AI Meeting Summary
                    </h4>
                    <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {selectedMeeting.aiSummary}
                    </div>
                  </div>
                )}

                {selectedMeeting.transcriptText && (
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2 mb-3 text-white/50">
                      <FileText className="w-4 h-4" /> Full Transcript
                    </h4>
                    <div className="bg-muted/10 border border-white/5 rounded-xl p-4 text-xs font-mono text-white/50 whitespace-pre-wrap h-64 overflow-y-auto">
                      {selectedMeeting.transcriptText}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-white/50">
                <Video className="w-12 h-12 mb-4 opacity-20" />
                <p>Select a meeting from the left to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
