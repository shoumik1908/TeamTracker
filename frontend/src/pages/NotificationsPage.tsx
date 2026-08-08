import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certificationsApi, notificationsApi } from '@/lib/api';
import { Bell, CheckCheck, Trash2, Loader2 } from 'lucide-react';
import { cn, formatRelative } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import type { Notification } from '@/types';

const TYPE_ICONS: Record<string, string> = {
  CERTIFICATION_ASSIGNED: '📋',
  DEADLINE_APPROACHING: '⏰',
  CERTIFICATE_UPLOADED: '📄',
  CERTIFICATION_COMPLETED: '🎉',
  CERTIFICATE_EDIT_REQUESTED: '✏️',
  PROJECT_UPDATED: '🚀',
  PROJECT_ASSIGNED: '👥',
};

const TYPE_COLORS: Record<string, string> = {
  CERTIFICATION_ASSIGNED: 'bg-blue-950/20 border-blue-900/40 text-blue-300',
  DEADLINE_APPROACHING: 'bg-orange-950/20 border-orange-900/40 text-orange-300',
  CERTIFICATE_UPLOADED: 'bg-green-950/20 border-green-900/40 text-green-300',
  CERTIFICATION_COMPLETED: 'bg-green-950/20 border-green-900/40 text-green-300',
  CERTIFICATE_EDIT_REQUESTED: 'bg-amber-950/20 border-amber-900/40 text-amber-300',
  PROJECT_UPDATED: 'bg-purple-950/20 border-purple-900/40 text-purple-300',
  PROJECT_ASSIGNED: 'bg-indigo-950/20 border-indigo-900/40 text-indigo-300',
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission('manageTeam');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ data: Notification[]; unreadCount: number; pagination: { total: number } }>({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ limit: 50 }).then(r => r.data),
    staleTime: 60000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['notifications-count'] }); },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['notifications-count'] }); },
  });

  const del = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const reviewRequest = useMutation({
    mutationFn: ({ id, decision }: { id: string; notificationId: string; decision: 'approve' | 'reject' }) =>
      decision === 'approve'
        ? certificationsApi.approveEditRequest(id)
        : certificationsApi.rejectEditRequest(id),
    onSuccess: (_result, variables) => {
      markRead.mutate(variables.notificationId);
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
      qc.invalidateQueries({ queryKey: ['tracker'] });
      qc.invalidateQueries({ queryKey: ['member'] });
      setExpandedRequestId(null);
    },
  });

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Notifications</h2>
          <p className="page-subtitle">
            {data?.unreadCount || 0} unread · {data?.pagination.total || 0} total
          </p>
        </div>
        {(data?.unreadCount || 0) > 0 && (
          <button onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-white/5 rounded-xl hover:bg-[#1c1926]/80 backdrop-blur-md hover:text-foreground bg-[#1c1926]/80 backdrop-blur-md transition-colors">
            {markAllRead.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            Mark all read
          </button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5 p-4 h-20 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && data?.data.length === 0 && (
        <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl border border-white/5 py-16 text-center">
          <Bell className="w-12 h-12 text-white/50/30 mx-auto mb-3" />
          <p className="text-white/50 font-medium">No notifications yet</p>
          <p className="text-sm text-white/50/60 mt-1">Activity will appear here as your team works</p>
        </div>
      )}

      <div className="space-y-2">
        {data?.data.map(n => {
          const editRequest = n.certificateEditRequest;
          const isPendingEditRequest = isAdmin && editRequest?.status === 'PENDING';
          const isExpanded = expandedRequestId === editRequest?.id;
          const requestedChanges = editRequest?.proposedChanges;

          return (
          <div key={n.id}
            className={cn(
              'group flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer hover:shadow-sm',
              !n.read ? 'bg-azure-500/10 border-azure-500/40 shadow-sm' : 'bg-[#1c1926]/80 backdrop-blur-md border-white/5',
            )}
            onClick={() => !n.read && markRead.mutate(n.id)}
          >
            <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 text-lg', TYPE_COLORS[n.type] || 'bg-muted border-white/5')}>
              {TYPE_ICONS[n.type] || '📢'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={cn('text-sm font-semibold', !n.read && 'text-foreground')}>{n.title}</p>
                <p className="text-xs text-white/50/60 flex-shrink-0 mt-0.5">{formatRelative(n.createdAt)}</p>
              </div>
              <p className="text-sm text-white/50 mt-0.5">{n.message}</p>
              {n.member && (
                <p className="text-xs text-azure-400 mt-1 font-medium">👤 {n.member.name}</p>
              )}
              {isPendingEditRequest && editRequest && (
                <div className="mt-3" onClick={e => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setExpandedRequestId(isExpanded ? null : editRequest.id)}
                      className="px-2.5 py-1.5 text-xs font-medium text-azure-300 border border-azure-800/50 rounded-lg hover:bg-azure-950/40">
                      {isExpanded ? 'Hide request' : 'View edit request'}
                    </button>
                    <button onClick={() => reviewRequest.mutate({ id: editRequest.id, notificationId: n.id, decision: 'approve' })}
                      disabled={reviewRequest.isPending}
                      className="px-2.5 py-1.5 text-xs font-medium text-emerald-300 border border-emerald-800/50 rounded-lg hover:bg-emerald-950/40 disabled:opacity-60">
                      Accept
                    </button>
                    <button onClick={() => reviewRequest.mutate({ id: editRequest.id, notificationId: n.id, decision: 'reject' })}
                      disabled={reviewRequest.isPending}
                      className="px-2.5 py-1.5 text-xs font-medium text-red-300 border border-red-800/50 rounded-lg hover:bg-red-950/40 disabled:opacity-60">
                      Reject
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="mt-2 rounded-lg border border-white/5 bg-black/10 p-3 text-xs text-white/70 space-y-1.5">
                      <p><span className="text-white/50">Certification:</span> {editRequest.assignment?.certification?.name ?? 'Unknown certification'}</p>
                      <p><span className="text-white/50">Team member:</span> {editRequest.assignment?.member?.name ?? 'Unknown member'}</p>
                      <p><span className="text-white/50">Requested by:</span> {editRequest.requestedBy}</p>
                      <p className="pt-1 text-white/50">Requested changes</p>
                      {requestedChanges?.completionDate !== undefined && <p>Completion date → {requestedChanges.completionDate || 'Clear'}</p>}
                      {requestedChanges?.expiryDate !== undefined && <p>Expiry date → {requestedChanges.expiryDate || 'Clear'}</p>}
                      {requestedChanges?.credentialId !== undefined && <p>Credential ID → {requestedChanges.credentialId || 'Clear'}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!n.read && <div className="w-2 h-2 bg-azure-500 rounded-full" />}
              {(isAdmin || n.memberId) && (
                <button onClick={e => { e.stopPropagation(); del.mutate(n.id); }}
                  className="p-1.5 text-white/50 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
