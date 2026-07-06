import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isPast, isToday, isThisWeek } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, fmt = 'MMM d, yyyy') {
  return format(new Date(date), fmt);
}

export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function getDeadlineCategory(deadline: string | Date): 'overdue' | 'today' | 'this-week' | 'upcoming' {
  const d = new Date(deadline);
  if (isPast(d) && !isToday(d)) return 'overdue';
  if (isToday(d)) return 'today';
  if (isThisWeek(d)) return 'this-week';
  return 'upcoming';
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    NOT_STARTED: 'badge-not-started',
    IN_PROGRESS: 'badge-in-progress',
    COMPLETED: 'badge-completed',
    OVERDUE: 'badge-overdue',
    EXPIRED: 'badge-expired',
    PLANNING: 'badge-planning',
    ON_HOLD: 'badge-on-hold',
  };
  return map[status] || 'badge-not-started';
}

export function getPriorityColor(priority: string): string {
  const map: Record<string, string> = {
    LOW: 'badge-low',
    MEDIUM: 'badge-medium',
    HIGH: 'badge-high',
    CRITICAL: 'badge-critical',
  };
  return map[priority] || 'badge-low';
}

export function getProgressColor(progress: number): string {
  if (progress >= 80) return 'bg-green-500';
  if (progress >= 50) return 'bg-azure-500';
  if (progress >= 25) return 'bg-yellow-500';
  return 'bg-red-400';
}

export function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export const STATUS_CHART_COLORS: Record<string, string> = {
  NOT_STARTED: '#94a3b8',
  IN_PROGRESS: '#3b82f6',
  COMPLETED: '#22c55e',
  OVERDUE: '#ef4444',
  EXPIRED: '#f97316',
};

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  PLANNING: '#a78bfa',
  IN_PROGRESS: '#3b82f6',
  ON_HOLD: '#f59e0b',
  COMPLETED: '#22c55e',
};
