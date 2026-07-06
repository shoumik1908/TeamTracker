import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { Bell, CheckCheck, Trash2, Loader2 } from 'lucide-react';
import { cn, formatRelative } from '@/lib/utils';
import type { Notification } from '@/types';

const TYPE_ICONS: Record<string, string> = {
  CERTIFICATION_ASSIGNED: '📋',
  DEADLINE_APPROACHING: '⏰',
  CERTIFICATE_UPLOADED: '📄',
  CERTIFICATION_COMPLETED: '🎉',
  PROJECT_UPDATED: '🚀',
  PROJECT_ASSIGNED: '👥',
};

const TYPE_COLORS: Record<string, string> = {
  CERTIFICATION_ASSIGNED: 'bg-blue-950/20 border-blue-900/40 text-blue-300',
  DEADLINE_APPROACHING: 'bg-orange-950/20 border-orange-900/40 text-orange-300',
  CERTIFICATE_UPLOADED: 'bg-green-950/20 border-green-900/40 text-green-300',
  CERTIFICATION_COMPLETED: 'bg-green-950/20 border-green-900/40 text-green-300',
  PROJECT_UPDATED: 'bg-purple-950/20 border-purple-900/40 text-purple-300',
  PROJECT_ASSIGNED: 'bg-indigo-950/20 border-indigo-900/40 text-indigo-300',
};

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: Notification[]; unreadCount: number; pagination: { total: number } }>({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ limit: 50 }).then(r => r.data),
    refetchInterval: 15000,
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
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-card hover:text-foreground bg-card transition-colors">
            {markAllRead.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            Mark all read
          </button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 h-20 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && data?.data.length === 0 && (
        <div className="bg-card rounded-xl border border-border py-16 text-center">
          <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No notifications yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Activity will appear here as your team works</p>
        </div>
      )}

      <div className="space-y-2">
        {data?.data.map(n => (
          <div key={n.id}
            className={cn(
              'group flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer hover:shadow-sm',
              !n.read ? 'bg-azure-500/10 border-azure-500/40 shadow-sm' : 'bg-card border-border',
            )}
            onClick={() => !n.read && markRead.mutate(n.id)}
          >
            <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 text-lg', TYPE_COLORS[n.type] || 'bg-muted border-border')}>
              {TYPE_ICONS[n.type] || '📢'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={cn('text-sm font-semibold', !n.read && 'text-foreground')}>{n.title}</p>
                <p className="text-xs text-muted-foreground/60 flex-shrink-0 mt-0.5">{formatRelative(n.createdAt)}</p>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
              {n.member && (
                <p className="text-xs text-azure-400 mt-1 font-medium">👤 {n.member.name}</p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!n.read && <div className="w-2 h-2 bg-azure-500 rounded-full" />}
              <button onClick={e => { e.stopPropagation(); del.mutate(n.id); }}
                className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
