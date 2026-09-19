import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { toLocalDateString } from './MeetingReportView';

// The suite runs under TZ=UTC (package.json), where local midnight and UTC midnight are
// the same instant — so the bug these tests exist for is unreachable and the previous
// implementation passed them unchanged. Only zones east of Greenwich expose it, so pin
// one for this file. Node re-reads process.env.TZ, and it is restored afterwards so the
// other suites (DashboardGreeting's, which genuinely need UTC) are unaffected.
const originalTZ = process.env.TZ;
beforeAll(() => { process.env.TZ = 'Asia/Kolkata'; });
afterAll(() => { process.env.TZ = originalTZ; });

// TT-126: getRange builds its boundaries at *local* midnight, and the report then sent
// them through toISOString().split('T')[0]. East of Greenwich — IST, which this component
// is explicitly built around — local midnight is the previous day in UTC, so every report
// silently started a day early and could miss meetings on its final day.
describe('report window dates', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the local calendar date for a local-midnight boundary', () => {
    // 1 June 2026, 00:00 local. In any timezone ahead of UTC this is 31 May in UTC.
    const localMidnight = new Date(2026, 5, 1, 0, 0, 0, 0);
    expect(toLocalDateString(localMidnight)).toBe('2026-06-01');
  });

  it('is not the UTC date when the two disagree', () => {
    const localMidnight = new Date(2026, 5, 1, 0, 0, 0, 0);
    const utcDate = localMidnight.toISOString().split('T')[0];
    if (utcDate !== '2026-06-01') {
      // Only meaningful in a timezone where the bug was reachable; assert we differ.
      expect(toLocalDateString(localMidnight)).not.toBe(utcDate);
    }
    expect(toLocalDateString(localMidnight)).toBe('2026-06-01');
  });

  it('pads single-digit months and days', () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 0, 0, 0, 0))).toBe('2026-01-05');
    expect(toLocalDateString(new Date(2026, 8, 9, 23, 59, 59, 999))).toBe('2026-09-09');
  });

  it('is stable across the whole day, so an end boundary keeps its date', () => {
    const start = new Date(2026, 11, 31, 0, 0, 0, 0);
    const end = new Date(2026, 11, 31, 23, 59, 59, 999);
    expect(toLocalDateString(start)).toBe('2026-12-31');
    expect(toLocalDateString(end)).toBe('2026-12-31');
  });
});
