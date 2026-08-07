import { describe, expect, it, vi } from 'vitest';
import {
  cn,
  extractMeetingDate,
  formatStatus,
  getDeadlineCategory,
  getInitials,
  getPriorityColor,
  getProgressColor,
  getStatusColor,
} from './utils';

describe('shared UI utilities', () => {
  it('merges conflicting Tailwind classes', () => {
    expect(cn('px-2 text-red-400', 'px-4')).toBe('text-red-400 px-4');
  });

  it('maps statuses, priorities, and progress values to the expected styles', () => {
    expect(getStatusColor('COMPLETED')).toBe('badge-completed');
    expect(getStatusColor('UNKNOWN')).toBe('badge-not-started');
    expect(getPriorityColor('CRITICAL')).toBe('badge-critical');
    expect(getPriorityColor('UNKNOWN')).toBe('badge-low');
    expect(getProgressColor(80)).toBe('bg-green-500');
    expect(getProgressColor(50)).toBe('bg-azure-500');
    expect(getProgressColor(25)).toBe('bg-yellow-500');
    expect(getProgressColor(24)).toBe('bg-red-400');
  });

  it('formats status labels and member initials', () => {
    expect(formatStatus('IN_PROGRESS')).toBe('In Progress');
    expect(getInitials('Alice Jane Johnson')).toBe('AJ');
  });

  it('categorizes deadlines relative to the current day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 7, 10));

    expect(getDeadlineCategory(new Date(2026, 7, 6, 12))).toBe('overdue');
    expect(getDeadlineCategory(new Date(2026, 7, 7, 18))).toBe('today');
    expect(getDeadlineCategory(new Date(2026, 7, 8, 12))).toBe('this-week');
    expect(getDeadlineCategory(new Date(2026, 7, 17, 12))).toBe('upcoming');

    vi.useRealTimers();
  });

  it('extracts meeting dates from ISO, text, and file metadata fallbacks', () => {
    expect(extractMeetingDate('Meeting starts 2026-08-10 14:30:00')).toBe('2026-08-10T14:30');
    expect(extractMeetingDate('Meeting date: August 11, 2026')).toBe('2026-08-11');

    const file = new File(['minutes'], 'minutes.txt', { lastModified: new Date(2026, 7, 12, 9, 15).getTime() });
    expect(extractMeetingDate('No date is available', file)).toBe('2026-08-12T09:15');
    expect(extractMeetingDate('No date is available')).toBeNull();
  });
});
