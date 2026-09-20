import { AppError } from '../middleware/errorHandler';

/**
 * TT-090 follow-up: `PreSalesOpportunity.account` and `StageChangeLog.source` became real
 * enums, so a value outside the set is rejected by Postgres. Three request-fed paths still
 * passed their input straight through, which turned a caller mistake into a 500 — the
 * thing the backend rules forbid, and the reason `members.status` was validated at its
 * route in the same change. These were missed:
 *
 *   - DELETE /presales      filtered `account` with `mode: 'insensitive'`, which Prisma
 *                           rejects on an enum field. `whereClause` is typed `any`, so the
 *                           compiler could not catch it and the endpoint threw at runtime.
 *   - PATCH /presales/:id/stage     wrote `source` from the body unvalidated.
 *   - PATCH /presales/:id/progress  likewise.
 *
 * Casing is normalised before the check so the account filter keeps behaving as it did
 * while the column was free text and matched case-insensitively.
 */
export const PRESALES_TRACKS = ['PNB', 'TNM'] as const;
export type PresalesTrackValue = (typeof PRESALES_TRACKS)[number];

export function assertPresalesTrack(value: unknown): PresalesTrackValue {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!(PRESALES_TRACKS as readonly string[]).includes(normalized)) {
    throw new AppError(`account must be one of: ${PRESALES_TRACKS.join(', ')}.`, 400);
  }
  return normalized as PresalesTrackValue;
}

export const STAGE_CHANGE_SOURCES = ['manual', 'ai_suggested'] as const;
export type StageChangeSourceValue = (typeof STAGE_CHANGE_SOURCES)[number];

export function assertStageChangeSource(value: unknown): StageChangeSourceValue {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!(STAGE_CHANGE_SOURCES as readonly string[]).includes(normalized)) {
    throw new AppError(`source must be one of: ${STAGE_CHANGE_SOURCES.join(', ')}.`, 400);
  }
  return normalized as StageChangeSourceValue;
}
