import { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certificationsApi, membersApi, DuplicateCertificateError } from '@/lib/api';
import { Search, Upload, Pencil, Trash2, FileText, ChevronDown, ChevronUp, X, Loader2, Plus, MoreVertical, AlertTriangle } from 'lucide-react';
import { cn, formatDate, formatStatus, getStatusColor, getInitials } from '@/lib/utils';
import type { AssignedCertification, PaginatedResponse, TeamMember, Certification } from '@/types';
import AddCertificationModal from '@/components/AddCertificationModal';

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'EXPIRED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function QuickUpdateMenu({
  onEdit, onDelete, onDeleteCertificate
}: {
  onEdit: () => void;
  onDelete: () => void;
  onDeleteCertificate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg transition-colors"
        title="Quick Update"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-8 z-40 w-48 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-in">
          {/* Actions Section */}
          <div className="py-1">
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-muted/40 transition-colors text-left"
            >
              <Pencil className="w-3 h-3 text-muted-foreground" /> Edit
            </button>

            {onDeleteCertificate && (
              <button
                onClick={() => { setOpen(false); onDeleteCertificate(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:bg-red-950/40 transition-colors text-left border-b border-border/30"
              >
                <Trash2 className="w-3 h-3 text-red-400" /> Delete Certificate
              </button>
            )}

            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:bg-red-950/40 transition-colors text-left"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AssignModal({ onClose, onSave }: { onClose: () => void; onSave: (d: Record<string, string>) => void }) {
  const [form, setForm] = useState({ memberId: '', certificationId: '', deadline: '', priority: 'MEDIUM', notes: '' });

  const { data: members } = useQuery<PaginatedResponse<TeamMember>>({
    queryKey: ['members-simple'],
    queryFn: () => membersApi.list({ limit: 100 }).then(r => r.data),
  });
  const { data: certs } = useQuery<PaginatedResponse<Certification>>({
    queryKey: ['certs-simple'],
    queryFn: () => certificationsApi.list({ limit: 100 }).then(r => r.data),
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">Assign Certification</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Team Member *</label>
            <select value={form.memberId} onChange={e => setForm(p => ({ ...p, memberId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30">
              <option value="">Select member...</option>
              {members?.data.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Certification *</label>
            <select value={form.certificationId} onChange={e => setForm(p => ({ ...p, certificationId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30">
              <option value="">Select certification...</option>
              {certs?.data.map(c => <option key={c.id} value={c.id}>{c.name} – {c.provider}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Deadline *</label>
              <input type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30">
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30 resize-none"
              placeholder="Optional notes..." />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
          <button onClick={() => { if (form.memberId && form.certificationId && form.deadline) onSave(form); }}
            className="flex-1 px-4 py-2 text-sm bg-azure-500 text-white rounded-lg hover:bg-azure-600">
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}

function EditProgressModal({ assignment, onClose, onSave }: {
  assignment: AssignedCertification; onClose: () => void;
  onSave: (d: Record<string, string | number>) => void;
}) {
  const [form, setForm] = useState({
    progress: assignment.progress, status: assignment.status,
    deadline: assignment.deadline.split('T')[0], priority: assignment.priority,
    notes: assignment.notes || '', credentialId: assignment.credentialId || '',
    completionDate: assignment.completionDate ? assignment.completionDate.split('T')[0] : '',
    expiryDate: assignment.expiryDate ? assignment.expiryDate.split('T')[0] : '',
  });
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">Edit Assignment</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Progress ({form.progress}%)</label>
            <input type="range" min={0} max={100} value={form.progress}
              onChange={e => setForm(p => ({ ...p, progress: parseInt(e.target.value) }))}
              className="w-full accent-azure-500" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>0%</span><span>100%</span></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30">
                {STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as any }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30">
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Deadline</label>
            <input type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30" />
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
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 px-4 py-2 text-sm bg-azure-500 text-white rounded-lg hover:bg-azure-600">Save</button>
        </div>
      </div>
    </div>
  );
}

export default function TrackerPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [provider] = useState('');
  const [deadline, setDeadline] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [addFor, setAddFor] = useState<{ id: string; name: string } | null>(null);
  const [editAssignment, setEditAssignment] = useState<AssignedCertification | undefined>();
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [deleteCertId, setDeleteCertId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedCertId, setSelectedCertId] = useState('');
  const [completionDateInput, setCompletionDateInput] = useState('');
  const [expiryDateInput, setExpiryDateInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedFields, setAnalyzedFields] = useState<{
    configured: boolean;
    autoFilled: boolean;
    matchedLine?: string | null;
    certificationMatch?: { id: string; name: string; provider: string } | null;
    confidence?: number;
    nameMatch?: { matches: boolean; score: number; extractedName: string; memberName: string } | null;
    recipientNameSource?: 'labeled' | 'layout' | null;
    memberMatch?: { id: string; name: string } | null;
    memberConfidence?: number;
    suggestions?: Array<{ id: string; name: string; provider: string }>;
  } | null>(null);
  const [requestEditFor, setRequestEditFor] = useState<AssignedCertification | null>(null);
  const [missingFields, setMissingFields] = useState<Array<{ field: string; label: string; message: string }>>([]);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [activeAddForm, setActiveAddForm] = useState<'teamMember' | 'certificateTitle' | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    message: string;
    existingAssignmentId: string;
  } | null>(null);
  const [extractedName, setExtractedName] = useState('');
  const [extractedCertTitle, setExtractedCertTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const resetUploadState = () => {
    setUploadId(null);
    setUploadFile(null);
    setAnalyzedFields(null);
    setIsAnalyzing(false);
    setSelectedMemberId('');
    setSelectedCertId('');
    setCompletionDateInput('');
    setExpiryDateInput('');
    setMissingFields([]);
    setShowMissingModal(false);
    setActiveAddForm(null);
    setDuplicateInfo(null);
    setExtractedName('');
    setExtractedCertTitle('');
  };

  const handleAddNew = (field: string) => {
    setActiveAddForm(field as any);
  };

  const handleNewMemberCreated = (newMember: TeamMember) => {
    qc.invalidateQueries({ queryKey: ['members-all'] });
    setSelectedMemberId(newMember.id);
    setActiveAddForm(null);
    setMissingFields(prev => prev.filter(m => m.field !== 'teamMember'));
  };

  const handleNewCertCreated = (newCert: Certification) => {
    qc.invalidateQueries({ queryKey: ['certs-all'] });
    setSelectedCertId(newCert.id);
    setActiveAddForm(null);
    setMissingFields(prev => prev.filter(m => m.field !== 'certificateTitle'));
  };


  const { data: allMembersRes } = useQuery<PaginatedResponse<TeamMember>>({
    queryKey: ['members-all'],
    queryFn: () => membersApi.list({ limit: 1000 }).then(r => r.data),
  });

  const { data: allCertsRes } = useQuery<PaginatedResponse<Certification>>({
    queryKey: ['certs-all'],
    queryFn: () => certificationsApi.list({ limit: 1000 }).then(r => r.data),
  });

  const { data, isLoading } = useQuery<PaginatedResponse<AssignedCertification>>({
    queryKey: ['tracker', search, status, provider, deadline],
    queryFn: () => certificationsApi.assignments({ search, status: status || undefined, provider: provider || undefined, deadline: deadline || undefined, limit: 1000 }).then(r => r.data),
    refetchInterval: 30000,
  });

  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());

  const toggleMember = (id: string) => {
    setExpandedMembers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groupedAssignments = useMemo(() => {
    if (!data?.data) return [];
    const groups = new Map<string, { member: Pick<TeamMember, 'id' | 'name' | 'profilePictureUrl' | 'designation'>, assignments: AssignedCertification[] }>();
    for (const a of data.data) {
      if (!a.member) continue;
      if (!groups.has(a.member.id)) {
        groups.set(a.member.id, { member: a.member, assignments: [] });
      }
      groups.get(a.member.id)!.assignments.push(a);
    }

    const result = Array.from(groups.values());
    
    // Sort groups alphabetically by member name in ascending order
    result.sort((a, b) => a.member.name.localeCompare(b.member.name));

    for (const g of result) {
      g.assignments.sort((a, b) => {
        const aDone = a.status === 'COMPLETED' || a.status === 'EXPIRED';
        const bDone = b.status === 'COMPLETED' || b.status === 'EXPIRED';

        // Tier 1: completed/expired always come before uncompleted
        if (aDone !== bDone) return aDone ? -1 : 1;

        if (aDone && bDone) {
          // Within completed/expired: most recently completed first
          const aDate = a.completionDate ? new Date(a.completionDate).getTime() : 0;
          const bDate = b.completionDate ? new Date(b.completionDate).getTime() : 0;
          return bDate - aDate;
        }

        // Tier 2: uncompleted — sort by deadline asc, then alpha by cert name
        const aDeadline = a.deadline ? new Date(a.deadline).getTime() : null;
        const bDeadline = b.deadline ? new Date(b.deadline).getTime() : null;

        if (aDeadline !== null && bDeadline !== null) {
          if (aDeadline !== bDeadline) return aDeadline - bDeadline;
        } else if (aDeadline !== null) {
          return -1; // a has deadline, b doesn't → a first
        } else if (bDeadline !== null) {
          return 1;  // b has deadline, a doesn't → b first
        }

        // Same deadline (or both null) → alphabetical by certification name
        const aName = a.certification?.name ?? '';
        const bName = b.certification?.name ?? '';
        return aName.localeCompare(bName);
      });
    }
    return result;
  }, [data?.data]);

  const assign = useMutation({
    mutationFn: (d: Record<string, string>) => certificationsApi.assign(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracker'] });
      qc.invalidateQueries({ queryKey: ['certifications'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowAssign(false);
    },
  });

  const updateAssign = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Record<string, string | number> }) => certificationsApi.updateAssignment(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracker'] });
      qc.invalidateQueries({ queryKey: ['certifications'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setEditAssignment(undefined);
    },
  });

  const deleteAssign = useMutation({
    mutationFn: (id: string) => certificationsApi.deleteAssignment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracker'] });
      qc.invalidateQueries({ queryKey: ['certifications'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const deleteCert = useMutation({
    mutationFn: (id: string) => certificationsApi.deleteCertificate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracker'] });
      qc.invalidateQueries({ queryKey: ['certifications'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setDeleteCertId(null);
    },
  });

  const uploadCert = useMutation({
    mutationFn: ({ id, file, completionDate, expiryDate, memberId, certificationId }: { id: string; file?: File; completionDate?: string; expiryDate?: string; memberId?: string; certificationId?: string }) => {
      const fd = new FormData();
      if (file) fd.append('certificate', file);
      if (completionDate) fd.append('completionDate', completionDate);
      if (expiryDate) fd.append('expiryDate', expiryDate);

      if (id === '__universal__') {
        if (memberId) fd.append('memberId', memberId);
        if (certificationId) fd.append('certificationId', certificationId);
        return certificationsApi.uploadCertificateUniversal(fd);
      } else {
        return certificationsApi.uploadCertificate(id, fd);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracker'] });
      qc.invalidateQueries({ queryKey: ['certifications'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setUploadId(null);
      setUploadFile(null);
      setSelectedMemberId('');
      setSelectedCertId('');
      setCompletionDateInput('');
      setExpiryDateInput('');
      setAnalyzedFields(null);
      setIsAnalyzing(false);
    },
    onError: (err: unknown) => {
      if (err instanceof DuplicateCertificateError) {
        setDuplicateInfo({
          message: err.message,
          existingAssignmentId: err.existingAssignmentId,
        });
      }
    },
  });

  const handleFileSelected = async (file: File) => {
    setUploadFile(file);
    setAnalyzedFields(null);
    setIsAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append('certificate', file);

      let res;
      if (uploadId === '__universal__') {
        res = await certificationsApi.analyzeCertificateUniversal(fd);
      } else {
        res = await certificationsApi.analyzeCertificate(uploadId!, fd);
      }

      if (res && res.data) {
        const data = res.data;
        if (data.completionDate) setCompletionDateInput(data.completionDate);
        if (data.expiryDate) setExpiryDateInput(data.expiryDate);
        if (data.recipientName) setExtractedName(data.recipientName);
        if (data.matchedLine) setExtractedCertTitle(data.matchedLine);

        if (uploadId === '__universal__') {
          if (data.memberMatch?.id) setSelectedMemberId(data.memberMatch.id);
          if (data.certificationMatch?.id) setSelectedCertId(data.certificationMatch.id);
        } else {
          // Pre-select the assignment's existing member and cert
          const assign = data?.data?.find((a: any) => a.id === uploadId) || data;
          if (assign?.memberId) setSelectedMemberId(assign.memberId);
          if (assign?.certificationId) setSelectedCertId(assign.certificationId);
        }

        const autoFilled = !!(data.completionDate || data.expiryDate || data.recipientName);
        setAnalyzedFields({
          configured: data.configured,
          autoFilled,
          matchedLine: data.matchedLine,
          certificationMatch: data.certificationMatch,
          confidence: data.confidence,
          nameMatch: data.nameMatch,
          recipientNameSource: data.recipientNameSource,
          memberMatch: data.memberMatch,
          memberConfidence: data.memberConfidence,
          suggestions: data.suggestions,
        });
      }
    } catch (err) {
      console.error('File analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Edit: if cert has a certificate URL, route to request-edit flow; otherwise direct edit
  const handleEditClick = (a: AssignedCertification) => {
    if (a.certificateUrl) {
      setRequestEditFor(a);
    } else {
      setEditAssignment(a);
    }
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Certification Tracker</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { resetUploadState(); setUploadId('__universal__'); }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-border hover:bg-muted/40 transition-colors">
            <Upload className="w-4 h-4" /> Upload Certificate
          </button>
          <button onClick={() => setShowAssign(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-azure-500 text-white text-sm font-medium rounded-xl hover:bg-azure-600 transition-colors shadow-lg shadow-azure-500/25">
            <Plus className="w-4 h-4" /> Assign Certification
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search member or certification…" value={search}
            onChange={e => { setSearch(e.target.value); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30 focus:border-azure-500" />
        </div>
        {[
          { label: 'Status', value: status, onChange: (v: string) => { setStatus(v); }, options: STATUSES, placeholder: 'All Statuses' },
          { label: 'Deadline', value: deadline, onChange: (v: string) => { setDeadline(v); }, options: ['overdue', 'today', 'week'], placeholder: 'All Deadlines' },
        ].map(({ value, onChange, options, placeholder }) => (
          <select key={placeholder} value={value} onChange={e => onChange(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30 bg-card">
            <option value="">{placeholder}</option>
            {options.map(o => <option key={o} value={o}>{typeof o === 'string' ? (o.includes('_') ? formatStatus(o) : o.charAt(0).toUpperCase() + o.slice(1)) : o}</option>)}
          </select>
        ))}
      </div>

      {/* Grouped Table */}
      <div className="space-y-4">
        {isLoading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border h-16 animate-pulse" />
        ))}
        {!isLoading && groupedAssignments.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">No assignments found</div>
        )}
        {groupedAssignments.map(group => {
          const completedCount = group.assignments.filter(a => a.status === 'COMPLETED' || a.status === 'EXPIRED').length;
          const totalCount = group.assignments.length;
          const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          return (
            <div key={group.member.id} id={`member-row-${group.member.id}`} className="bg-card rounded-xl border border-border shadow-sm overflow-visible transition-all duration-300">
              <div onClick={() => toggleMember(group.member.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/10 transition-colors cursor-pointer select-none">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-azure-900/40 flex items-center justify-center text-azure-300 text-xs font-bold flex-shrink-0 overflow-hidden border border-azure-800/40">
                    {group.member.profilePictureUrl
                      ? <img src={group.member.profilePictureUrl} alt="" className="w-full h-full object-cover" />
                      : getInitials(group.member.name)}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm">{group.member.name}</p>
                    <p className="text-xs text-muted-foreground">{group.member.designation}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-medium">{completedCount} / {totalCount} Completed</p>
                    <div className="w-24 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-azure-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddFor({ id: group.member.id, name: group.member.name }); }}
                    title={`Add certification for ${group.member.name}`}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-azure-500/10 text-azure-300 border border-azure-800/40 rounded-lg hover:bg-azure-500 hover:text-white transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                  {expandedMembers.has(group.member.id) ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                </div>
              </div>
              
              {expandedMembers.has(group.member.id) && (
                <div className="border-t border-border overflow-visible bg-muted/5">
                  <table className="w-full data-table">
                    <thead>
                      <tr>
                        <th className="text-left">Certificate Name</th>
                        <th className="text-left">Completed On</th>
                        <th className="text-left">Valid Till</th>
                        <th className="text-left">Status</th>
                        <th className="text-left">Deadline</th>
                        <th className="text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.assignments.map(a => {
                        let validityBadge = null;
                        if (a.status === 'COMPLETED') {
                          if (a.expiryDate) {
                            const expiry = new Date(a.expiryDate);
                            const now = new Date();
                            const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                            if (diffDays < 0) {
                              validityBadge = <span className="text-[10px] px-2 py-0.5 rounded-full border border-red-800/40 bg-red-950/40 text-red-400 font-medium mt-1 inline-block">Expired</span>;
                            } else if (diffDays <= 30) {
                              validityBadge = <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-800/40 bg-amber-950/40 text-amber-400 font-medium mt-1 inline-block">Expiring Soon</span>;
                            } else {
                              validityBadge = <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-800/40 bg-emerald-950/40 text-emerald-400 font-medium mt-1 inline-block">Valid</span>;
                            }
                          } else {
                            validityBadge = <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-800/40 bg-emerald-950/40 text-emerald-400 font-medium mt-1 inline-block">Valid</span>;
                          }
                        }

                        return (
                          <tr key={a.id} className="hover:bg-muted/10 transition-colors">
                            <td>
                              <div className="space-y-0.5">
                                <span className="text-xs font-medium block">{a.certification?.name}</span>
                                {a.certificateUrl && (
                                  <a href={a.certificateUrl} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-azure-400 hover:text-azure-300">
                                    <FileText className="w-3 h-3" /> View Certificate
                                  </a>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className="text-xs text-muted-foreground">
                                {a.completionDate ? formatDate(a.completionDate, 'MMM d, yy') : '—'}
                              </span>
                            </td>
                            <td>
                              <span className="text-xs text-muted-foreground">
                                {a.expiryDate ? formatDate(a.expiryDate, 'MMM d, yy') : '—'}
                              </span>
                            </td>
                            <td>
                              <div className="flex flex-col items-start">
                                <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', getStatusColor(a.status))}>
                                  {formatStatus(a.status)}
                                </span>
                                {validityBadge}
                              </div>
                            </td>
                            <td>
                              {a.status === 'COMPLETED' ? (
                                <span className="text-xs text-muted-foreground/40">—</span>
                              ) : (
                                <span className={cn('text-xs font-medium', a.status === 'OVERDUE' ? 'text-red-400' : 'text-muted-foreground')}>
                                  {formatDate(a.deadline, 'MMM d, yy')}
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="flex items-center gap-3">
                                {!a.certificateUrl && (
                                  <button
                                    onClick={() => { setUploadId(a.id); setSelectedMemberId(a.memberId); setSelectedCertId(a.certificationId); }}
                                    className="flex items-center gap-1 text-[11px] font-medium text-azure-400 hover:text-azure-300 transition-colors"
                                    title="Upload Certificate"
                                  >
                                    <Upload className="w-3 h-3" /> Upload
                                  </button>
                                )}
                                <QuickUpdateMenu
                                  onEdit={() => handleEditClick(a)}
                                  onDelete={() => deleteAssign.mutate(a.id)}
                                  onDeleteCertificate={a.certificateUrl ? () => setDeleteCertId(a.id) : undefined}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAssign && <AssignModal onClose={() => setShowAssign(false)} onSave={d => assign.mutate(d)} />}
      {addFor && (
        <AddCertificationModal
          memberId={addFor.id}
          memberName={addFor.name}
          onClose={() => setAddFor(null)}
          onSaved={() => setAddFor(null)}
        />
      )}
      {editAssignment && (
        <EditProgressModal assignment={editAssignment} onClose={() => setEditAssignment(undefined)}
          onSave={d => updateAssign.mutate({ id: editAssignment.id, d })} />
      )}
      {requestEditFor && (
        <RequestEditModal
          assignment={requestEditFor}
          onClose={() => setRequestEditFor(null)}
          onSave={(changes, requestedBy) => {
            certificationsApi.requestEdit(requestEditFor.id, { proposedChanges: changes, requestedBy })
              .then(() => setRequestEditFor(null))
              .catch(console.error);
          }}
        />
      )}

      {showMissingModal && !activeAddForm && (
        <MissingFieldsModal
          missing={missingFields}
          onAddNew={handleAddNew}
          onCancel={() => setShowMissingModal(false)}
        />
      )}

      {activeAddForm === 'teamMember' && (
        <AddNewTeamMemberInline
          prefillName={extractedName}
          onCreated={handleNewMemberCreated}
          onCancel={() => setActiveAddForm(null)}
        />
      )}

      {activeAddForm === 'certificateTitle' && (
        <AddNewCertificationInline
          prefillTitle={extractedCertTitle}
          onCreated={handleNewCertCreated}
          onCancel={() => setActiveAddForm(null)}
        />
      )}

      {/* Delete Certificate Confirmation Modal */}
      {deleteCertId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-border">
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-semibold text-lg text-foreground">Delete Certificate</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Are you sure you want to delete this certificate? This can't be undone.
            </p>
            <div className="flex gap-3">
              <button
                disabled={deleteCert.isPending}
                onClick={() => setDeleteCertId(null)}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted font-medium"
              >
                Cancel
              </button>
              <button
                disabled={deleteCert.isPending}
                onClick={() => deleteCert.mutate(deleteCertId)}
                className="flex-1 px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-60 font-medium flex items-center justify-center gap-2"
              >
                {deleteCert.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Certificate Modal */}
      {uploadId && (() => {
        const isUniversal = uploadId === '__universal__';
        const membersList = allMembersRes?.data || [];
        const certsList = allCertsRes?.data || [];

        return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Upload Certificate</h3>
              <button onClick={resetUploadState}
                className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            {/* Dropzone Area (Always at top, compact) */}
            <div className="mb-4">
              {!uploadFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-azure-500 hover:bg-azure-900/20 border-border transition-colors bg-muted/10"
                >
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-foreground font-medium mb-0.5">Choose certificate file</p>
                  <p className="text-[10px] text-muted-foreground">PDF, PNG, or JPG up to 4MB</p>
                  <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); }} />
                </div>
              ) : isAnalyzing ? (
                <div className="border border-border rounded-xl p-6 text-center bg-muted/10 flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 text-azure-400 animate-spin" />
                  <p className="text-xs font-medium text-foreground">Reading certificate details…</p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/10">
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-[10px] text-muted-foreground truncate">Selected File</p>
                    <p className="text-xs font-medium text-azure-300 truncate">{uploadFile.name}</p>
                  </div>
                  <button
                    onClick={() => {
                      setUploadFile(null);
                      setAnalyzedFields(null);
                      setCompletionDateInput('');
                      setExpiryDateInput('');
                      if (isUniversal) {
                        setSelectedMemberId('');
                        setSelectedCertId('');
                      }
                    }}
                    className="text-[10px] font-medium text-muted-foreground hover:text-foreground border border-border px-2 py-1 rounded hover:bg-muted"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Auto-extraction banners */}
            {analyzedFields && (
              <div className="space-y-2 mb-4">
                {/* Member match / mismatch */}
                {analyzedFields.nameMatch && !analyzedFields.nameMatch.matches && (
                  <div className="text-xs px-3 py-2 rounded-lg border bg-amber-950/40 border-amber-800/40 text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                    Recipient <strong className="text-amber-200">"{analyzedFields.nameMatch.extractedName}"</strong> does not match <strong className="text-amber-200">{analyzedFields.nameMatch.memberName}</strong>.
                  </div>
                )}
                {analyzedFields.nameMatch?.matches && (
                  <div className="text-xs px-3 py-2 rounded-lg border bg-emerald-950/40 border-emerald-800/40 text-emerald-300">
                    ✓ Recipient matched to <strong className="text-emerald-200">{analyzedFields.nameMatch.memberName}</strong>.
                  </div>
                )}
                {/* Catalog match */}
                {analyzedFields.certificationMatch && (
                  <div className="text-xs px-3 py-2 rounded-lg border bg-azure-950/40 border-azure-800/40 text-azure-300">
                    📋 Catalog match: <strong className="text-azure-200">{analyzedFields.certificationMatch.name}</strong>.
                  </div>
                )}
                {!analyzedFields.certificationMatch && analyzedFields.configured && (
                  <div className="text-xs px-3 py-2 rounded-lg border bg-amber-950/40 border-amber-800/40 text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> No matching certification catalog item found.
                  </div>
                )}
              </div>
            )}

            {/* Fields (Always Visible below dropzone) */}
            <div className="space-y-3 mb-4">
              {/* Team Member selection */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Team Member *</label>
                <select
                  value={selectedMemberId}
                  disabled={!isUniversal}
                  onChange={e => { setSelectedMemberId(e.target.value); }}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30 disabled:opacity-75 disabled:cursor-not-allowed">
                  <option value="">Select member…</option>
                  {membersList.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Certificate Name (Certification) selection */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Certificate Name *</label>
                <select
                  value={selectedCertId}
                  disabled={!isUniversal}
                  onChange={e => { setSelectedCertId(e.target.value); }}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30 disabled:opacity-75 disabled:cursor-not-allowed">
                  <option value="">Select certification…</option>
                  {analyzedFields?.suggestions && analyzedFields.suggestions.length > 0 && (
                    <optgroup label="✨ Extracted Suggestions">
                      {analyzedFields.suggestions.map(s => (
                        <option key={`sug-${s.id}`} value={s.id}>
                          {s.name} — {s.provider}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {analyzedFields?.suggestions && analyzedFields.suggestions.length > 0 ? (
                    <optgroup label="All Certifications">
                      {certsList.map(c => (
                        <option key={c.id} value={c.id}>{c.name} — {c.provider}</option>
                      ))}
                    </optgroup>
                  ) : (
                    certsList.map(c => (
                      <option key={c.id} value={c.id}>{c.name} — {c.provider}</option>
                    ))
                  )}
                </select>
              </div>


              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Completed On</label>
                  <input type="date" value={completionDateInput} onChange={e => setCompletionDateInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30 focus:border-azure-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Valid Till</label>
                  <input type="date" value={expiryDateInput} onChange={e => setExpiryDateInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30 focus:border-azure-500" />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 mt-4 border-t border-border pt-4">
              <button onClick={resetUploadState}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted font-medium">Cancel</button>
              <button
                onClick={() => {
                  const missing = [];
                  if (isUniversal && !selectedMemberId) {
                    missing.push({
                      field: "teamMember",
                      label: "Team Member",
                      message: "No matching team member found. Please select or add a member."
                    });
                  }
                  if (!selectedCertId) {
                    missing.push({
                      field: "certificateTitle",
                      label: "Certification",
                      message: "This certification isn't in the catalog yet. Please select or add it."
                    });
                  }
                  if (!completionDateInput) {
                    missing.push({
                      field: "completionDate",
                      label: "Completed On",
                      message: "Completion date could not be extracted."
                    });
                  }
                  if (!expiryDateInput) {
                    missing.push({
                      field: "expiryDate",
                      label: "Valid Till",
                      message: "Expiry date could not be extracted (may not apply to all certifications)."
                    });
                  }

                  if (missing.length > 0) {
                    setMissingFields(missing);
                    setShowMissingModal(true);
                  } else {
                    // ⚡ Client-side duplicate pre-check (fast, uses already-loaded state)
                    if (isUniversal && selectedMemberId && selectedCertId) {
                      const existingInState = data?.data?.find(
                        (a: AssignedCertification) =>
                          a.memberId === selectedMemberId &&
                          a.certificationId === selectedCertId &&
                          a.certificateUrl
                      );
                      if (existingInState) {
                        setDuplicateInfo({
                          message: `${existingInState.member?.name ?? 'This member'} already has a certificate uploaded for ${existingInState.certification?.name ?? 'this certification'}.`,
                          existingAssignmentId: existingInState.id,
                        });
                        return;
                      }
                    }
                    uploadCert.mutate({
                      id: uploadId!,
                      file: uploadFile || undefined,
                      completionDate: completionDateInput || undefined,
                      expiryDate: expiryDateInput || undefined,
                      memberId: selectedMemberId,
                      certificationId: selectedCertId
                    });
                  }
                }}
                disabled={isAnalyzing || uploadCert.isPending}
                className="flex-1 px-4 py-2 text-sm bg-azure-500 text-white rounded-lg hover:bg-azure-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium">
                {uploadCert.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Save Certificate
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Duplicate Certificate Modal */}
      {duplicateInfo && (
        <DuplicateCertificateModal
          message={duplicateInfo.message}
          existingAssignmentId={duplicateInfo.existingAssignmentId}
          onViewExisting={() => {
            // Find the member who owns the existing assignment
            const existing = data?.data?.find(
              (a: AssignedCertification) => a.id === duplicateInfo.existingAssignmentId
            );
            resetUploadState();
            if (existing?.memberId) {
              setExpandedMembers(prev => {
                const next = new Set(prev);
                next.add(existing.memberId);
                return next;
              });
              // Scroll to the member row after a short delay
              setTimeout(() => {
                document.getElementById(`member-row-${existing.memberId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 150);
            }
          }}
          onCancel={() => setDuplicateInfo(null)}
        />
      )}
    </div>
  );
}

// ---- Duplicate Certificate Modal ----
function DuplicateCertificateModal({
  message,
  onViewExisting,
  onCancel,
}: {
  message: string;
  existingAssignmentId: string;
  onViewExisting: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="font-semibold text-base text-foreground">Certificate Already Exists</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Duplicate record detected</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-foreground leading-relaxed">{message}</p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            To update this certificate (e.g. renew with a new expiry date), use the
            <strong className="text-foreground"> Edit</strong> option from the three-dot menu on the existing row.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-4 bg-muted/10 border-t border-border">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-xl hover:bg-muted text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onViewExisting}
            className="flex-1 px-4 py-2 text-sm font-medium bg-azure-500 text-white rounded-xl hover:bg-azure-600 transition-colors shadow-sm"
          >
            View Existing Record
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Request Edit Modal ----
function RequestEditModal({ assignment, onClose, onSave }: {
  assignment: AssignedCertification;
  onClose: () => void;
  onSave: (changes: Record<string, unknown>, requestedBy: string) => void;
}) {
  const [form, setForm] = useState({
    completionDate: assignment.completionDate ? new Date(assignment.completionDate).toISOString().split('T')[0] : '',
    expiryDate: assignment.expiryDate ? new Date(assignment.expiryDate).toISOString().split('T')[0] : '',
    credentialId: assignment.credentialId || '',
    requestedBy: '',
  });

  const handleSubmit = () => {
    if (!form.requestedBy.trim()) return;
    const changes: Record<string, unknown> = {};
    if (form.completionDate) changes.completionDate = form.completionDate;
    if (form.expiryDate) changes.expiryDate = form.expiryDate;
    if (form.credentialId) changes.credentialId = form.credentialId;
    onSave(changes, form.requestedBy);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-base">Request Edit</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{assignment.certification?.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-xs px-3 py-2 rounded-lg border bg-amber-950/30 border-amber-800/40 text-amber-300">
            <AlertTriangle className="w-3 h-3 inline mr-1" />This certificate has already been uploaded. Changes will be submitted for admin approval.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Completed On</label>
              <input type="date" value={form.completionDate} onChange={e => setForm(p => ({ ...p, completionDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Valid Till</label>
              <input type="date" value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Credential ID</label>
            <input value={form.credentialId} onChange={e => setForm(p => ({ ...p, credentialId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30"
              placeholder="e.g. AZ-900-2024-ABC" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Your Name *</label>
            <input value={form.requestedBy} onChange={e => setForm(p => ({ ...p, requestedBy: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30"
              placeholder="Who is requesting this change?" />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.requestedBy.trim()}
            className="flex-1 px-4 py-2 text-sm bg-azure-500 text-white rounded-lg hover:bg-azure-600 disabled:opacity-60">
            Submit for Approval
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Missing Fields Modal ----
function MissingFieldsModal({
  missing,
  onAddNew,
  onCancel,
}: {
  missing: Array<{ field: string; label: string; message: string }>;
  onAddNew: (field: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-lg text-foreground">Unresolved Details</h2>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Please resolve the following details before saving:
          </p>

          <ul className="space-y-3">
            {missing.map((item) => (
              <li
                key={item.field}
                className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/10 gap-3"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-0.5">
                    {item.label}
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {item.message}
                  </p>
                </div>

                {(item.field === 'teamMember' || item.field === 'certificateTitle') && (
                  <button
                    onClick={() => onAddNew(item.field)}
                    className="shrink-0 px-2.5 py-1.5 text-[11px] font-medium bg-azure-500 text-white rounded-lg hover:bg-azure-600 transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-3 h-3" />
                    {item.field === 'teamMember' ? 'Add Member' : 'Add Certification'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3 px-6 py-4 bg-muted/10 border-t border-border">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-xl hover:bg-muted text-foreground transition-all duration-150"
          >
            Go Back & Resolve
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Add New Team Member Inline ----
function AddNewTeamMemberInline({
  prefillName,
  onCreated,
  onCancel,
}: {
  prefillName?: string;
  onCreated: (newMember: TeamMember) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(prefillName || '');
  const [designation, setDesignation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('designation', designation.trim() || 'Consultant');
      fd.append('joiningDate', new Date().toISOString().split('T')[0]);

      const res = await membersApi.create(fd);
      onCreated(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to create team member');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-base">Add New Team Member</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="text-xs text-red-400 bg-red-950/20 p-2.5 rounded-lg border border-red-900/40">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30"
              placeholder="e.g. Suhani Jain"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Designation</label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30"
              placeholder="e.g. Fabric Data Engineer"
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 bg-muted/10 border-t border-border">
          <button onClick={onCancel} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="flex-1 px-4 py-2 text-sm bg-azure-500 text-white rounded-lg hover:bg-azure-600 disabled:opacity-60 font-medium flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Add & Use
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Add New Certification Inline ----
function AddNewCertificationInline({
  prefillTitle,
  onCreated,
  onCancel,
}: {
  prefillTitle?: string;
  onCreated: (newCert: Certification) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(prefillTitle || '');
  const [provider, setProvider] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim() || !provider.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await certificationsApi.create({
        name: name.trim(),
        provider: provider.trim(),
      });
      onCreated(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to create certification');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-base">Add New Certification</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="text-xs text-red-400 bg-red-950/20 p-2.5 rounded-lg border border-red-900/40">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Certification Title *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30"
              placeholder="e.g. Fabric Data Engineer Associate"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Provider / Issuer *</label>
            <input
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30"
              placeholder="e.g. Microsoft"
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 bg-muted/10 border-t border-border">
          <button onClick={onCancel} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim() || !provider.trim()}
            className="flex-1 px-4 py-2 text-sm bg-azure-500 text-white rounded-lg hover:bg-azure-600 disabled:opacity-60 font-medium flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Add & Use
          </button>
        </div>
      </div>
    </div>
  );
}
