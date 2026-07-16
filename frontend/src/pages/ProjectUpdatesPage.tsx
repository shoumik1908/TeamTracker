import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectUpdatesApi, projectsApi, membersApi } from '@/lib/api';
import {
  MessageSquareDiff, Plus, Loader2, Filter,
  TrendingUp, AlertTriangle, Trophy, MessageCircle, X, Send,
  MoreVertical, Pencil, Trash2,
} from 'lucide-react';
import { cn, formatRelative } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectUpdate {
  id: string;
  projectId: string;
  memberId: string;
  updateText: string;
  updateType: string;
  progressValue: number | null;
  createdAt: string;
  project: { id: string; name: string; status: string };
  member: { id: string; name: string; designation: string | null; profilePictureUrl: string | null };
}

interface Project { id: string; name: string; status: string }
interface Member { id: string; name: string; designation: string | null }

// ─── Constants ────────────────────────────────────────────────────────────────

const UPDATE_TYPES = [
  { value: 'Progress',  label: 'Progress',  icon: TrendingUp,    color: 'text-blue-400',   bg: 'bg-blue-950/40 border-blue-800/50',   badge: 'bg-blue-900/60 text-blue-300 border-blue-800/40' },
  { value: 'Blocker',   label: 'Blocker',   icon: AlertTriangle, color: 'text-red-400',    bg: 'bg-red-950/40 border-red-800/50',     badge: 'bg-red-900/60 text-red-300 border-red-800/40' },
  { value: 'Milestone', label: 'Milestone', icon: Trophy,        color: 'text-green-400',  bg: 'bg-green-950/40 border-green-800/50', badge: 'bg-green-900/60 text-green-300 border-green-800/40' },
  { value: 'General',   label: 'General',   icon: MessageCircle, color: 'text-slate-400',  bg: 'bg-slate-900/40 border-slate-700/50', badge: 'bg-slate-800/60 text-slate-300 border-slate-700/40' },
];

