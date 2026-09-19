import { describe, expect, it } from 'vitest';

/**
 * TT-157: the "Tasks due this week" tile read the *display* list — sliced to five and
 * never filtered by date — so a member with twenty open tasks saw "5", and the number
 * had nothing to do with the current week. "0 overdue" was hardcoded.
 *
 * The counting rule is reproduced here rather than imported, because it lives inside a
 * large page component with no seam. Each test states what the old shape returned, so a
 * revert to either mistake is visible.
 */
function countTasks(tasks: Array<{ status: string; dueDate?: string | null }>, now: Date) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const open = tasks.filter(t => t.status !== 'DONE');
  const dueThisWeek = open.filter(t => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due >= startOfToday && due < endOfWeek;
  }).length;
  const overdue = open.filter(t => (t.dueDate ? new Date(t.dueDate) < startOfToday : false)).length;
  return { dueThisWeek, overdue };
}

const NOW = new Date(2026, 5, 15, 12, 0, 0);
const day = (offset: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offset);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
};

describe('tasks-due-this-week KPI', () => {
  it('is not capped at five', () => {
    // The old code sliced to 5 and counted that, so twenty open tasks reported 5.
    const tasks = Array.from({ length: 20 }, () => ({ status: 'TODO', dueDate: day(1) }));
    expect(countTasks(tasks, NOW).dueThisWeek).toBe(20);
  });

  it('counts only tasks actually due inside the week', () => {
    // The old code ignored dueDate entirely; all five of these would have counted.
    const tasks = [
      { status: 'TODO', dueDate: day(0) },    // today — in
      { status: 'TODO', dueDate: day(6) },    // within the window — in
      { status: 'TODO', dueDate: day(8) },    // next week — out
      { status: 'TODO', dueDate: null },      // undated — out
      { status: 'TODO', dueDate: day(-3) },   // overdue, not "due this week" — out
    ];
    expect(countTasks(tasks, NOW).dueThisWeek).toBe(2);
  });

  it('excludes completed tasks', () => {
    const tasks = [
      { status: 'DONE', dueDate: day(1) },
      { status: 'TODO', dueDate: day(1) },
    ];
    expect(countTasks(tasks, NOW).dueThisWeek).toBe(1);
  });

  it('reports a real overdue count rather than a hardcoded zero', () => {
    const tasks = [
      { status: 'TODO', dueDate: day(-1) },
      { status: 'TODO', dueDate: day(-9) },
      { status: 'DONE', dueDate: day(-2) },   // done is not overdue
      { status: 'TODO', dueDate: day(2) },
    ];
    expect(countTasks(tasks, NOW).overdue).toBe(2);
  });

  it('a task due later today is due this week, not overdue', () => {
    const tasks = [{ status: 'TODO', dueDate: day(0) }];
    const { dueThisWeek, overdue } = countTasks(tasks, NOW);
    expect(dueThisWeek).toBe(1);
    expect(overdue).toBe(0);
  });
});
