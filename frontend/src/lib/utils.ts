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

export function extractMeetingDate(text: string, file?: File | null): string | null {
  const sample = text.substring(0, 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  // 1. Try ISO with time (e.g. 2026-07-10 14:30:00 or 2026-07-10T14:30)
  const isoTimeMatch = sample.match(/\b(202\d-[01]\d-[0-3]\d[ T][0-2]\d:[0-5]\d(?::[0-5]\d)?)\b/);
  if (isoTimeMatch) {
    const d = new Date(isoTimeMatch[1].replace(' ', 'T'));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 16);
  }

  // 2. Try text with time (e.g. July 10, 2026 at 2:30 PM or July 10, 2026 14:30)
  const textTimeMatch = sample.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, 202\d(?: at)? \d{1,2}:\d{2}(?: ?[apAP][mM])?)\b/i);
  if (textTimeMatch) {
    const d = new Date(textTimeMatch[1].replace(/ at /i, ' '));
    if (!isNaN(d.getTime())) return toLocal(d);
  }

  // 3. Fallback to ISO date only
  const isoMatch = sample.match(/\b(202\d-[01]\d-[0-3]\d)\b/);
  if (isoMatch) return isoMatch[1];
  
  // 4. Fallback to text date only
  const textMatch = sample.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, 202\d)\b/i);
  if (textMatch) {
    const d = new Date(textMatch[1]);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  
  // 5. Fallback to file creation time
  if (file && file.lastModified) {
    const d = new Date(file.lastModified);
    if (!isNaN(d.getTime())) return toLocal(d);
  }
  
  return null;
}
