import { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certificationsApi, membersApi } from '@/lib/api';
import { Search, Upload, Pencil, Trash2, FileText, ChevronDown, ChevronUp, X, Loader2, Plus, MoreVertical, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { cn, formatDate, formatStatus, getStatusColor, getInitials } from '@/lib/utils';
import type { AssignedCertification, PaginatedResponse, TeamMember, Certification } from '@/types';
import AddCertificationModal from '@/components/AddCertificationModal';

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'EXPIRED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function QuickUpdateMenu({
  assignment, onEdit, onUpload, onDelete, onQuickStatus
}: {
  assignment: AssignedCertification;
  onEdit: () => void;
  onUpload: () => void;
  onDelete: () => void;
  onQuickStatus: (status: string) => void;
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
          {/* Quick Status Section */}
          <div className="px-3 py-2 border-b border-border/60">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Quick Status</p>
            <div className="space-y-1">
              <button
                onClick={() => { onQuickStatus('NOT_STARTED'); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors text-left ${
                  assignment.status === 'NOT_STARTED' ? 'bg-slate-800/60 text-slate-300' : 'hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <AlertCircle className="w-3 h-3" /> Not Started
              </button>
              <button
                onClick={() => { onQuickStatus('IN_PROGRESS'); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors text-left ${
                  assignment.status === 'IN_PROGRESS' ? 'bg-azure-900/40 text-azure-300' : 'hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <Clock className="w-3 h-3" /> In Progress
              </button>
              <button
                onClick={() => { onQuickStatus('COMPLETED'); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors text-left ${
                  assignment.status === 'COMPLETED' ? 'bg-emerald-900/40 text-emerald-300' : 'hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" /> Mark Completed
              </button>
            </div>
          </div>
          {/* Actions Section */}
          <div className="py-1">
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-muted/40 transition-colors text-left"
            >
              <Pencil className="w-3 h-3 text-muted-foreground" /> Edit
            </button>
            <button
              onClick={() => { setOpen(false); onUpload(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-azure-400 hover:bg-azure-950/40 transition-colors text-left"
            >
              <Upload className="w-3 h-3" /> Upload Certificate
            </button>
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
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [credentialId, setCredentialId] = useState('');
  const [completionDateInput, setCompletionDateInput] = useState('');
  const [expiryDateInput, setExpiryDateInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

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
    
    // Sort assignments inside each group (Completed/Expired on top)
    const statusOrder: Record<string, number> = {
      COMPLETED: 1,
      EXPIRED: 2,
      OVERDUE: 3,
      IN_PROGRESS: 4,
      NOT_STARTED: 5
    };
    
    const result = Array.from(groups.values());
    for (const g of result) {
      g.assignments.sort((a, b) => {
        const orderA = statusOrder[a.status] || 99;
        const orderB = statusOrder[b.status] || 99;
        return orderA - orderB;
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

  const uploadCert = useMutation({
    mutationFn: ({ id, file, cid, completionDate, expiryDate }: { id: string; file: File; cid: string; completionDate?: string; expiryDate?: string }) => {
      const fd = new FormData();
      fd.append('certificate', file);
      if (cid) fd.append('credentialId', cid);
      if (completionDate) fd.append('completionDate', completionDate);
      if (expiryDate) fd.append('expiryDate', expiryDate);
      return certificationsApi.uploadCertificate(id, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracker'] });
      qc.invalidateQueries({ queryKey: ['certifications'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setUploadId(null);
      setUploadFile(null);
      setCredentialId('');
      setCompletionDateInput('');
      setExpiryDateInput('');
    },
  });

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Certification Tracker</h2>
        </div>
        <button onClick={() => setShowAssign(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-azure-500 text-white text-sm font-medium rounded-xl hover:bg-azure-600 transition-colors shadow-lg shadow-azure-500/25">
          <Plus className="w-4 h-4" /> Assign Certification
        </button>
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
          const completedCount = group.assignments.filter(a => a.status === 'COMPLETED').length;
          const totalCount = group.assignments.length;
          const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          return (
            <div key={group.member.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all duration-300">
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
                <div className="border-t border-border overflow-x-auto bg-muted/5">
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
                              <QuickUpdateMenu
                                assignment={a}
                                onEdit={() => setEditAssignment(a)}
                                onUpload={() => setUploadId(a.id)}
                                onDelete={() => deleteAssign.mutate(a.id)}
                                onQuickStatus={(newStatus) =>
                                  updateAssign.mutate({ id: a.id, d: { status: newStatus, progress: newStatus === 'COMPLETED' ? 100 : newStatus === 'IN_PROGRESS' ? 50 : a.progress } })
                                }
                              />
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

      {/* Upload Certificate Modal */}
      {uploadId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-border">
            <h3 className="font-semibold text-lg mb-4">Upload Certificate</h3>
            <div onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-azure-500 hover:bg-azure-900/20 transition-colors mb-4 bg-muted/10">
              {uploadFile
                ? <p className="text-sm text-azure-300 font-medium truncate">{uploadFile.name}</p>
                : <>
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload PDF, PNG, or JPG</p>
                  </>
              }
              <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
                onChange={e => setUploadFile(e.target.files?.[0] || null)} />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Credential ID (optional)</label>
              <input value={credentialId} onChange={e => setCredentialId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30 focus:border-azure-500"
                placeholder="e.g. AZ-900-2024-ABC" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
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
            <div className="flex gap-3">
              <button onClick={() => { setUploadId(null); setUploadFile(null); }}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
              <button onClick={() => { if (uploadFile) uploadCert.mutate({ id: uploadId, file: uploadFile, cid: credentialId, completionDate: completionDateInput, expiryDate: expiryDateInput }); }}
                disabled={!uploadFile || uploadCert.isPending}
                className="flex-1 px-4 py-2 text-sm bg-azure-500 text-white rounded-lg hover:bg-azure-600 disabled:opacity-60 flex items-center justify-center gap-2">
                {uploadCert.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
