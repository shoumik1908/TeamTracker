import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certificationsApi } from '@/lib/api';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Certification, PaginatedResponse } from '@/types';

export default function AddCertificationModal({ memberId, memberName, onClose, onSaved }: {
  memberId: string;
  memberName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [certificationId, setCertificationId] = useState('');
  const [newCert, setNewCert] = useState({ name: '', provider: '', learningLink: '' });
  const [completionDate, setCompletionDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: catalog } = useQuery<PaginatedResponse<Certification>>({
    queryKey: ['certs-catalog'],
    queryFn: () => certificationsApi.list({ limit: 200 }).then(r => r.data),
  });

  const save = useMutation({
    mutationFn: async () => {
      let certId = certificationId;
      // If the member is logging a brand-new certification, create the catalog entry first
      if (mode === 'new') {
        const created = await certificationsApi.create({
          name: newCert.name.trim(),
          provider: newCert.provider.trim(),
          learningLink: newCert.learningLink.trim() || undefined,
        });
        certId = created.data.id;
      }
      // Assign, anchoring the required deadline to the completion date, then mark it complete with dates
      const assigned = await certificationsApi.assign({
        memberId,
        certificationId: certId,
        deadline: completionDate,
        notes: notes.trim() || undefined,
      });
      await certificationsApi.updateAssignment(assigned.data.id, {
        status: 'COMPLETED',
        progress: 100,
        completionDate: completionDate || undefined,
        expiryDate: expiryDate || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member'] });
      qc.invalidateQueries({ queryKey: ['tracker'] });
      qc.invalidateQueries({ queryKey: ['certifications'] });
      qc.invalidateQueries({ queryKey: ['certs-catalog'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onSaved();
    },
    onError: (e: Error) => setError(e.message),
  });

  const certChosen = mode === 'existing'
    ? Boolean(certificationId)
    : Boolean(newCert.name.trim() && newCert.provider.trim());
  const canSave = certChosen && Boolean(completionDate);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-lg">Add Certification</h2>
            <p className="text-xs text-muted-foreground">For {memberName}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted/30 rounded-lg">
            {([['existing', 'From Catalog'], ['new', 'New Certification']] as const).map(([val, label]) => (
              <button key={val} onClick={() => { setMode(val); setError(null); }}
                className={cn('px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  mode === val ? 'bg-azure-500 text-white shadow' : 'text-muted-foreground hover:text-foreground')}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'existing' ? (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Certification *</label>
              <select value={certificationId} onChange={e => setCertificationId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30">
                <option value="">Select a certification…</option>
                {catalog?.data.map(c => <option key={c.id} value={c.id}>{c.name} — {c.provider}</option>)}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Can't find it? Switch to <button type="button" onClick={() => setMode('new')} className="text-azure-400 hover:underline">New Certification</button>.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Certification Name *</label>
                <input value={newCert.name} onChange={e => setNewCert(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                  placeholder="e.g. AWS Certified Solutions Architect" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Provider *</label>
                <input value={newCert.provider} onChange={e => setNewCert(p => ({ ...p, provider: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                  placeholder="e.g. Amazon Web Services" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Learning Link</label>
                <input value={newCert.learningLink} onChange={e => setNewCert(p => ({ ...p, learningLink: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                  placeholder="https://…  (optional)" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Completed On *</label>
              <input type="date" value={completionDate} onChange={e => setCompletionDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Valid Till</label>
              <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30 resize-none"
              placeholder="Optional notes…" />
          </div>
          <p className="text-[11px] text-muted-foreground">Saved as <strong className="text-emerald-400">Completed</strong> (100%). You can upload the certificate file afterwards via the member's profile.</p>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
          <button onClick={() => { setError(null); save.mutate(); }} disabled={!canSave || save.isPending}
            className="flex-1 px-4 py-2 text-sm bg-azure-500 text-white rounded-lg hover:bg-azure-600 disabled:opacity-60 flex items-center justify-center gap-2">
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Add Certification
          </button>
        </div>
      </div>
    </div>
  );
}
