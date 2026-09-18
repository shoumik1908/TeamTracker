import { AppError } from '../middleware/errorHandler';

// TT-041: `status` went from the request body straight into the column. Anything at all
// could be stored, and the `status === 'open'` queries that build the prior-context
// prompts and the open-items lists silently stopped matching those rows.
export const ACTION_ITEM_STATUSES = ['open', 'completed', 'in_progress', 'blocked'] as const;

export function assertActionItemStatus(value: unknown): string {
  if (typeof value !== 'string' || !ACTION_ITEM_STATUSES.includes(value as any)) {
    throw new AppError(`status must be one of: ${ACTION_ITEM_STATUSES.join(', ')}.`, 400);
  }
  return value;
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
