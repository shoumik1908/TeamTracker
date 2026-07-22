import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { membersApi, projectsApi } from '@/lib/api';
import { Plus, Search, Pencil, Trash2, X, Upload, Loader2, MoreVertical, Filter, FileUp, FileText, Award } from 'lucide-react';
import { getInitials, cn } from '@/lib/utils';
import type { TeamMember, PaginatedResponse } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface MemberFormData {
  name: string;
  email: string;
  phone: string;
  designation?: string;
  managerId: string;
  status: string;
}

const INITIAL_FORM: MemberFormData = {
  name: '', email: '', phone: '',
  designation: '', managerId: '', status: 'Active'
};

function MemberMenu({ onEdit, onDelete, onUploadCv }: {
  onEdit: () => void;
  onDelete: () => void;
  onUploadCv: () => void;
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
        className="p-1.5 text-white/50 hover:text-foreground hover:bg-[#1c1926]/80 backdrop-blur-md/5 rounded-lg transition-colors"
        title="Options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-30 w-44 bg-popover border border-white/5 rounded-xl shadow-xl overflow-hidden animate-fade-in">
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors text-left"
          >
            <Pencil className="w-3.5 h-3.5 text-white/50" />
            Edit
          </button>
          <button
            onClick={() => { setOpen(false); onUploadCv(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-indigo-400 hover:bg-indigo-950/40 transition-colors text-left"
          >
            <FileUp className="w-3.5 h-3.5" />
            Upload CV
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
  onSave: (form: FormData, cvFile: File | null) => void;
}) {
  const [form, setForm] = useState<MemberFormData>(
    member ? {
      name: member.name, email: member.email || '', phone: member.phone || '',
      designation: member.designation,
      managerId: member.managerId || '',
      status: member.status || 'Active',
    } : INITIAL_FORM
  );
  const { data: allMembers } = useQuery<PaginatedResponse<TeamMember>>({
    queryKey: ['members-form-list'],
    queryFn: () => membersApi.list({ limit: 100 }).then(r => r.data),
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(member?.profilePictureUrl || null);
  const [cvFile, setCvFile] = useState<File | null>(null);

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
    Object.entries(form).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        fd.append(k, v);
      }
    });
    if (imageFile) fd.append('profilePicture', imageFile);
    if (!member) {
      fd.append('joiningDate', new Date().toISOString());
    }
    onSave(fd, cvFile);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/5">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="font-semibold text-lg">{member ? 'Edit Member' : 'Add Team Member'}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-foreground"><X className="w-5 h-5" /></button>
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

          <div className="flex items-center gap-4 border border-white/5 p-3 rounded-lg bg-muted/20">
            <label className="flex items-center gap-2 text-sm text-azure-300 cursor-pointer hover:text-azure-400 border border-azure-800/40 rounded-lg px-3 py-2 hover:bg-azure-900/20 transition-colors">
              <FileText className="w-4 h-4" /> {cvFile ? 'Change CV' : 'Upload CV'}
              <input type="file" accept=".pdf,.docx" className="hidden" onChange={e => {
                const f = e.target.files?.[0];
                if (f) setCvFile(f);
                e.target.value = '';
              }} />
            </label>
            {cvFile && <span className="text-xs text-white/50 truncate flex-1" title={cvFile.name}>{cvFile.name}</span>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Full Name *', key: 'name', placeholder: 'Alice Johnson', required: true, type: 'text' },
              { label: 'Email *', key: 'email', placeholder: 'alice@example.com', required: true, type: 'email' },
              { label: 'Phone', key: 'phone', placeholder: '+1-555-0101', type: 'text' },
              { label: 'Designation', key: 'designation', placeholder: 'Senior Engineer', type: 'text' },
            ].map(({ label, key, placeholder, required, type }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-white/50 mb-1">{label}</label>
                <input
                  type={type}
                  required={required}
                  placeholder={placeholder}
                  value={form[key as keyof MemberFormData]}
                  onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30 focus:border-azure-400"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Reporting Manager / Head</label>
              <select value={form.managerId} onChange={e => setForm(p => ({ ...p, managerId: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30 focus:border-azure-400">
                <option value="">No Manager Assigned</option>
                {allMembers?.data.filter(m => m.id !== member?.id).map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.designation})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30 focus:border-azure-400">
                <option value="Active">Active</option>
                <option value="Benched">Benched</option>
              </select>
            </div>
          </div>

        </form>
        <div className="flex gap-3 px-6 py-4 border-t border-white/5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium border border-white/5 rounded-lg hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleSubmit as any} className="flex-1 px-4 py-2 text-sm font-medium bg-azure-500 text-white rounded-lg hover:bg-azure-600 transition-colors">
            {member ? 'Save Changes' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MembersPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role?.permissions?.manageTeam;

  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams.get('action') === 'new');
  const [editMember, setEditMember] = useState<TeamMember | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Status Filter: ALL, ALLOCATED, BENCHED
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ALLOCATED' | 'BENCHED'>('ALL');
  // Sort state
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'project' | 'count'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data: projectsData } = useQuery({
    queryKey: ['projects-filter'],
    queryFn: () => projectsApi.list({ limit: 100 }).then(r => r.data),
  });

  const { data, isLoading } = useQuery<PaginatedResponse<TeamMember>>({
    queryKey: ['members', search, projectId],
    queryFn: () => membersApi.list({ search, projectId, limit: 1000 }).then(r => r.data),
  });

  const createMember = useMutation({
    mutationFn: async ({ fd, cvFile }: { fd: FormData; cvFile: File | null }) => {
      const res = await membersApi.create(fd);
      const newMemberId = res.data?.id;
      if (cvFile && newMemberId) {
        setCvUploadingId(newMemberId);
        const cvFd = new FormData();
        cvFd.append('cv', cvFile);
        await membersApi.uploadCv(newMemberId, cvFd);
      }
      return res;
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['members'] }); 
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); 
      setShowForm(false); 
      setCvUploadingId(null);
    },
    onError: () => setCvUploadingId(null)
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, fd, cvFile }: { id: string; fd: FormData; cvFile: File | null }) => {
      const res = await membersApi.update(id, fd);
      if (cvFile) {
        setCvUploadingId(id);
        const cvFd = new FormData();
        cvFd.append('cv', cvFile);
        await membersApi.uploadCv(id, cvFd);
      }
      return res;
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['members'] }); 
      setEditMember(undefined); 
      setCvUploadingId(null);
    },
    onError: () => setCvUploadingId(null)
  });

  const deleteMember = useMutation({
    mutationFn: (id: string) => membersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); setDeleteId(null); },
  });

  const [cvUploadingId, setCvUploadingId] = useState<string | null>(null);
  const cvFileRef = useRef<HTMLInputElement>(null);

  const uploadCvMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append('cv', file);
      return membersApi.uploadCv(id, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] });
      setCvUploadingId(null);
    },
    onError: () => setCvUploadingId(null),
  });

  // Client-side filtering and sorting
  const processedMembers = useMemo(() => {
    if (!data?.data) return [];
    let list = [...data.data];

    // Filter by status
    if (statusFilter !== 'ALL') {
      list = list.filter(m => m.allocationStatus === statusFilter);
    }

    // Sort list
    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'status') {
        const aStatus = a.allocationStatus || 'BENCHED';
        const bStatus = b.allocationStatus || 'BENCHED';
        comparison = aStatus.localeCompare(bStatus);
      } else if (sortBy === 'project') {
        const aProj = a.currentProjectName || '';
        const bProj = b.currentProjectName || '';
        comparison = aProj.localeCompare(bProj);
      } else if (sortBy === 'count') {
        const aCount = a.activeProjectsCount || 0;
        const bCount = b.activeProjectsCount || 0;
        comparison = aCount - bCount;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [data?.data, statusFilter, sortBy, sortOrder]);

  const handleSort = (field: 'name' | 'status' | 'project' | 'count') => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Team Members</h2>
          <p className="page-subtitle">{data?.pagination.total || 0} members in your organization</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-azure-500 text-white text-sm font-medium rounded-xl hover:bg-azure-600 transition-colors shadow-lg shadow-azure-500/25"
          >
            <Plus className="w-4 h-4" /> Add Member
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col sm:flex-row flex-1 gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <input
              type="text"
              placeholder="Search by name, email…"
              value={search}
              onChange={e => { setSearch(e.target.value); }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-white/5 rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30 focus:border-azure-500"
            />
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-white/5 rounded-lg bg-muted/20 appearance-none focus:outline-none focus:ring-2 focus:ring-azure-500/30 focus:border-azure-500 text-foreground"
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

        {/* Quick Filters */}
        <div className="flex items-center gap-1 bg-muted/10 p-1 border border-white/5 rounded-xl self-start md:self-auto">
          {[
            { label: 'All', value: 'ALL' },
            { label: 'Allocated', value: 'ALLOCATED' },
            { label: 'Benched', value: 'BENCHED' },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value as any)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                statusFilter === tab.value
                  ? 'bg-azure-500 text-white shadow-sm'
                  : 'text-white/50 hover:text-foreground hover:bg-white/5'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5 table-container overflow-hidden">
        <table className="w-full data-table">
          <thead>
            <tr>
              <th className="text-left cursor-pointer hover:text-azure-400 select-none" onClick={() => handleSort('name')}>
                Member {sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th className="text-left">Designation</th>
              <th className="text-left cursor-pointer hover:text-azure-400 select-none" onClick={() => handleSort('status')}>
                Allocation Status {sortBy === 'status' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th className="text-left cursor-pointer hover:text-azure-400 select-none" onClick={() => handleSort('project')}>
                Current Project {sortBy === 'project' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th className="text-left">CV</th>
              <th className="text-left"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 6 }).map((__, j) => (
                  <td key={j}><div className="h-4 bg-muted rounded animate-pulse w-20" /></td>
                ))}
              </tr>
            ))}
            {processedMembers.map(member => (
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
                <td><span className="text-sm text-white/50">{member.designation}</span></td>
                <td>
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                    member.allocationStatus === 'ALLOCATED'
                      ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/30'
                      : 'bg-amber-950/30 text-amber-400 border-amber-800/30'
                  )}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', member.allocationStatus === 'ALLOCATED' ? 'bg-emerald-500' : 'bg-amber-500')} />
                    {member.allocationStatus === 'ALLOCATED' ? 'Allocated' : 'Benched'}
                  </span>
                </td>
                <td>
                  {member.currentProjectName ? (
                    <div className="relative group/tooltip inline-block">
                      <span className="text-sm text-foreground font-medium">
                        {member.currentProjectName}
                        {member.activeProjectsCount && member.activeProjectsCount > 1 && ` (+${member.activeProjectsCount - 1} more)`}
                      </span>
                      {member.activeProjectNames && member.activeProjectNames.length > 1 && (
                        <div className="absolute bottom-full mb-2 left-0 hidden group-hover/tooltip:block z-50 animate-fade-in pointer-events-none">
                          <div className="bg-popover border border-white/5 text-foreground text-xs rounded-lg py-2 px-3 shadow-xl whitespace-nowrap">
                            {member.activeProjectNames.map((proj, i) => (
                              <div key={i} className="mb-1 last:mb-0">• {proj}</div>
                            ))}
                          </div>
                          <div className="absolute top-full left-4 -translate-x-1/2 -mt-px border-4 border-transparent border-t-border" />
                          <div className="absolute top-full left-4 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-popover" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-white/50">—</span>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    {member.cvBlobUrl ? (
                      <a
                        href={member.cvBlobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors",
                          (member.atsScore || 0) >= 90 ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/30 hover:bg-emerald-900/30" :
                          (member.atsScore || 0) >= 80 ? "bg-teal-950/30 text-teal-400 border-teal-800/30 hover:bg-teal-900/30" :
                          (member.atsScore || 0) >= 70 ? "bg-azure-950/30 text-azure-400 border-azure-800/30 hover:bg-azure-900/30" :
                          (member.atsScore || 0) >= 60 ? "bg-amber-950/30 text-amber-400 border-amber-800/30 hover:bg-amber-900/30" :
                          "bg-red-950/30 text-red-400 border-red-800/30 hover:bg-red-900/30"
                        )}
                        title="Click to view CV"
                      >
                        <div className="flex items-center gap-1">
                          <Award className="w-3.5 h-3.5" />
                          <span>ATS Score: {member.atsScore}</span>
                        </div>
                      </a>
                    ) : (
                      (isAdmin || currentUser?.teamMemberId === member.id) ? (
                        <button
                          onClick={() => { setCvUploadingId(member.id); cvFileRef.current?.click(); }}
                          disabled={cvUploadingId === member.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted hover:bg-muted-foreground/10 text-white/50 transition-colors border border-white/5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload</span>
                        </button>
                      ) : (
                        <span className="text-sm text-white/50">—</span>
                      )
                    )}
                  </div>
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    {cvUploadingId === member.id && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    )}
                    {(isAdmin || currentUser?.teamMemberId === member.id) && (
                      <MemberMenu
                        onEdit={() => setEditMember(member)}
                        onDelete={() => setDeleteId(member.id)}
                        onUploadCv={() => { setCvUploadingId(member.id); cvFileRef.current?.click(); }}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && processedMembers.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-white/50">No members found</td></tr>
            )}
          </tbody>
        </table>

      </div>

      {/* CV file input (shared, triggered by row menu) */}
      <input
        ref={cvFileRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file && cvUploadingId) {
            uploadCvMutation.mutate({ id: cvUploadingId, file });
          } else {
            setCvUploadingId(null);
          }
          e.target.value = '';
        }}
      />

      {/* Add/Edit Modal */}

      {(showForm || !!editMember) && (
        <MemberFormModal
          member={editMember}
          onClose={() => { setShowForm(false); setEditMember(undefined); }}
          onSave={(fd, cvFile) => {
            if (editMember) {
              updateMember.mutate({ id: editMember.id, fd, cvFile });
            } else {
              createMember.mutate({ fd, cvFile });
            }
          }}
        />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-white/5">
            <h3 className="font-semibold text-lg mb-2">Delete Member?</h3>
            <p className="text-sm text-white/50 mb-6">This will permanently delete the member and all their data. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 text-sm border border-white/5 rounded-lg hover:bg-muted">Cancel</button>
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
