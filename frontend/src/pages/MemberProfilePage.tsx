import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { membersApi, certificationsApi, projectsApi } from '@/lib/api';
import type { TeamMemberProfile, AssignedCertification, ProjectMemberWithProject } from '@/types';
import { ArrowLeft, Phone, Award, FolderKanban, TrendingUp, Pencil, Upload, X, Loader2, FileText, Plus, MoreVertical, Trash2 } from 'lucide-react';
import { cn, formatDate, getInitials, formatStatus, getStatusColor, getProgressColor } from '@/lib/utils';
import AddCertificationModal from '@/components/AddCertificationModal';
import AddProjectModal from '@/components/AddProjectModal';

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'EXPIRED'];

function UpdateCertificationModal({ assignment, onClose, onSaved }: {
  assignment: AssignedCertification;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    progress: assignment.progress,
    status: assignment.status,
    completionDate: assignment.completionDate ? assignment.completionDate.split('T')[0] : '',
    expiryDate: assignment.expiryDate ? assignment.expiryDate.split('T')[0] : '',
    credentialId: assignment.credentialId || '',
    notes: assignment.notes || '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      // Update assignment fields first
      await certificationsApi.updateAssignment(assignment.id, {
        progress: form.progress,
        status: form.status,
        completionDate: form.completionDate || undefined,
        expiryDate: form.expiryDate || undefined,
        credentialId: form.credentialId || undefined,
        notes: form.notes || undefined,
      });
      // Then upload the certificate file if the member selected one
      if (file) {
        const fd = new FormData();
        fd.append('certificate', file);
        if (form.credentialId) fd.append('credentialId', form.credentialId);
        if (form.completionDate) fd.append('completionDate', form.completionDate);
        if (form.expiryDate) fd.append('expiryDate', form.expiryDate);
        await certificationsApi.uploadCertificate(assignment.id, fd);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member'] });
      qc.invalidateQueries({ queryKey: ['tracker'] });
      qc.invalidateQueries({ queryKey: ['certifications'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onSaved();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-lg">Update Certification</h2>
            <p className="text-xs text-muted-foreground">{assignment.certification?.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Progress ({form.progress}%)</label>
            <input type="range" min={0} max={100} value={form.progress}
              onChange={e => setForm(p => ({ ...p, progress: parseInt(e.target.value) }))}
              className="w-full accent-azure-500" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>0%</span><span>100%</span></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30">
              {STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Completed On</label>
              <input type="date" value={form.completionDate} onChange={e => setForm(p => ({ ...p, completionDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Valid Till</label>
              <input type="date" value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Credential ID</label>
            <input value={form.credentialId} onChange={e => setForm(p => ({ ...p, credentialId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30"
              placeholder="e.g. AZ-900-2024-123" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Certificate File</label>
            <div onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-azure-500 hover:bg-azure-900/20 transition-colors bg-muted/10">
              {file
                ? <p className="text-sm text-azure-300 font-medium truncate">{file.name}</p>
                : assignment.certificateUrl
                  ? <p className="text-xs text-muted-foreground">Certificate uploaded · click to replace</p>
                  : <>
                      <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Click to upload PDF, PNG, or JPG</p>
                    </>
              }
              <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
            {assignment.certificateUrl && !file && (
              <a href={assignment.certificateUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-azure-400 hover:text-azure-300 mt-1.5">
                <FileText className="w-3 h-3" /> View current certificate
              </a>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30 resize-none"
              placeholder="Optional notes about your progress…" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
          <button onClick={() => { setError(null); save.mutate(); }} disabled={save.isPending}
            className="flex-1 px-4 py-2 text-sm bg-azure-500 text-white rounded-lg hover:bg-azure-600 disabled:opacity-60 flex items-center justify-center gap-2">
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Save Update
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectMenu({ onEditRole, onRemove }: { onEditRole: () => void; onRemove: () => void }) {
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
    <div ref={ref} className="relative flex-shrink-0">
      <button onClick={() => setOpen(o => !o)}
        className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg transition-colors" title="Options">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-30 w-44 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-fade-in">
          <button onClick={() => { setOpen(false); onEditRole(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors text-left">
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Edit role
          </button>
          <button onClick={() => { setOpen(false); onRemove(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-950/40 transition-colors text-left">
            <Trash2 className="w-3.5 h-3.5" /> Remove from project
          </button>
        </div>
      )}
    </div>
  );
}

export default function MemberProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [updateCert, setUpdateCert] = useState<AssignedCertification | undefined>();
  const [showAdd, setShowAdd] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [editRolePm, setEditRolePm] = useState<ProjectMemberWithProject | undefined>();
  const [roleInput, setRoleInput] = useState('');

  const { data: member, isLoading } = useQuery<TeamMemberProfile>({
    queryKey: ['member', id],
    queryFn: () => membersApi.get(id!).then(r => r.data),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['member'] });
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };

  const removeProject = useMutation({
    mutationFn: (pm: ProjectMemberWithProject) => projectsApi.removeMember(pm.projectId, member!.id),
    onSuccess: invalidate,
  });

  const updateRole = useMutation({
    mutationFn: ({ pm, role }: { pm: ProjectMemberWithProject; role: string }) =>
      projectsApi.updateMember(pm.projectId, member!.id, { role: role.trim() || undefined }),
    onSuccess: () => { invalidate(); setEditRolePm(undefined); },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-48 bg-card rounded-2xl border border-border" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-card rounded-xl border border-border" />)}
        </div>
      </div>
    );
  }

  if (!member) return <div className="text-center py-20 text-muted-foreground">Member not found</div>;

  const { stats } = member;
  const completionRate = stats.totalCertifications > 0
    ? Math.round((stats.completedCertifications / stats.totalCertifications) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button onClick={() => navigate('/members')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Members
      </button>

      {/* Profile Header Card */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-azure-800 via-azure-700 to-primary" />
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            <div className="w-20 h-20 rounded-2xl border-4 border-card bg-azure-900/40 flex items-center justify-center overflow-hidden shadow-xl flex-shrink-0">
              {member.profilePictureUrl
                ? <img src={member.profilePictureUrl} alt={member.name} className="w-full h-full object-cover" />
                : <span className="text-azure-300 text-2xl font-bold">{getInitials(member.name)}</span>
              }
            </div>
            <div className="pb-1">
              <h1 className="text-2xl font-bold">{member.name}</h1>
              <p className="text-muted-foreground">{member.designation}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
            {member.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4 text-azure-500" /><span>{member.phone}</span>
              </div>
            )}

            {member.manager && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground col-span-2 md:col-span-1">
                <span>👤 Reports to: <strong className="text-foreground">{member.manager.name}</strong></span>
              </div>
            )}
          </div>

          {member.skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {member.skills.map(skill => (
                <span key={skill} className="text-xs px-2.5 py-1 bg-azure-950/40 text-azure-300 border border-azure-800/40 rounded-full font-medium">{skill}</span>
              ))}
            </div>
          )}


        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Certs', value: stats.totalCertifications, icon: Award, color: 'text-indigo-400', bg: 'bg-indigo-950/40' },
          { label: 'Completed', value: stats.completedCertifications, icon: Award, color: 'text-green-400', bg: 'bg-green-950/40' },
          { label: 'Total Projects', value: stats.totalProjects, icon: FolderKanban, color: 'text-purple-400', bg: 'bg-purple-950/40' },
          { label: 'Active Projects', value: stats.activeProjects, icon: TrendingUp, color: 'text-azure-400', bg: 'bg-azure-950/40' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', bg)}>
              <Icon className={cn('w-5 h-5', color)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn('text-2xl font-bold', color)}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Overall Progress */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Overall Certification Progress</p>
          <span className="text-sm font-bold text-azure-400">{completionRate}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5">
          <div className={cn('h-2.5 rounded-full transition-all duration-700', getProgressColor(completionRate))}
            style={{ width: `${completionRate}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {stats.completedCertifications} of {stats.totalCertifications} certifications completed
          {stats.overdueCertifications > 0 && ` · ${stats.overdueCertifications} overdue`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Current Projects */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Current Projects</h3>
            <button onClick={() => setShowAddProject(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-azure-500 text-white rounded-lg hover:bg-azure-600 transition-colors shadow-sm shadow-azure-500/25">
              <Plus className="w-3.5 h-3.5" /> Add to Project
            </button>
          </div>
          {member.projectMembers.length === 0
            ? <p className="text-sm text-muted-foreground">Not assigned to any projects — click <strong className="text-foreground">Add to Project</strong> to assign one.</p>
            : <div className="space-y-3">
                {member.projectMembers.map(pm => (
                  <div key={pm.id} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{pm.project.name}</p>
                        {pm.role && <p className="text-xs text-muted-foreground">{pm.role}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', getStatusColor(pm.project.status))}>
                          {formatStatus(pm.project.status)}
                        </span>
                        <ProjectMenu
                          onEditRole={() => { setRoleInput(pm.role || ''); setEditRolePm(pm); }}
                          onRemove={() => removeProject.mutate(pm)}
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span><span>{pm.project.progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className={cn('h-1.5 rounded-full', getProgressColor(pm.project.progress))}
                          style={{ width: `${pm.project.progress}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Certifications */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Certifications</h3>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-azure-500 text-white rounded-lg hover:bg-azure-600 transition-colors shadow-sm shadow-azure-500/25">
              <Plus className="w-3.5 h-3.5" /> Add Certification
            </button>
          </div>
          {member.assignedCertifications.length === 0
            ? <p className="text-sm text-muted-foreground">No certifications yet — click <strong className="text-foreground">Add Certification</strong> to log one.</p>
            : <div className="space-y-3">
                {member.assignedCertifications.map(ac => (
                  <div key={ac.id} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{ac.certification?.name}</p>
                        <p className="text-xs text-muted-foreground">{ac.certification?.provider}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', getStatusColor(ac.status))}>
                          {formatStatus(ac.status)}
                        </span>
                        <button onClick={() => setUpdateCert(ac)} title="Update certification"
                          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border border-azure-800/40 text-azure-300 hover:bg-azure-900/30 hover:text-azure-200 transition-colors">
                          <Pencil className="w-3 h-3" /> Update
                        </button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Deadline: {formatDate(ac.deadline)}</span><span>{ac.progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className={cn('h-1.5 rounded-full', getProgressColor(ac.progress))}
                          style={{ width: `${ac.progress}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {updateCert && (
        <UpdateCertificationModal
          assignment={updateCert}
          onClose={() => setUpdateCert(undefined)}
          onSaved={() => setUpdateCert(undefined)}
        />
      )}

      {showAdd && (
        <AddCertificationModal
          memberId={member.id}
          memberName={member.name}
          onClose={() => setShowAdd(false)}
          onSaved={() => setShowAdd(false)}
        />
      )}

      {showAddProject && (
        <AddProjectModal
          memberId={member.id}
          memberName={member.name}
          onClose={() => setShowAddProject(false)}
          onSaved={() => setShowAddProject(false)}
        />
      )}

      {editRolePm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-lg">Edit Role</h2>
                <p className="text-xs text-muted-foreground">{editRolePm.project.name}</p>
              </div>
              <button onClick={() => setEditRolePm(undefined)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Role</label>
              <input value={roleInput} onChange={e => setRoleInput(e.target.value)} autoFocus
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                placeholder="e.g. Developer, Analyst (leave blank to clear)" />
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setEditRolePm(undefined)} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
              <button onClick={() => updateRole.mutate({ pm: editRolePm, role: roleInput })} disabled={updateRole.isPending}
                className="flex-1 px-4 py-2 text-sm bg-azure-500 text-white rounded-lg hover:bg-azure-600 disabled:opacity-60 flex items-center justify-center gap-2">
                {updateRole.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
