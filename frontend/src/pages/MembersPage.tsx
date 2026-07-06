import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { membersApi, projectsApi } from '@/lib/api';
import { Plus, Search, Pencil, Trash2, X, Upload, Loader2, MoreVertical, Filter } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import type { TeamMember, PaginatedResponse } from '@/types';

interface MemberFormData {
  name: string;
  phone: string;
  designation?: string;
  managerId: string;
}

const INITIAL_FORM: MemberFormData = {
  name: '', phone: '',
  designation: '', managerId: '',
};

function MemberMenu({ onEdit, onDelete }: {
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
    <div ref={ref} className="relative flex justify-end">
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
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors text-left"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
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

function MemberFormModal({
  member, onClose, onSave,
}: {
  member?: TeamMember;
  onClose: () => void;
  onSave: (form: FormData) => void;
}) {
  const [form, setForm] = useState<MemberFormData>(
    member ? {
      name: member.name, phone: member.phone || '',
      designation: member.designation,
      managerId: member.managerId || '',
    } : INITIAL_FORM
  );
  const { data: allMembers } = useQuery<PaginatedResponse<TeamMember>>({
    queryKey: ['members-form-list'],
    queryFn: () => membersApi.list({ limit: 100 }).then(r => r.data),
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(member?.profilePictureUrl || null);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (imageFile) fd.append('profilePicture', imageFile);
    onSave(fd);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">{member ? 'Edit Member' : 'Add Team Member'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Avatar Upload */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-azure-900/40 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-azure-800/40">
              {imagePreview
                ? <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                : <span className="text-azure-300 text-xl font-bold">{form.name ? getInitials(form.name) : '?'}</span>
              }
            </div>
            <label className="flex items-center gap-2 text-sm text-azure-300 cursor-pointer hover:text-azure-400 border border-azure-800/40 rounded-lg px-3 py-2 hover:bg-azure-900/20 transition-colors">
              <Upload className="w-4 h-4" /> Upload Photo
              <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Full Name *', key: 'name', placeholder: 'Alice Johnson', required: true },
              { label: 'Phone', key: 'phone', placeholder: '+1-555-0101' },
              { label: 'Designation', key: 'designation', placeholder: 'Senior Engineer' },
            ].map(({ label, key, placeholder, required }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                <input
                  type="text"
                  required={required}
                  placeholder={placeholder}
                  value={form[key as keyof MemberFormData]}
                  onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30 focus:border-azure-400"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Reporting Manager / Head</label>
            <select value={form.managerId} onChange={e => setForm(p => ({ ...p, managerId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30 focus:border-azure-400">
              <option value="">No Manager Assigned</option>
              {allMembers?.data.filter(m => m.id !== member?.id).map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.designation})</option>
              ))}
            </select>
          </div>

        </form>
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleSubmit as any} className="flex-1 px-4 py-2 text-sm font-medium bg-azure-500 text-white rounded-lg hover:bg-azure-600 transition-colors">
            {member ? 'Save Changes' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MembersPage() {
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: projectsData } = useQuery({
    queryKey: ['projects-filter'],
    queryFn: () => projectsApi.list({ limit: 100 }).then(r => r.data),
  });

  const { data, isLoading } = useQuery<PaginatedResponse<TeamMember>>({
    queryKey: ['members', search, projectId],
    queryFn: () => membersApi.list({ search, projectId, limit: 1000 }).then(r => r.data),
  });

  const createMember = useMutation({
    mutationFn: (fd: FormData) => membersApi.create(fd),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); setShowForm(false); },
  });

  const updateMember = useMutation({
    mutationFn: ({ id, fd }: { id: string; fd: FormData }) => membersApi.update(id, fd),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members'] }); setEditMember(undefined); },
  });

  const deleteMember = useMutation({
    mutationFn: (id: string) => membersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); setDeleteId(null); },
  });

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Team Members</h2>
          <p className="page-subtitle">{data?.pagination.total || 0} members in your organization</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-azure-500 text-white text-sm font-medium rounded-xl hover:bg-azure-600 transition-colors shadow-lg shadow-azure-500/25"
        >
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-card rounded-xl border border-border p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email…"
            value={search}
            onChange={e => { setSearch(e.target.value); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30 focus:border-azure-500"
          />
        </div>
        
        <div className="relative flex-1 max-w-xs">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-muted/20 appearance-none focus:outline-none focus:ring-2 focus:ring-azure-500/30 focus:border-azure-500 text-foreground"
          >
            <option value="" className="bg-zinc-900 text-foreground">All Projects</option>
            {projectsData?.data?.map((project: any) => (
              <option key={project.id} value={project.id} className="bg-zinc-900 text-foreground">
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full data-table">
          <thead>
            <tr>
              <th className="text-left">Member</th>
              <th className="text-left">Designation</th>
              <th className="text-left">Projects</th>
              <th className="text-left"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 4 }).map((__, j) => (
                  <td key={j}><div className="h-4 bg-muted rounded animate-pulse w-20" /></td>
                ))}
              </tr>
            ))}
            {data?.data.map(member => (
              <tr key={member.id} className="hover:bg-muted/10 transition-colors">
                <td>
                  <div
                    onClick={() => navigate(`/members/${member.id}`)}
                    className="flex items-center gap-3 cursor-pointer group/member"
                  >
                    <div className="w-9 h-9 rounded-full bg-azure-900/40 flex items-center justify-center flex-shrink-0 overflow-hidden border border-azure-800/40 group-hover/member:border-azure-500/50 transition-colors">
                      {member.profilePictureUrl
                        ? <img src={member.profilePictureUrl} alt={member.name} className="w-full h-full object-cover" />
                        : <span className="text-azure-300 text-xs font-bold">{getInitials(member.name)}</span>
                      }
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground group-hover/member:text-azure-400 transition-colors">{member.name}</p>
                    </div>
                  </div>
                </td>
                <td><span className="text-sm text-muted-foreground">{member.designation}</span></td>
                <td>
                  <span className="text-sm font-medium">{member._count?.projectMembers || 0}</span>
                </td>
                <td>
                  <MemberMenu
                    onEdit={() => setEditMember(member)}
                    onDelete={() => setDeleteId(member.id)}
                  />
                </td>
              </tr>
            ))}
            {!isLoading && data?.data.length === 0 && (
              <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">No members found</td></tr>
            )}
          </tbody>
        </table>

      </div>

      {/* Add/Edit Modal */}
      {(showForm || editMember) && (
        <MemberFormModal
          member={editMember}
          onClose={() => { setShowForm(false); setEditMember(undefined); }}
          onSave={(fd) => {
            if (editMember) updateMember.mutate({ id: editMember.id, fd });
            else createMember.mutate(fd);
          }}
        />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-border">
            <h3 className="font-semibold text-lg mb-2">Delete Member?</h3>
            <p className="text-sm text-muted-foreground mb-6">This will permanently delete the member and all their data. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
              <button onClick={() => deleteMember.mutate(deleteId)} disabled={deleteMember.isPending}
                className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {deleteMember.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
