import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { notifyError } from '../lib/errors';
import { membersApi, projectsApi, reportsApi } from '@/lib/api';
import { Plus, Search, Pencil, Trash2, X, Upload, Loader2, MoreVertical, Filter, FileUp, FileText, Award, Download } from 'lucide-react';
import { getInitials, cn, downloadBlob } from '@/lib/utils';
import type { TeamMember, PaginatedResponse } from '@/types';
import { useAuth } from '@/context/AuthContext';
import ResetLinkDialog, { buildResetLink, type ResetLink } from '@/components/ResetLinkDialog';

interface MemberFormData {
  name: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  designation?: string;
  managerId: string;
  status: string;
  yearsOfExperience: string;
}

const INITIAL_FORM: MemberFormData = {
  name: '', email: '', phone: '', linkedinUrl: '',
  designation: '', managerId: '', status: 'Active', yearsOfExperience: ''
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
  member, onClose, onSave, isPending = false,
}: {
  member?: TeamMember;
  onClose: () => void;
  onSave: (form: FormData, cvFile: File | null) => void;
  isPending?: boolean;
}) {
  const [form, setForm] = useState<MemberFormData>(
    member ? {
      name: member.name, email: member.email || '', phone: member.phone || '',
      linkedinUrl: member.linkedinUrl || '',
      designation: member.designation,
      managerId: member.managerId || '',
      status: member.status || 'Active',
      yearsOfExperience: member.yearsOfExperience?.toString() || '',
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

  // Same race as ProjectsPage: `disabled={isPending}` only applies after React
  // re-renders, so a fast double-click fired two requests. Here the duplicate was
  // masked by the backend's unique-email constraint (the second POST 409'd) rather
  // than prevented. Set synchronously; cleared when the request settles.
  const submittingRef = useRef(false);
  useEffect(() => { if (!isPending) submittingRef.current = false; }, [isPending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
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
        <form id="member-form" onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Avatar Upload */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-azure-50 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-azure-200">
              {imagePreview
                ? <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                : <span className="text-azure-700 text-xl font-bold">{form.name ? getInitials(form.name) : '?'}</span>
              }
            </div>
            <label className="flex items-center gap-2 text-sm text-azure-700 cursor-pointer hover:text-azure-800 border border-azure-200 rounded-lg px-3 py-2 hover:bg-azure-50 transition-colors">
              <Upload className="w-4 h-4" /> Upload Photo
              <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
            </label>
          </div>

          <div className="flex items-center gap-4 border border-white/5 p-3 rounded-lg bg-muted/20">
            <label className="flex items-center gap-2 text-sm text-azure-700 cursor-pointer hover:text-azure-800 border border-azure-200 rounded-lg px-3 py-2 hover:bg-azure-50 transition-colors">
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
              // Deliberately text, not url: the server accepts a bare "linkedin.com/in/me"
              // and adds the scheme. type="url" rejected that in the browser and blocked
              // the whole form submit with a tooltip that is easy to miss, so the member
              // was never created. The server is the single authority on the format.
              { label: 'LinkedIn Profile URL', key: 'linkedinUrl', placeholder: 'https://linkedin.com/in/username', type: 'text' },
              { label: 'Work experience (years)', key: 'yearsOfExperience', placeholder: '5', type: 'number' },
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
          <button type="button" onClick={onClose} disabled={isPending} className="flex-1 px-4 py-2 text-sm font-medium border border-white/5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50">Cancel</button>
          <button
            type="submit"
            form="member-form"
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-azure-500 text-white rounded-lg hover:bg-azure-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
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
  const [experienceFilter, setExperienceFilter] = useState<'ALL' | '0-2' | '3-5' | '6-10' | '10+'>('ALL');
  const [workExperienceMinimum, setWorkExperienceMinimum] = useState('');
  const [isExperienceExporting, setIsExperienceExporting] = useState(false);
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

  // TT-046: saving a member with an email creates their sign-in account. It used to be
  // given the password `firstname+xebia`; now it gets a single-use link, and this is
  // the only moment that link is available to the admin who triggered it.
  const [resetLink, setResetLink] = useState<ResetLink | null>(null);

  const showResetLinkIfIssued = (res: any) => {
    const data = res?.data ?? res;
    if (data?.resetToken) {
      setResetLink(buildResetLink(data.name ?? 'this member', data.resetToken, data.expiresInMinutes));
    }
  };

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
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowForm(false);
      setCvUploadingId(null);
      showResetLinkIfIssued(res);
    },
    onError: (err) => { setCvUploadingId(null); notifyError(err, 'Could not save the team member.'); }
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
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['members'] });
      setEditMember(undefined);
      setCvUploadingId(null);
      showResetLinkIfIssued(res);
    },
    onError: (err) => { setCvUploadingId(null); notifyError(err, 'Could not save the team member.'); }
  });

  const deleteMember = useMutation({
    mutationFn: (id: string) => membersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); setDeleteId(null); },
    onError: (err) => notifyError(err, 'Could not delete the team member.'),
  });

  const [cvUploadingId, setCvUploadingId] = useState<string | null>(null);
  // TT-148: cvUploadingId used to mean both "which row the file picker is for" and "which
  // row is currently uploading". Cancelling the picker fires no change event in most
  // browsers, so the reset never ran and the row kept a spinner and a disabled button
  // until a full reload. Two separate things, two pieces of state.
  const [cvTargetId, setCvTargetId] = useState<string | null>(null);
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
    onError: (err) => { setCvUploadingId(null); notifyError(err, 'Could not upload the CV.'); },
  });

  // Client-side filtering and sorting
  const processedMembers = useMemo(() => {
    if (!data?.data) return [];
    let list = [...data.data];

    // Filter by status
    if (statusFilter !== 'ALL') {
      list = list.filter(m => m.allocationStatus === statusFilter);
    }

    if (experienceFilter !== 'ALL') {
      list = list.filter(m => {
        const years = m.yearsOfExperience ?? 0;
        if (experienceFilter === '0-2') return years <= 2;
        if (experienceFilter === '3-5') return years >= 3 && years <= 5;
        if (experienceFilter === '6-10') return years >= 6 && years <= 10;
        return years > 10;
      });
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
  }, [data?.data, statusFilter, experienceFilter, sortBy, sortOrder]);

  const handleSort = (field: 'name' | 'status' | 'project' | 'count') => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const downloadWorkExperienceExport = async () => {
    const minimum = Number(workExperienceMinimum);
    if (!Number.isFinite(minimum) || minimum < 0) return;
    setIsExperienceExporting(true);
    try {
      const response = await reportsApi.workExperience(Math.floor(minimum));
      downloadBlob(response.data, `xebia-work-experience-${Math.floor(minimum)}-years-and-above.xlsx`);
    } catch (err) {
      notifyError(err, 'Could not generate the work experience export.');
    } finally {
      setIsExperienceExporting(false);
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              Work ex above:
              <input
                type="number"
                min="0"
                value={workExperienceMinimum}
                onChange={e => setWorkExperienceMinimum(e.target.value)}
                placeholder="3"
                className="w-16 px-2.5 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <button
              onClick={downloadWorkExperienceExport}
              disabled={isExperienceExporting || workExperienceMinimum === ''}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-secondary text-primary text-sm font-medium rounded-xl hover:bg-primary/10 border border-primary/20 transition-colors disabled:opacity-50"
            >
              {isExperienceExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download Excel
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-azure-500 text-white text-sm font-medium rounded-xl hover:bg-azure-600 transition-colors shadow-lg shadow-azure-500/25"
            >
              <Plus className="w-4 h-4" /> Add Member
            </button>
          </div>
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
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          value={experienceFilter}
          onChange={e => setExperienceFilter(e.target.value as typeof experienceFilter)}
          className="px-3 py-2 text-xs font-medium border border-border rounded-xl bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          aria-label="Filter by work experience"
        >
          <option value="ALL">All experience</option>
          <option value="0-2">0–2 years</option>
          <option value="3-5">3–5 years</option>
          <option value="6-10">6–10 years</option>
          <option value="10+">10+ years</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5 table-container overflow-hidden">
        <table className="w-full data-table">
          <thead>
            {/* TT-147: these were bare <th onClick>, so the table could only be sorted with
                a mouse and a screen reader was told nothing about the current sort. The
                button is the focusable control; aria-sort on the cell announces the state. */}
            <tr>
              <th className="text-left" aria-sort={sortBy === 'name' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button
                  type="button"
                  onClick={() => handleSort('name')}
                  className="inline-flex items-center gap-1 hover:text-azure-400 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-azure-500/50 rounded"
                >
                  Member {sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                </button>
              </th>
              <th className="text-left">Designation</th>
              <th className="text-left" aria-sort={sortBy === 'status' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button
                  type="button"
                  onClick={() => handleSort('status')}
                  className="inline-flex items-center gap-1 hover:text-azure-400 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-azure-500/50 rounded"
                >
                  Allocation Status {sortBy === 'status' && (sortOrder === 'asc' ? '▲' : '▼')}
                </button>
              </th>
              <th className="text-left" aria-sort={sortBy === 'project' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button
                  type="button"
                  onClick={() => handleSort('project')}
                  className="inline-flex items-center gap-1 hover:text-azure-400 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-azure-500/50 rounded"
                >
                  Current Project {sortBy === 'project' && (sortOrder === 'asc' ? '▲' : '▼')}
                </button>
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
                  {/* TT-147: a plain div with onClick — not focusable, not announced as a
                      control, and unreachable without a mouse. role + tabIndex + key
                      handling make it operable; the label says where it goes. */}
                  <div
                    role="link"
                    tabIndex={0}
                    aria-label={`Open ${member.name}'s profile`}
                    onClick={() => navigate(`/members/${member.id}`)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/members/${member.id}`);
                      }
                    }}
                    className="flex items-center gap-3 cursor-pointer group/member focus:outline-none focus-visible:ring-2 focus-visible:ring-azure-500/50 rounded-lg"
                  >
                    <div className="w-9 h-9 rounded-full bg-azure-50 flex items-center justify-center flex-shrink-0 overflow-hidden border border-azure-200 group-hover/member:border-azure-500/50 transition-colors">
                      {member.profilePictureUrl
                        ? <img src={member.profilePictureUrl} alt={member.name} className="w-full h-full object-cover" />
                        : <span className="text-azure-700 text-xs font-bold">{getInitials(member.name)}</span>
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
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
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
                          (member.atsScore || 0) >= 90 ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" :
                          (member.atsScore || 0) >= 80 ? "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100" :
                          (member.atsScore || 0) >= 70 ? "bg-azure-50 text-azure-700 border-azure-200 hover:bg-azure-100" :
                          (member.atsScore || 0) >= 60 ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" :
                          "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
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
                          onClick={() => { setCvTargetId(member.id); cvFileRef.current?.click(); }}
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
                        onUploadCv={() => { setCvTargetId(member.id); cvFileRef.current?.click(); }}
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
          if (file && cvTargetId) {
            setCvUploadingId(cvTargetId);
            uploadCvMutation.mutate({ id: cvTargetId, file });
          }
          setCvTargetId(null);
          e.target.value = '';
        }}
      />

      {/* Add/Edit Modal */}

      {(showForm || !!editMember) && (
        <MemberFormModal
          member={editMember}
          onClose={() => { setShowForm(false); setEditMember(undefined); }}
          isPending={createMember.isPending || updateMember.isPending}
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

      {/* Shown once: this is the only time the new member's sign-in link is available. */}
      {resetLink && <ResetLinkDialog link={resetLink} onClose={() => setResetLink(null)} />}
    </div>
  );
}
