import { AppError } from '../middleware/errorHandler';

// TT-041: `status` went from the request body straight into the column. Anything at all
// could be stored, and the `status === 'open'` queries that build the prior-context
// prompts and the open-items lists silently stopped matching those rows.
export const ACTION_ITEM_STATUSES = ['open', 'completed', 'in_progress', 'blocked'] as const;
// Since TT-090 these columns are real enums, so the helpers return the exact union
// Prisma expects rather than a bare string — the compiler now catches a value that the
// database would reject at runtime.
export type ActionItemStatusValue = (typeof ACTION_ITEM_STATUSES)[number];

export function assertActionItemStatus(value: unknown): ActionItemStatusValue {
  if (typeof value !== 'string' || !ACTION_ITEM_STATUSES.includes(value as any)) {
    throw new AppError(`status must be one of: ${ACTION_ITEM_STATUSES.join(', ')}.`, 400);
  }
  return value as ActionItemStatusValue;
}

/**
 * TT-040: the model's `resolved_previous_blocker_ids` and `updated_previous_action_items`
 * were written straight to the database. Transcript text is caller-supplied and reaches
 * the prompt verbatim, so a prompt-injected transcript could name the id of a blocker or
 * action item in *any other* project and have it marked resolved — and one hallucinated
 * id threw mid-write, leaving a half-populated meeting record behind.
 *
 * The model is only ever shown the ids gathered for this project or opportunity, so
 * anything outside that set is either injected or invented. Keep the intersection.
 */
export function onlyIdsOfferedToTheModel(returned: unknown, offered: { id: string }[]): string[] {
  if (!Array.isArray(returned)) return [];
  const allowed = new Set(offered.map(o => o.id));
  return returned.filter((id): id is string => typeof id === 'string' && allowed.has(id));
}

/**
 * Pull the ids the model says are now complete out of its `updated_previous_action_items`,
 * tolerating the shapes it actually emits (missing entries, nulls, absent `new_status`).
 */
export function completedActionItemIds(updated: unknown): unknown[] {
  if (!Array.isArray(updated)) return [];
  return updated.filter((u: any) => u?.new_status === 'completed').map((u: any) => u?.id);
}

/**
 * TT-090: the AI pipeline wrote these columns straight from model output —
 * `ai.status.toLowerCase()`, `b.status || 'open'`, `ai.priority || null`. The columns are
 * free-text, so a model answering "Critical" or "In Review" was stored happily and then
 * silently excluded from every `status: 'open'` filter that drives the prior-context
 * prompts and the project pulse. Nobody could tell afterwards.
 *
 * These normalise to the documented set before anything is written, which is also what
 * makes promoting the columns to real enums safe: an unrecognised value becomes the
 * sensible default here rather than a runtime error at the database.
 */
export function normalizeActionItemStatus(value: unknown): ActionItemStatusValue {
  if (typeof value !== 'string') return 'open';
  const v = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return (ACTION_ITEM_STATUSES as readonly string[]).includes(v) ? (v as ActionItemStatusValue) : 'open';
}

export const ACTION_ITEM_PRIORITIES = ['high', 'medium', 'low'] as const;
export type ActionItemPriorityValue = (typeof ACTION_ITEM_PRIORITIES)[number];

export function normalizeActionItemPriority(value: unknown): ActionItemPriorityValue | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return (ACTION_ITEM_PRIORITIES as readonly string[]).includes(v) ? (v as ActionItemPriorityValue) : null;
}

export const BLOCKER_STATUSES = ['open', 'resolved'] as const;
export type BlockerStatusValue = (typeof BLOCKER_STATUSES)[number];

export function normalizeBlockerStatus(value: unknown): BlockerStatusValue {
  if (typeof value !== 'string') return 'open';
  const v = value.trim().toLowerCase();
  return (BLOCKER_STATUSES as readonly string[]).includes(v) ? (v as BlockerStatusValue) : 'open';
}
