import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { membersApi, certificationsApi, projectsApi, resumeGenerationApi } from '@/lib/api';
import type { TeamMemberProfile, AssignedCertification, ProjectMemberWithProject } from '@/types';
import { ArrowLeft, Phone, Award, FolderKanban, TrendingUp, Pencil, Upload, X, Loader2, FileText, Plus, MoreVertical, Trash2, BrainCircuit, CheckCircle2, RefreshCw, ChevronDown, ChevronUp, ThumbsUp, AlertTriangle, Lightbulb, Wand2, Download } from 'lucide-react';
import { cn, formatDate, getInitials, formatStatus, getStatusColor, getProgressColor } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

// Helper for Circular Gauge
function CircularGauge({ score, size = 64 }: { score: number, size?: number }) {
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  
  let color = "text-red-500";
  let stroke = "stroke-red-500";
  let label = "Needs Improvement";
  
  if (score >= 90) { color = "text-emerald-500"; stroke = "stroke-emerald-500"; label = "Excellent"; }
  else if (score >= 80) { color = "text-teal-500"; stroke = "stroke-teal-500"; label = "Strong"; }
  else if (score >= 70) { color = "text-azure-500"; stroke = "stroke-azure-500"; label = "Good"; }
  else if (score >= 60) { color = "text-amber-500"; stroke = "stroke-amber-500"; label = "Average"; }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90 w-full h-full">
          <circle cx={size/2} cy={size/2} r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-zinc-800" />
          <circle cx={size/2} cy={size/2} r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} className={`${stroke} transition-all duration-1000 ease-out`} />
        </svg>
        <span className={`absolute font-bold ${color}`} style={{ fontSize: size/3.5 }}>{score}</span>
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>{label}</span>
    </div>
  );
}
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
      <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-md border border-white/5">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div>
            <h2 className="font-semibold text-lg">Update Certification</h2>
            <p className="text-xs text-white/50">{assignment.certification?.name}</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">Progress ({form.progress}%)</label>
            <input type="range" min={0} max={100} value={form.progress}
              onChange={e => setForm(p => ({ ...p, progress: parseInt(e.target.value) }))}
              className="w-full accent-azure-500" />
            <div className="flex justify-between text-xs text-white/50 mt-1"><span>0%</span><span>100%</span></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))}
              className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30">
              {STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Completed On</label>
              <input type="date" value={form.completionDate} onChange={e => setForm(p => ({ ...p, completionDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Valid Till</label>
              <input type="date" value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">Credential ID</label>
            <input value={form.credentialId} onChange={e => setForm(p => ({ ...p, credentialId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30"
              placeholder="e.g. AZ-900-2024-123" />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">Certificate File</label>
            <div onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/5 rounded-xl p-4 text-center cursor-pointer hover:border-azure-500 hover:bg-azure-900/20 transition-colors bg-muted/10">
              {file
                ? <p className="text-sm text-azure-300 font-medium truncate">{file.name}</p>
                : assignment.certificateUrl
                  ? <p className="text-xs text-white/50">Certificate uploaded · click to replace</p>
                  : <>
                      <Upload className="w-6 h-6 text-white/50 mx-auto mb-1" />
                      <p className="text-xs text-white/50">Click to upload PDF, PNG, or JPG</p>
                    </>
              }
              <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
            {assignment.certificateUrl && !file && (
              <a href={assignment.certificateUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-azure-400 hover:text-azure-300 mt-1.5"
                title={assignment.originalFilename || 'View current certificate'}
              >
                <FileText className="w-3 h-3" />
                <span className="truncate max-w-[250px]">
                  {assignment.originalFilename || 'View current certificate'}
                </span>
              </a>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30 resize-none"
              placeholder="Optional notes about your progress…" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-white/5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-white/5 rounded-lg hover:bg-muted">Cancel</button>
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
        className="p-1 text-white/50 hover:text-foreground hover:bg-[#1c1926]/80 backdrop-blur-md/5 rounded-lg transition-colors" title="Options">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-30 w-44 bg-popover border border-white/5 rounded-xl shadow-xl overflow-hidden animate-fade-in">
          <button onClick={() => { setOpen(false); onEditRole(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors text-left">
            <Pencil className="w-3.5 h-3.5 text-white/50" /> Edit role
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
  const { user: currentUser } = useAuth();
  const { id } = useParams<{ id: string }>();
  const isSelf = currentUser?.teamMemberId === id;
  const isAdmin = currentUser?.role?.permissions?.manageTeam;
  const canEdit = isAdmin || isSelf;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [updateCert, setUpdateCert] = useState<AssignedCertification | undefined>();
  const [showAdd, setShowAdd] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [editRolePm, setEditRolePm] = useState<ProjectMemberWithProject | undefined>();
  const [roleInput, setRoleInput] = useState('');
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvSuccess, setCvSuccess] = useState(false);
  const cvFileRef = useRef<HTMLInputElement>(null);

  // CV Generation State
  const [showJdModal, setShowJdModal] = useState(false);
  const [jdText, setJdText] = useState('');

  const generateFixedMutation = useMutation({
    mutationFn: (memberId: string) => resumeGenerationApi.generateFixed(memberId).then(r => r.data),
    onSuccess: (data) => {
      if (data.pdfUrl) window.open(data.pdfUrl, '_blank');
      invalidate();
    }
  });

  const generateTailoredMutation = useMutation({
    mutationFn: ({ memberId, jd }: { memberId: string, jd: string }) => {
      const fd = new FormData();
      fd.append('jobDescription', jd);
      return resumeGenerationApi.generateTailored(memberId, fd).then(r => r.data);
    },
    onSuccess: (data) => {
      setShowJdModal(false);
      setJdText('');
      if (data.pdfUrl) window.open(data.pdfUrl, '_blank');
      invalidate();
    }
  });

  const uploadCvMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('cv', file);
      return membersApi.uploadCv(id!, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member'] });
      setCvSuccess(true);
      setCvError(null);
      setTimeout(() => setCvSuccess(false), 4000);
    },
    onError: (e: Error) => setCvError(e.message),
  });

  const deleteCvMutation = useMutation({
    mutationFn: () => membersApi.deleteCv(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member'] });
      setCvSuccess(false);
      setCvError(null);
    },
    onError: (e: Error) => setCvError(e.message),
  });

  const handleCvFile = (file: File) => {
    setCvError(null);
    setCvSuccess(false);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx'].includes(ext ?? '')) {
      setCvError('Only PDF and DOCX files are accepted.');
      return;
    }
    uploadCvMutation.mutate(file);
  };


  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [skillsInput, setSkillsInput] = useState('');
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [isCertsOpen, setIsCertsOpen] = useState(false);
  const [isAtsExpanded, setIsAtsExpanded] = useState(false);

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const updatePhoneMutation = useMutation({
    mutationFn: async (phone: string) => {
      const fd = new FormData();
      fd.append('phone', phone);
      return membersApi.update(id!, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member', id] });
      setIsEditingPhone(false);
    },
    onError: (err: Error) => {
      setPhoneError(err.message);
    }
  });

  const handleSavePhone = () => {
    updatePhoneMutation.mutate(phoneInput.trim());
  };

  const updateSkillsMutation = useMutation({
    mutationFn: async (skillsList: string[]) => {
      const fd = new FormData();
      skillsList.forEach(s => fd.append('skills', s));
      return membersApi.update(id!, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member', id] });
      setIsEditingSkills(false);
    },
    onError: (err: Error) => {
      setSkillsError(err.message);
    }
  });

  const handleSaveSkills = () => {
    const list = skillsInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    updateSkillsMutation.mutate(list);
  };

  const { data: member, isLoading } = useQuery<TeamMemberProfile>({
    queryKey: ['member', id],
    queryFn: () => membersApi.get(id!).then(r => r.data),
    enabled: !!id,
  });

  const { data: resumeData } = useQuery({
    queryKey: ['resume-profile', id],
    queryFn: () => membersApi.getResumeProfile(id!).then(r => r.data).catch(() => null),
    enabled: !!id,
  });
  const resumeProfile = resumeData?.resumeProfile;
  // const generatedResumes = resumeData?.generatedResumes || [];

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
        <div className="h-48 bg-[#1c1926]/80 backdrop-blur-md rounded-2xl border border-white/5" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5" />)}
        </div>
      </div>
    );
  }

  if (!member) return <div className="text-center py-20 text-white/50">Member not found</div>;

  const { stats } = member;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button onClick={() => navigate('/members')}
        className="flex items-center gap-2 text-sm text-white/50 hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Members
      </button>

      {/* Profile Header Card */}
      <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden">
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
              <p className="text-white/50">{member.designation}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
            {member.manager && (
              <div className="flex items-center gap-2 text-sm text-white/50 col-span-2 md:col-span-1">
                <span>👤 Reports to: <strong className="text-foreground">{member.manager.name}</strong></span>
              </div>
            )}
          </div>



        </div>
      </div>

      {/* Resource Allocation Section */}
      <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5 p-5 space-y-4">
        <h3 className="font-semibold text-sm">Resource Allocation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Status Badge */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">Allocation Status</span>
            <div>
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                member.allocationStatus === 'ALLOCATED'
                  ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/30'
                  : 'bg-amber-950/30 text-amber-400 border-amber-800/30'
              )}>
                <span className={cn('w-1.5 h-1.5 rounded-full', member.allocationStatus === 'ALLOCATED' ? 'bg-emerald-500' : 'bg-amber-500')} />
                {member.allocationStatus === 'ALLOCATED' ? 'Allocated' : 'Benched'}
              </span>
            </div>
          </div>

          {/* Allocation Percentage */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">Total Allocation</span>
            <span className="text-xl font-bold text-azure-400">
              {member.allocationStatus === 'ALLOCATED' ? '100%' : '0%'}
            </span>
          </div>

          {/* Reporting Manager */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">Reporting Manager</span>
            <span className="text-sm font-semibold text-foreground">
              {member.manager ? member.manager.name : 'No Manager Assigned'}
            </span>
          </div>
        </div>

        {/* Active Projects List */}
        {member.allocationStatus === 'ALLOCATED' && (
          <div className="mt-4 border-t border-white/5 pt-4">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-3">Active Project(s) Details</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {member.projectMembers
                .filter(pm => pm.project && pm.project.status !== 'COMPLETED')
                .map(pm => {
                  const activeCount = member.projectMembers.filter(p => p.project && p.project.status !== 'COMPLETED').length;
                  const allocPercent = Math.round(100 / activeCount);
                  return (
                    <div key={pm.id} className="p-3.5 rounded-xl bg-black/30 border border-white/10/40 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-bold text-foreground">{pm.project.name}</span>
                        <span className="text-[10px] font-semibold bg-azure-950/40 text-azure-400 border border-azure-800/30 px-2 py-0.5 rounded-lg">
                          {allocPercent}% Allocation
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-white/50 pt-1.5 border-t border-white/5/20">
                        <div>
                          <span>Start Date: </span>
                          <strong className="text-foreground">{formatDate(pm.project.startDate)}</strong>
                        </div>
                        <div>
                          <span>Expected Release: </span>
                          <strong className="text-foreground">{pm.project.endDate ? formatDate(pm.project.endDate) : 'No End Date'}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Certs', value: stats.totalCertifications, icon: Award, color: 'text-indigo-400', bg: 'bg-indigo-950/40' },
          { label: 'Completed', value: stats.completedCertifications, icon: Award, color: 'text-green-400', bg: 'bg-green-950/40' },
          { label: 'Total Projects', value: stats.totalProjects, icon: FolderKanban, color: 'text-purple-400', bg: 'bg-purple-950/40' },
          { label: 'Active Projects', value: stats.activeProjects, icon: TrendingUp, color: 'text-azure-400', bg: 'bg-azure-950/40' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5 p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', bg)}>
              <Icon className={cn('w-5 h-5', color)} />
            </div>
            <div>
              <p className="text-xs text-white/50">{label}</p>
              <p className={cn('text-2xl font-bold', color)}>{value}</p>
            </div>
          </div>
        ))}
      </div>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Contacts Card */}
        <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5 p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4 w-full">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              <h3 className="font-semibold text-sm">Contacts</h3>
            </div>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">Email</span>
                <span className="text-sm font-medium text-foreground break-all">
                  {member.email || 'No email provided'}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">Phone Number</span>
                  {!isEditingPhone ? (
                    canEdit && (
                      <button
                        onClick={() => {
                          setPhoneInput(member.phone || '');
                          setIsEditingPhone(true);
                          setPhoneError(null);
                        }}
                        className="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    )
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSavePhone}
                        disabled={updatePhoneMutation.isPending}
                        className="text-[10px] font-bold text-azure-400 hover:text-azure-300 disabled:opacity-50"
                      >
                        {updatePhoneMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <span className="text-white/50 text-[10px]">|</span>
                      <button
                        onClick={() => setIsEditingPhone(false)}
                        className="text-[10px] font-bold text-red-400 hover:text-red-300"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {phoneError && (
                  <div className="text-[10px] text-red-400 p-1">
                    {phoneError}
                  </div>
                )}

                {isEditingPhone ? (
                  <input
                    type="text"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full mt-1 px-3 py-1.5 text-sm border border-white/5 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                  />
                ) : (
                  <span className="text-sm font-medium text-foreground">
                    {member.phone || 'No phone number added'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* CV Card */}
        <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5 p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4 w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h3 className="font-semibold text-sm">CV</h3>
              </div>
              <div className="flex items-center gap-2">
                {member.cvUploadedAt && (
                  <span className="text-[10px] text-white/50">
                    Last updated {new Date(member.cvUploadedAt).toLocaleDateString()}
                  </span>
                )}
                {canEdit && (
                  <>
                    <button
                      onClick={() => cvFileRef.current?.click()}
                      disabled={uploadCvMutation.isPending}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60 shadow-sm shadow-indigo-500/20"
                    >
                      {uploadCvMutation.isPending
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : member.cvUploadedAt
                          ? <RefreshCw className="w-3.5 h-3.5" />
                          : <Upload className="w-3.5 h-3.5" />
                      }
                      {uploadCvMutation.isPending ? 'Uploading...' : member.cvUploadedAt ? 'Re-upload CV' : 'Upload CV'}
                    </button>
                    {member.cvBlobUrl && (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to remove the CV?')) {
                            deleteCvMutation.mutate();
                          }
                        }}
                        disabled={deleteCvMutation.isPending}
                        className="flex items-center justify-center p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Remove CV"
                      >
                        {deleteCvMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    )}
                  </>
                )}
                <input
                  ref={cvFileRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleCvFile(f); e.target.value = ''; }}
                />
              </div>
            </div>

            {/* Status messages */}
            {cvError && (
              <div className="flex items-center gap-2 p-3 bg-red-950/30 border border-red-800/40 rounded-lg text-xs text-red-400">
                <X className="w-3.5 h-3.5 flex-shrink-0" /> {cvError}
              </div>
            )}
            {cvSuccess && (
              <div className="flex items-center gap-2 p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> CV uploaded successfully!
              </div>
            )}
            {uploadCvMutation.isPending && (
              <div className="flex items-center gap-2 p-3 bg-indigo-950/30 border border-indigo-800/30 rounded-lg text-xs text-indigo-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                Uploading and extracting text...
              </div>
            )}

            {member.cvBlobUrl ? (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 p-3 bg-emerald-950/20 border border-emerald-800/30 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-xs text-emerald-400 font-medium">CV Document Active</span>
                </div>
                <div className="pt-1">
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-2">Azure ADLS Gen2 Location</span>
                  <a
                    href={member.cvBlobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 font-semibold transition-colors bg-indigo-950/30 border border-indigo-800/30 px-3.5 py-2 rounded-xl shadow-sm"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="truncate max-w-[200px]" title={member.cvOriginalFilename || 'View CV Document'}>
                      {member.cvOriginalFilename || 'View CV Document'}
                    </span>
                  </a>
                  
                  {/* CV Generation Actions */}
                  {resumeProfile && (
                    <div className="pt-3 border-t border-white/5 mt-3 flex items-center gap-3">
                      <button
                        onClick={() => generateFixedMutation.mutate(member.id)}
                        disabled={generateFixedMutation.isPending}
                        className="flex-1 flex justify-center items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {generateFixedMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Generate CV
                      </button>
                      <button
                        onClick={() => setShowJdModal(true)}
                        className="flex-1 flex justify-center items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        Tailored CV
                      </button>
                    </div>
                  )}
                </div>
                
                {/* ATS Breakdown Details */}
                {member.atsScoreBreakdown && (
                  <div className="pt-4 mt-6 border-t border-white/5/50">
                    <div className="flex items-start gap-6 mb-6">
                      {/* Left: Gauge */}
                      <div className="flex-shrink-0">
                        <CircularGauge score={member.atsScore || 0} size={80} />
                      </div>
                      
                      {/* Right: Intro */}
                      <div className="flex flex-col justify-center">
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <BrainCircuit className="w-4 h-4 text-indigo-400" />
                          ATS Resume Analysis
                        </h4>
                        <p className="text-xs text-white/50 mt-1 max-w-sm leading-relaxed">
                          This resume has been scored on a 100-point rubric across 8 key dimensions. Expand the sections below to see the exact breakdown and AI feedback.
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => setIsAtsExpanded(!isAtsExpanded)}
                      className="w-full text-xs font-semibold text-foreground flex items-center justify-between hover:bg-muted/50 p-2.5 -ml-2 rounded-lg transition-colors group"
                    >
                      <span className="flex items-center gap-2 text-indigo-400">
                        View Detailed Breakdown
                      </span>
                      {isAtsExpanded ? <ChevronUp className="w-4 h-4 text-white/50" /> : <ChevronDown className="w-4 h-4 text-white/50" />}
                    </button>
                    
                    {isAtsExpanded && (
                      <div className="mt-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200 pb-2">
                        {/* 8 Categories Progress Bars */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                          {[
                            { label: 'Contact Information', score: member.atsScoreBreakdown.contact_information, max: 10 },
                            { label: 'ATS Formatting', score: member.atsScoreBreakdown.ats_formatting, max: 15 },
                            { label: 'Skills Match', score: member.atsScoreBreakdown.skills_match, max: 25 },
                            { label: 'Work Experience', score: member.atsScoreBreakdown.work_experience, max: 20 },
                            { label: 'Education', score: member.atsScoreBreakdown.education, max: 10 },
                            { label: 'Projects', score: member.atsScoreBreakdown.projects, max: 10 },
                            { label: 'Certifications', score: member.atsScoreBreakdown.certifications, max: 5 },
                            { label: 'Keywords', score: member.atsScoreBreakdown.keywords, max: 5 },
                          ].map(dim => {
                            if (dim.score === undefined) return null;
                            const percent = Math.max(0, Math.min(100, (dim.score / dim.max) * 100));
                            let barColor = 'bg-red-500';
                            if (percent >= 90) barColor = 'bg-emerald-500';
                            else if (percent >= 80) barColor = 'bg-teal-500';
                            else if (percent >= 70) barColor = 'bg-azure-500';
                            else if (percent >= 60) barColor = 'bg-amber-500';

                            return (
                              <div key={dim.label} className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-bold text-white/50 uppercase tracking-wider">
                                  <span>{dim.label}</span>
                                  <span className={barColor.replace('bg-', 'text-')}>{dim.score} / {dim.max}</span>
                                </div>
                                <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-white/5/50">
                                  <div 
                                    className={`${barColor} h-2 rounded-full transition-all duration-1000`} 
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* AI Feedback Cards */}
                        {member.atsSuggestions && typeof member.atsSuggestions === 'object' && (
                          <div className="grid grid-cols-1 gap-3 pt-2">
                            {member.atsSuggestions.strengths && Array.isArray(member.atsSuggestions.strengths) && member.atsSuggestions.strengths.length > 0 && (
                              <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-xl space-y-2">
                                <h5 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <ThumbsUp className="w-3.5 h-3.5" /> Strengths
                                </h5>
                                <ul className="list-disc pl-5 space-y-1">
                                  {member.atsSuggestions.strengths.map((s: string, i: number) => (
                                    <li key={i} className="text-xs text-emerald-100/70 leading-relaxed">{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {member.atsSuggestions.weaknesses && Array.isArray(member.atsSuggestions.weaknesses) && member.atsSuggestions.weaknesses.length > 0 && (
                              <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-xl space-y-2">
                                <h5 className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5" /> Weaknesses
                                </h5>
                                <ul className="list-disc pl-5 space-y-1">
                                  {member.atsSuggestions.weaknesses.map((w: string, i: number) => (
                                    <li key={i} className="text-xs text-red-100/70 leading-relaxed">{w}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {member.atsSuggestions.recommendations && Array.isArray(member.atsSuggestions.recommendations) && member.atsSuggestions.recommendations.length > 0 && (
                              <div className="p-4 bg-amber-950/20 border border-amber-900/30 rounded-xl space-y-2">
                                <h5 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <Lightbulb className="w-3.5 h-3.5" /> Recommendations
                                </h5>
                                <ul className="list-disc pl-5 space-y-1">
                                  {member.atsSuggestions.recommendations.map((r: string, i: number) => (
                                    <li key={i} className="text-xs text-amber-100/70 leading-relaxed">{r}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              !uploadCvMutation.isPending && (
                <div className="flex items-center gap-2.5 p-3.5 bg-black/30 border border-white/10/50 rounded-xl">
                  <BrainCircuit className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <p className="text-xs text-white/50">
                    No CV uploaded yet. Upload a PDF/DOCX using the button above.
                  </p>
                </div>
              )
            )}
          </div>
        </div>

        {/* Skills & Expertise Card */}
        <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5 p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4 w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-azure-400" />
                <h3 className="font-semibold text-sm">Skills & Expertise</h3>
              </div>
              
              {!isEditingSkills ? (
                canEdit && (
                  <button
                    onClick={() => {
                      setSkillsInput(member.skills.join(', '));
                      setIsEditingSkills(true);
                      setSkillsError(null);
                    }}
                    className="text-xs font-medium text-azure-400 hover:text-azure-300 flex items-center gap-1 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit Skills
                  </button>
                )
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveSkills}
                    disabled={updateSkillsMutation.isPending}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                  >
                    {updateSkillsMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <span className="text-white/50 text-[10px]">|</span>
                  <button
                    onClick={() => setIsEditingSkills(false)}
                    className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {resumeProfile?.summary && (
              <div className="mb-2">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1">Resume Summary</span>
                <p className="text-xs text-white/70 leading-relaxed italic border-l-2 border-azure-500/30 pl-3 py-1">
                  "{resumeProfile.summary}"
                </p>
              </div>
            )}

            {skillsError && (
              <div className="text-xs text-red-400 p-2.5 bg-red-950/20 border border-red-800/30 rounded-lg">
                {skillsError}
              </div>
            )}

            {isEditingSkills ? (
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider">
                  Enter skills (comma separated)
                </label>
                <textarea
                  value={skillsInput}
                  onChange={e => setSkillsInput(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30 text-foreground resize-none"
                  placeholder="React, Node.js, TypeScript, Docker..."
                />
              </div>
            ) : (resumeProfile?.skills || member.skills).length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {(resumeProfile?.skills || member.skills).map((skill: string, i: number) => (
                  <span key={i} className="px-2.5 py-0.5 bg-azure-950/40 text-azure-300 border border-azure-800/40 rounded-full text-xs font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/50">
                No skills added yet. Upload a CV to auto-extract, or click Edit to add skills manually.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Current Projects */}
        <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Current Projects</h3>
            {canEdit && (
              <button onClick={() => setShowAddProject(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-azure-500 text-white rounded-lg hover:bg-azure-600 transition-colors shadow-sm shadow-azure-500/25">
                <Plus className="w-3.5 h-3.5" /> Add to Project
              </button>
            )}
          </div>
          {member.projectMembers.length === 0
            ? <p className="text-sm text-white/50">Not assigned to any projects — click <strong className="text-foreground">Add to Project</strong> to assign one.</p>
            : <div className="space-y-3">
                {member.projectMembers.map(pm => (
                  <div key={pm.id} className="p-3 rounded-lg bg-muted/30 border border-white/5/50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{pm.project.name}</p>
                        {pm.role && <p className="text-xs text-white/50">{pm.role}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', getStatusColor(pm.project.status))}>
                          {formatStatus(pm.project.status)}
                        </span>
                        {canEdit && (
                          <ProjectMenu
                            onEditRole={() => { setRoleInput(pm.role || ''); setEditRolePm(pm); }}
                            onRemove={() => removeProject.mutate(pm)}
                          />
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-white/50 mb-1">
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
        <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5 p-5 h-fit transition-all duration-200">
          <div
            onClick={() => setIsCertsOpen(prev => !prev)}
            className="flex items-center justify-between cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Certifications</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-white/50 font-semibold">
                {member.assignedCertifications.length}
              </span>
            </div>
            <div className="flex items-center gap-2.5" onClick={e => e.stopPropagation()}>
              {canEdit && (
                <button onClick={() => setShowAdd(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-azure-500 text-white rounded-lg hover:bg-azure-600 transition-colors shadow-sm shadow-azure-500/25">
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
              <ChevronDown className={cn("w-4 h-4 text-white/50 transition-transform duration-200", isCertsOpen && "rotate-180")} />
            </div>
          </div>

          {isCertsOpen && (
            <div className="mt-4 pt-4 border-t border-white/5/40 space-y-3 animate-fade-in">
              {member.assignedCertifications.length === 0 ? (
                <p className="text-sm text-white/50">No certifications yet — click <strong className="text-foreground">Add</strong> to log one.</p>
              ) : (
                <div className="space-y-3">
                  {member.assignedCertifications.map(ac => (
                    <div key={ac.id} className="p-3 rounded-lg bg-muted/30 border border-white/5/50">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{ac.certification?.name}</p>
                          <p className="text-xs text-white/50">{ac.certification?.provider}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', getStatusColor(ac.status))}>
                            {formatStatus(ac.status)}
                          </span>
                          {canEdit && (
                            <button onClick={() => setUpdateCert(ac)} title="Update certification"
                              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border border-azure-800/40 text-azure-300 hover:bg-azure-900/30 hover:text-azure-200 transition-colors">
                              <Pencil className="w-3 h-3" /> Update
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-white/50 mb-1">
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
              )}
            </div>
          )}
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
          <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-sm border border-white/5">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div>
                <h2 className="font-semibold text-lg">Edit Role</h2>
                <p className="text-xs text-white/50">{editRolePm.project.name}</p>
              </div>
              <button onClick={() => setEditRolePm(undefined)} className="text-white/50 hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <label className="block text-xs font-medium text-white/50 mb-1">Role</label>
              <input value={roleInput} onChange={e => setRoleInput(e.target.value)} autoFocus
                className="w-full px-3 py-2 text-sm border border-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                placeholder="e.g. Developer, Analyst (leave blank to clear)" />
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={() => setEditRolePm(undefined)} className="flex-1 px-4 py-2 text-sm border border-white/5 rounded-lg hover:bg-muted">Cancel</button>
              <button onClick={() => updateRole.mutate({ pm: editRolePm, role: roleInput })} disabled={updateRole.isPending}
                className="flex-1 px-4 py-2 text-sm bg-azure-500 text-white rounded-lg hover:bg-azure-600 disabled:opacity-60 flex items-center justify-center gap-2">
                {updateRole.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JD Modal for Tailored CV Generation */}
      {showJdModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-lg border border-white/5">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div>
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-purple-400" />
                  Tailor CV to Job Description
                </h2>
                <p className="text-xs text-white/50 mt-1">Paste the target JD below. The AI will curate and re-weight existing skills to match.</p>
              </div>
              <button onClick={() => setShowJdModal(false)} className="text-white/50 hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <textarea
                value={jdText}
                onChange={e => setJdText(e.target.value)}
                placeholder="Paste JD here..."
                className="w-full h-48 bg-zinc-950 border border-white/10 rounded-lg p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none font-mono"
              />
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={() => setShowJdModal(false)} className="flex-1 px-4 py-2 text-sm border border-white/5 rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button 
                onClick={() => member?.id && generateTailoredMutation.mutate({ memberId: member.id, jd: jdText })} 
                disabled={generateTailoredMutation.isPending || !jdText.trim()}
                className="flex-1 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
              >
                {generateTailoredMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                ) : (
                  <><Wand2 className="w-4 h-4" /> Generate PDF</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
