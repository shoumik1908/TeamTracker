import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api';
import { X, Loader2 } from 'lucide-react';
import { formatStatus } from '@/lib/utils';
import type { Project, PaginatedResponse } from '@/types';

export default function AddProjectModal({ memberId, memberName, onClose, onSaved }: {
  memberId: string;
  memberName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: projects } = useQuery<PaginatedResponse<Project>>({
    queryKey: ['projects-list'],
    queryFn: () => projectsApi.list({ limit: 200 }).then(r => r.data),
  });

  const save = useMutation({
    mutationFn: () => projectsApi.addMember(projectId, { memberId, role: role.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
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
            <h2 className="font-semibold text-lg">Add to Project</h2>
            <p className="text-xs text-muted-foreground">For {memberName}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Project *</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30">
              <option value="">Select a project…</option>
              {projects?.data.map(p => <option key={p.id} value={p.id}>{p.name} — {formatStatus(p.status)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Role</label>
            <input value={role} onChange={e => setRole(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-500/30"
              placeholder="e.g. Developer, Analyst (optional)" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
          <button onClick={() => { setError(null); save.mutate(); }} disabled={!projectId || save.isPending}
            className="flex-1 px-4 py-2 text-sm bg-azure-500 text-white rounded-lg hover:bg-azure-600 disabled:opacity-60 flex items-center justify-center gap-2">
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Add to Project
          </button>
        </div>
      </div>
    </div>
  );
}
