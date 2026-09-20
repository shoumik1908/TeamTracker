export type TaskDueLike = { status: string; dueDate?: string | null };

/**
 * The calendar day a stored due date refers to, as local midnight of that day.
 *
 * A due date is picked as a day, never a time: the task form sends `YYYY-MM-DD` and the
 * server stores `new Date("YYYY-MM-DD")`, which is midnight *UTC*. Comparing that instant
 * against a local midnight "today" is off by a day for anyone west of UTC — a task due
 * today came back as overdue in New York and Los Angeles, while reading correctly in UTC
 * and IST. Taking the UTC calendar parts and rebuilding them as a local day makes the
 * comparison a day-to-day one, which is what the KPI is actually asking.
 */
export function dueDayStart(value: string | Date): Date {
  const parsed = value instanceof Date ? value : new Date(value);
  return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

/**
 * "Tasks due this week" and its overdue count, over the full task list.
 *
 * This used to read the display list, which was sliced to five and never filtered by
 * date, so a member with twenty open tasks saw "5" and the number had nothing to do with
 * the current week. "0 overdue" was a literal.
 */
export function countTaskDueKpis(tasks: TaskDueLike[], now: Date = new Date()) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const open = tasks.filter(t => t.status !== 'DONE');

  const dueThisWeek = open.filter(t => {
    if (!t.dueDate) return false;
    const due = dueDayStart(t.dueDate);
    return due >= startOfToday && due < endOfWeek;
  }).length;

  const overdue = open.filter(t => {
    if (!t.dueDate) return false;
    return dueDayStart(t.dueDate) < startOfToday;
  }).length;

  return { dueThisWeek, overdue };
}
