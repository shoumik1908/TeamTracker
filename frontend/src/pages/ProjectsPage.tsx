import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, membersApi } from '@/lib/api';
import { Plus, Search, Pencil, Trash2, Users, X, Loader2, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn, formatDate, formatStatus, getStatusColor, getPriorityColor, getProgressColor } from '@/lib/utils';
import type { Project, PaginatedResponse, TeamMember } from '@/types';

const STATUSES = ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface ProjectFormData {
  name: string; description: string; client: string;
  startDate: string; endDate: string; priority: string; status: string; progress: string;
  managerId: string;
}
const INIT: ProjectFormData = { name: '', description: '', client: '', startDate: '', endDate: '', priority: 'MEDIUM', status: 'PLANNING', progress: '0', managerId: '' };

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
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">{project ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Project Name *</label>
            <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30"
              placeholder="Azure Cloud Migration" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30 resize-none"
              placeholder="Brief description..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Client</label>
              <input value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                placeholder="Acme Corp / Internal" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30">
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Start Date *</label>
              <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">End Date</label>
              <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-azure-500/30">
                {STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Progress ({form.progress}%)</label>
              <input type="range" min={0} max={100} value={form.progress}
                onChange={e => setForm(p => ({ ...p, progress: e.target.value }))} className="w-full accent-azure-500 mt-2" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Project Manager</label>
            <select value={form.managerId} onChange={e => setForm(p => ({ ...p, managerId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-azure-500/30">
              <option value="">No Manager Assigned</option>
              {members?.data.map(m => <option key={m.id} value={m.id}>{m.name} ({m.designation})</option>)}
            </select>
          </div>
          {!project && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Assign Members</label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {members?.data.map(m => (
                  <button key={m.id} type="button"
                    onClick={() => setSelectedMembers(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                    className={cn('text-xs px-2.5 py-1 rounded-full border transition-colors',
                      selectedMembers.includes(m.id) ? 'bg-azure-500 text-white border-azure-500 shadow-lg shadow-azure-500/20' : 'border-border hover:border-azure-500/50 bg-muted/10')}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted bg-card">Cancel</button>
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
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<Project | undefined>();
  const [manageTeamProject, setManageTeamProject] = useState<Project | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<PaginatedResponse<Project>>({
    queryKey: ['projects', search, statusFilter, page],
    queryFn: () => projectsApi.list({ search, status: statusFilter || undefined, page, limit: 10 }).then(r => r.data),
  });

  const create = useMutation({ mutationFn: (d: Record<string, unknown>) => projectsApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); setShowForm(false); } });
  const update = useMutation({ mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) => projectsApi.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setEditProject(undefined); } });
  const del = useMutation({ mutationFn: (id: string) => projectsApi.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); setDeleteId(null); } });

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

      <div className="bg-card rounded-xl border border-border p-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search projects…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30 focus:border-azure-500" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30 bg-card">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
        </select>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-5 h-48 animate-pulse">
            <div className="h-5 bg-muted rounded w-2/3 mb-2" />
            <div className="h-3 bg-muted rounded w-1/3 mb-4" />
            <div className="h-12 bg-muted rounded mb-3" />
          </div>
        ))}
        {data?.data.map(project => (
          <div key={project.id} className="bg-card rounded-xl border border-border p-5 hover-card">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{project.name}</h3>
                {project.client && <p className="text-xs text-muted-foreground mt-0.5">Client: {project.client}</p>}
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

            {project.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{project.description}</p>}

            {/* Progress */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Progress</span>
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
                  <button onClick={() => setManageTeamProject(project)}
                    className="flex items-center hover:opacity-80 transition-opacity">
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
                      <span className="text-xs text-muted-foreground ml-1">+{project.members.length - 3}</span>
                    )}
                    <span className="text-xs text-muted-foreground ml-1.5 flex items-center gap-1">
                      <Users className="w-3 h-3 text-azure-500" />{project.members.length}
                    </span>
                  </button>
                ) : (
                  <button onClick={() => setManageTeamProject(project)}
                    className="text-xs text-muted-foreground hover:text-azure-400 flex items-center gap-1 transition-colors">
                    <Users className="w-3.5 h-3.5" /> Assign Team
                  </button>
                )}
                {project.endDate && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />{formatDate(project.endDate)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setEditProject(project)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteId(project.id)}
                  className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && data?.data.length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
            No projects found
          </div>
        )}
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-card border border-border disabled:opacity-40 bg-card"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm">{page} / {data.pagination.totalPages}</span>
          <button onClick={() => setPage(p => Math.min(data.pagination.totalPages, p+1))} disabled={page === data.pagination.totalPages} className="p-2 rounded-lg hover:bg-card border border-border disabled:opacity-40 bg-card"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}

      {(showForm || editProject) && (
        <ProjectModal project={editProject} onClose={() => { setShowForm(false); setEditProject(undefined); }}
          onSave={d => { if (editProject) update.mutate({ id: editProject.id, d }); else create.mutate(d); }} />
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-border">
            <h3 className="font-semibold text-lg mb-2">Delete Project?</h3>
            <p className="text-sm text-muted-foreground mb-6">This will permanently delete the project and all member assignments.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
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
    </div>
  );
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in animate-duration-200">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-base">Manage Project Team</h2>
            <p className="text-xs text-muted-foreground truncate max-w-[280px]">{projectDetail.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Current Members</label>
            <div className="space-y-2">
              {projectDetail.members && projectDetail.members.length > 0 ? (
                projectDetail.members.map(pm => (
                  <div key={pm.id} className="flex items-center justify-between p-2 rounded-xl bg-muted/10 border border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-azure-500/10 border border-border flex items-center justify-center text-azure-600 text-xs font-bold flex-shrink-0 overflow-hidden">
                        {pm.member.profilePictureUrl
                          ? <img src={pm.member.profilePictureUrl} alt="" className="w-full h-full object-cover" />
                          : pm.member.name[0]}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{pm.member.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{pm.member.designation}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-azure-500/10 border border-azure-500/20 text-azure-600 font-semibold">
                        {pm.role === 'TEAM_LEADER' ? '👑 Team Leader' : pm.role ? pm.role.replace(/_/g, ' ') : 'Developer'}
                      </span>
                      <button onClick={() => removeMember.mutate(pm.memberId)}
                        disabled={removeMember.isPending}
                        className="p-1.5 text-muted-foreground hover:text-red-400 rounded-lg hover:bg-muted transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-6 bg-muted/5 rounded-xl border border-dashed border-border">No team members assigned yet.</p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <label className="block text-xs font-medium text-muted-foreground mb-2">Add Member & Select Role</label>
            <div className="space-y-3">
              <div>
                <select value={selectedMemberId} onChange={e => setSelectedMemberId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-azure-500/30">
                  <option value="">Select a team member...</option>
                  {assignableMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.designation})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <select value={role} onChange={e => setRole(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-azure-500/30">
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
                <button onClick={() => { if (selectedMemberId) addMember.mutate({ memberId: selectedMemberId, role }); }}
                  disabled={!selectedMemberId || addMember.isPending}
                  className="px-4 py-2 text-sm bg-azure-500 text-white rounded-lg hover:bg-azure-600 disabled:opacity-60 flex items-center justify-center gap-1 font-medium transition-colors">
                  {addMember.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end bg-muted/5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted bg-card font-medium transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}