function getTypeMeta(type: string) {
  return UPDATE_TYPES.find(t => t.value === type) ?? UPDATE_TYPES[3];
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Three-dot dropdown ───────────────────────────────────────────────────────

function UpdateMenu({ onEdit, onDelete, isDeleting }: {
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
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
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg transition-colors"
        title="Options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-30 w-36 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-fade-in">
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            Edit
          </button>
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            disabled={isDeleting}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-950/40 transition-colors disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Shared form body (used in both Add and Edit modals) ──────────────────────

function UpdateForm({
  projects,
  members,
  initialProjectId = '',
  initialMemberId = '',
  initialType = 'Progress',
  initialText = '',
  isEdit = false,
  isSaving,
  currentUser,
  onClose,
  onSave,
}: {
  projects: Project[];
  members: Member[];
  initialProjectId?: string;
  initialMemberId?: string;
  initialType?: string;
  initialText?: string;
  isEdit?: boolean;
  isSaving: boolean;
  currentUser?: any;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [formProjectId, setFormProjectId] = useState(initialProjectId);
  const [formMemberId, setFormMemberId] = useState(initialMemberId || currentUser?.teamMemberId || '');
  const [formType, setFormType] = useState(initialType);
  const [formText, setFormText] = useState(initialText);
  const [formError, setFormError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!isEdit && !formProjectId) { setFormError('Please select a project.'); return; }
    if (!isEdit && !formMemberId)  { setFormError('Please select a team member.'); return; }
    if (!formText.trim()) { setFormError('Please enter an update.'); return; }
    onSave({
      ...(!isEdit && { projectId: formProjectId, memberId: formMemberId }),
      updateText: formText.trim(),
      updateType: formType,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {/* Project — only shown when adding */}
      {!isEdit && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Project *</label>
          <select
            id="modal-project-select"
            value={formProjectId}
            onChange={e => setFormProjectId(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/40 transition-all"
          >
            <option value="">Select project…</option>
            {projects.filter(p => p.status !== 'COMPLETED').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Member — only shown when adding */}
      {!isEdit && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Posted by *</label>
          {currentUser?.teamMemberId ? (
            <div className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-muted-foreground flex items-center">
              Posting as: {members.find(m => m.id === currentUser.teamMemberId)?.name || currentUser.name}
            </div>
          ) : (
            <select
              id="modal-member-select"
              value={formMemberId}
              onChange={e => setFormMemberId(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/40 transition-all"
            >
              <option value="">Select member…</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}{m.designation ? ` — ${m.designation}` : ''}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Update type */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Update Type *</label>
        <div className="grid grid-cols-2 gap-2">
          {UPDATE_TYPES.map(t => {
            const Icon = t.icon;
            const active = formType === t.value;
            return (
              <button
                key={t.value}
                type="button"
                id={`modal-type-${t.value.toLowerCase()}`}
                onClick={() => setFormType(t.value)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all',
                  active ? `${t.bg} ${t.color} shadow-sm` : 'border-border text-muted-foreground hover:bg-muted/30'
                )}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Text */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Update *</label>
        <textarea
          id="modal-update-text"
          value={formText}
          onChange={e => setFormText(e.target.value)}
          placeholder={
            formType === 'Progress'  ? 'What progress was made today?…' :
            formType === 'Blocker'   ? 'Describe the blocker and impact…' :
            formType === 'Milestone' ? 'What milestone was achieved?…' :
            'Share any update with the team…'
          }
          rows={4}
          className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-azure-500/40 transition-all resize-none"
        />
        <p className="text-right text-xs text-muted-foreground/50 mt-1">{formText.length}/500</p>
      </div>

      {formError && (
        <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{formError}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 px-4 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-muted/30 transition-colors text-muted-foreground">
          Cancel
        </button>
        <button id="modal-save-btn" type="submit" disabled={isSaving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-azure-500 hover:bg-azure-600 text-white shadow-lg shadow-azure-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all">
          {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Send className="w-4 h-4" /> {isEdit ? 'Save Changes' : 'Post Update'}</>}
        </button>
      </div>
    </form>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-azure-500/10 border border-azure-500/30 flex items-center justify-center">
              <MessageSquareDiff className="w-4 h-4 text-azure-400" />
            </div>
            <h2 className="font-semibold text-base">{title}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectUpdatesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd]             = useState(false);
  const [editTarget, setEditTarget]       = useState<ProjectUpdate | null>(null);
  const [filterProjectId, setFilterProjectId] = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: updatesData, isLoading } = useQuery<{ data: ProjectUpdate[]; total: number }>({
    queryKey: ['project-updates', filterProjectId],
    queryFn: () => projectUpdatesApi.list(filterProjectId ? { projectId: filterProjectId } : undefined).then(r => r.data),
    refetchInterval: 15000,
  });

  const { data: projectsData } = useQuery<{ data: Project[] }>({
    queryKey: ['projects-all'],
    queryFn: () => projectsApi.list({ limit: '100' }).then(r => r.data),
  });

  const { data: membersData } = useQuery<{ data: Member[] }>({
    queryKey: ['members-all'],
    queryFn: () => membersApi.list({ limit: '100' }).then(r => r.data),
  });

  const projects = projectsData?.data ?? [];
  const members  = membersData?.data  ?? [];
  const updates  = updatesData?.data  ?? [];

  // Group updates by project
  interface GroupedProject {
    projectId: string;
    projectName: string;
    latestUpdateAt: string;
    updates: ProjectUpdate[];
  }

  const groupedProjects = updates.reduce<GroupedProject[]>((acc, u) => {
    let group = acc.find(g => g.projectId === u.projectId);
    if (!group) {
      group = {
        projectId: u.projectId,
        projectName: u.project.name,
        latestUpdateAt: u.createdAt,
        updates: [],
      };
      acc.push(group);
    }
    group.updates.push(u);
    if (new Date(u.createdAt) > new Date(group.latestUpdateAt)) {
      group.latestUpdateAt = u.createdAt;
    }
    return acc;
  }, []);

  // Sort projects so the one with the most recent update is at the top
  groupedProjects.sort((a, b) => new Date(b.latestUpdateAt).getTime() - new Date(a.latestUpdateAt).getTime());

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => projectUpdatesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-updates'] });
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
      setShowAdd(false);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      projectUpdatesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-updates'] });
      setEditTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectUpdatesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-updates'] }),
  });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Project Updates</h2>
          <p className="page-subtitle">{updatesData?.total ?? 0} updates · auto-refreshes every 15s</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <select
              id="feed-project-filter"
              value={filterProjectId}
              onChange={e => setFilterProjectId(e.target.value)}
              className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/40 transition-all"
            >
              <option value="">All projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button
            id="add-update-btn"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-azure-500 hover:bg-azure-600 text-white shadow-lg shadow-azure-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Update
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 h-24 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && updates.length === 0 && (
        <div className="bg-card rounded-xl border border-border py-24 text-center">
          <MessageSquareDiff className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No updates yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1 mb-5">
            {filterProjectId ? 'No updates for this project' : 'Be the first to post an update'}
          </p>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-azure-500 hover:bg-azure-600 text-white transition-all">
            <Plus className="w-4 h-4" /> Post first update
          </button>
        </div>
      )}

      {/* Feed */}
      <div className="space-y-4">
        {groupedProjects.map(p => (
          <div key={p.projectId} className="bg-card rounded-xl border border-border shadow-sm">
            {/* Project Header */}
            <div className="bg-muted/10 border-b border-border px-5 py-3 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-azure-400">📁 {p.projectName}</span>
                <span className="text-[11px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full font-medium">
                  {p.updates.length} {p.updates.length === 1 ? 'update' : 'updates'}
                </span>
              </div>
            </div>

            {/* Updates List */}
            <div className="divide-y divide-border/40">
              {p.updates.map(u => {
                const meta = getTypeMeta(u.updateType);
                const Icon = meta.icon;
                return (
                  <div key={u.id} className="p-4 flex gap-4 hover:bg-muted/5 transition-colors last:rounded-b-xl">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {u.member.profilePictureUrl ? (
                        <img src={u.member.profilePictureUrl} alt={u.member.name}
                          className="w-10 h-10 rounded-full object-cover border border-border" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-azure-500/10 border border-azure-500/30 flex items-center justify-center">
                          <span className="text-azure-400 text-xs font-bold">{getInitials(u.member.name)}</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{u.member.name}</span>
                          {u.member.designation && (
                            <span className="text-xs text-muted-foreground">· {u.member.designation}</span>
                          )}
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                            meta.badge
                          )}>
                            <Icon className="w-3 h-3" />
                            {u.updateType}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-xs text-muted-foreground/60">{formatRelative(u.createdAt)}</span>
                          {/* ⋮ Three-dot menu */}
                          <UpdateMenu
                            onEdit={() => setEditTarget(u)}
                            onDelete={() => deleteMutation.mutate(u.id)}
                            isDeleting={deleteMutation.isPending && deleteMutation.variables === u.id}
                          />
                        </div>
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed">{u.updateText}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Add modal */}
      {showAdd && (
        <Modal title="Post an Update" onClose={() => setShowAdd(false)}>
          <UpdateForm
            projects={projects}
            members={members}
            currentUser={user}
            isSaving={createMutation.isPending}
            onClose={() => setShowAdd(false)}
            onSave={data => createMutation.mutate(data)}
          />
        </Modal>
      )}

      {/* Edit modal */}
      {editTarget && (
        <Modal title="Edit Update" onClose={() => setEditTarget(null)}>
          <UpdateForm
            projects={projects}
            members={members}
            currentUser={user}
            initialProjectId={editTarget.projectId}
            initialMemberId={editTarget.memberId}
            initialType={editTarget.updateType}
            initialText={editTarget.updateText}
            isEdit
            isSaving={editMutation.isPending}
            onClose={() => setEditTarget(null)}
            onSave={data => editMutation.mutate({ id: editTarget.id, data })}
          />
        </Modal>
      )}
    </div>
  );
}
