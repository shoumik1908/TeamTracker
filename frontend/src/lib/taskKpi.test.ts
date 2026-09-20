import { describe, expect, it } from 'vitest';
import { countTaskDueKpis, dueDayStart } from './taskKpi';

/**
 * TT-157: the "Tasks due this week" tile read the *display* list — sliced to five and
 * never filtered by date — so a member with twenty open tasks saw "5", and the number had
 * nothing to do with the current week. "0 overdue" was hardcoded.
 *
 * Each test states what the old shape returned, so a revert to either mistake is visible.
 * These exercise the function the dashboard actually calls, so dropping it there fails
 * here too.
 */

const NOW = new Date(2026, 5, 15, 12, 0, 0);

/** A due date as the app stores it: the picker sends a day, the server stores UTC midnight. */
const storedDay = (offset: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offset);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
};

describe('tasks-due-this-week KPI', () => {
  it('is not capped at five', () => {
    // The old code sliced to 5 and counted that, so twenty open tasks reported 5.
    const tasks = Array.from({ length: 20 }, () => ({ status: 'TODO', dueDate: storedDay(1) }));
    expect(countTaskDueKpis(tasks, NOW).dueThisWeek).toBe(20);
  });

  it('counts only tasks actually due inside the week', () => {
    // The old code ignored dueDate entirely; all five of these would have counted.
    const tasks = [
      { status: 'TODO', dueDate: storedDay(0) },    // today — in
      { status: 'TODO', dueDate: storedDay(6) },    // within the window — in
      { status: 'TODO', dueDate: storedDay(8) },    // next week — out
      { status: 'TODO', dueDate: null },            // undated — out
      { status: 'TODO', dueDate: storedDay(-3) },   // overdue, not "due this week" — out
    ];
    expect(countTaskDueKpis(tasks, NOW).dueThisWeek).toBe(2);
  });

  it('excludes completed tasks', () => {
    const tasks = [
      { status: 'DONE', dueDate: storedDay(1) },
      { status: 'TODO', dueDate: storedDay(1) },
    ];
    expect(countTaskDueKpis(tasks, NOW).dueThisWeek).toBe(1);
  });

  it('reports a real overdue count rather than a hardcoded zero', () => {
    const tasks = [
      { status: 'TODO', dueDate: storedDay(-1) },
      { status: 'TODO', dueDate: storedDay(-9) },
      { status: 'DONE', dueDate: storedDay(-2) },   // done is not overdue
      { status: 'TODO', dueDate: storedDay(2) },
    ];
    expect(countTaskDueKpis(tasks, NOW).overdue).toBe(2);
  });

  it('a task due later today is due this week, not overdue', () => {
    const tasks = [{ status: 'TODO', dueDate: storedDay(0) }];
    const { dueThisWeek, overdue } = countTaskDueKpis(tasks, NOW);
    expect(dueThisWeek).toBe(1);
    expect(overdue).toBe(0);
  });
});

/**
 * The timezone half. The suite is pinned to TZ=UTC, under which comparing the raw instant
 * against a local midnight happens to be right — which is exactly why the first cut of
 * this fix read a task due *today* as overdue in New York and Los Angeles and nobody
 * noticed. These assert the normalisation itself, so they fail under UTC too if it goes.
 */
describe('due dates are compared by calendar day, not by instant', () => {
  it('normalises a stored due date to midnight of its calendar day', () => {
    const d = dueDayStart('2026-09-19T00:00:00.000Z');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 19]);
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });

  it('keeps the calendar day even when the stored value carries a time', () => {
    // Comparing the raw instant would leave 18:45 on the clock, and any "is it before
    // local midnight today" test would then answer for the wrong day.
    const d = dueDayStart('2026-09-19T18:45:00.000Z');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 19]);
    expect(d.getHours()).toBe(0);
  });

  it('a task due today is due, not overdue, whatever the clock says', () => {
    const now = new Date(2026, 8, 19, 23, 30, 0);            // late in the local day
    const tasks = [{ status: 'TODO', dueDate: '2026-09-19T00:00:00.000Z' }];
    expect(countTaskDueKpis(tasks, now)).toEqual({ dueThisWeek: 1, overdue: 0 });
  });
});
