import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certificationsApi } from '@/lib/api';
import { Plus, Search, Pencil, Trash2, ExternalLink, X, Loader2 } from 'lucide-react';
import type { Certification, PaginatedResponse } from '@/types';

type CertFormData = {
  name: string; provider: string; description: string;
  duration: string; learningLink: string;
};
const INIT: CertFormData = { name: '', provider: '', description: '', duration: '', learningLink: '' };

function CertModal({ cert, onClose, onSave }: { cert?: Certification; onClose: () => void; onSave: (d: CertFormData) => void }) {
  const [form, setForm] = useState<CertFormData>(cert ? {
    name: cert.name, provider: cert.provider, description: cert.description || '',
    duration: cert.duration || '', learningLink: cert.learningLink || '',
  } : INIT);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">{cert ? 'Edit Certification' : 'Add Certification'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Certification Name *</label>
              <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                placeholder="Azure Fundamentals" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Provider *</label>
              <input required value={form.provider} onChange={e => setForm(p => ({ ...p, provider: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                placeholder="Microsoft" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30 resize-none"
              placeholder="Brief description of the certification..." />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Duration</label>
              <input value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                placeholder="40 hours" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Learning Link</label>
            <input type="url" value={form.learningLink} onChange={e => setForm(p => ({ ...p, learningLink: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30"
              placeholder="https://learn.microsoft.com/..." />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted">Cancel</button>
          <button onClick={() => { if (form.name && form.provider) onSave(form); }}
            className="flex-1 px-4 py-2 text-sm font-medium bg-azure-500 text-white rounded-lg hover:bg-azure-600">
            {cert ? 'Save Changes' : 'Add Certification'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CertificationsPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editCert, setEditCert] = useState<Certification | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<PaginatedResponse<Certification>>({
    queryKey: ['certifications', search],
    queryFn: () => certificationsApi.list({ search, limit: 1000 }).then(r => r.data),
    refetchInterval: 30000,
  });

  const create = useMutation({
    mutationFn: (d: CertFormData) => certificationsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['certifications'] }); setShowForm(false); },
  });

  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: CertFormData }) => certificationsApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['certifications'] }); setEditCert(undefined); },
  });

  const del = useMutation({
    mutationFn: (id: string) => certificationsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['certifications'] }); setDeleteId(null); },
  });

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Certification Catalog</h2>
          <p className="page-subtitle">{data?.pagination.total || 0} certifications available</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-azure-500 text-white text-sm font-medium rounded-xl hover:bg-azure-600 transition-colors shadow-lg shadow-azure-500/25">
          <Plus className="w-4 h-4" /> Add Certification
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search certifications…" value={search}
            onChange={e => { setSearch(e.target.value); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-azure-500/30 focus:border-azure-500" />
        </div>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-5 h-44 animate-pulse">
            <div className="h-4 bg-muted rounded w-2/3 mb-2" />
            <div className="h-3 bg-muted rounded w-1/3 mb-4" />
            <div className="h-12 bg-muted rounded mb-3" />
            <div className="h-3 bg-muted rounded w-1/4" />
          </div>
        ))}
        {data?.data.map(cert => (
          <div key={cert.id} className="bg-card rounded-xl border border-border p-5 hover-card group">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight">{cert.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{cert.provider}</p>
              </div>
              </div>

            {cert.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{cert.description}</p>}

            <div className="space-y-1.5 mb-4">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{cert._completedCount || 0} completed</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button onClick={() => setEditCert(cert)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeleteId(cert.id)}
                  className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {cert.learningLink && (
                <a href={cert.learningLink} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-azure-400 hover:text-azure-300 font-medium">
                  Learn <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        ))}
        {!isLoading && data?.data.length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
            No certifications found
          </div>
        )}
      </div>



      {(showForm || editCert) && (
        <CertModal cert={editCert} onClose={() => { setShowForm(false); setEditCert(undefined); }}
          onSave={d => { if (editCert) update.mutate({ id: editCert.id, d }); else create.mutate(d); }} />
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-border">
            <h3 className="font-semibold text-lg mb-2">Delete Certification?</h3>
            <p className="text-sm text-muted-foreground mb-6">This will also remove all assignments for this certification.</p>
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
    </div>
  );
}
