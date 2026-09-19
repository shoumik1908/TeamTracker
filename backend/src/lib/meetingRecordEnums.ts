import { AppError } from '../middleware/errorHandler';

/**
 * TT-090 follow-up: `MeetingRecord.recordingType` and `.transcriptSource` are real enums
 * now, so anything outside their sets is rejected by Postgres.
 *
 * Two things went wrong with the first cut of the guard:
 *
 *   - It threw `AppError(…, 400)` from inside the route's own try/catch, which re-emitted
 *     every error as a 500. The caller got the right message under the wrong status. That
 *     catch now rethrows AppError, the same fix TT-050 applied to the presales handlers.
 *   - It skipped empty strings, and `'' !== 'none'`, so `recordingType=''` sailed past the
 *     check into `meetingRecord.create()` and failed there as an unhandled 500. Multipart
 *     forms send empty fields readily, so that is a live shape even though the current UI
 *     always sends one of the three buttons.
 *
 * "Absent" and the literal `'none'` both mean the same thing here — no recording, no
 * transcript — and the column stores that as NULL, which is why neither enum has a `none`
 * member. Normalising and validating in one place means the route cannot get that pairing
 * wrong again.
 */
export const RECORDING_TYPES = ['file', 'link'] as const;
export type RecordingTypeValue = (typeof RECORDING_TYPES)[number];

export const TRANSCRIPT_SOURCES = ['pasted', 'uploaded_file'] as const;
export type TranscriptSourceValue = (typeof TRANSCRIPT_SOURCES)[number];

function normalize<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new AppError(`${field} must be one of: ${allowed.join(', ')}, none.`, 400);
  }
  const trimmed = value.trim();
  // Absent, blank and the explicit "none" all mean the column stays NULL.
  if (trimmed === '' || trimmed.toLowerCase() === 'none') return null;
  if (!(allowed as readonly string[]).includes(trimmed)) {
    throw new AppError(`${field} must be one of: ${allowed.join(', ')}, none.`, 400);
  }
  return trimmed as T;
}

export function normalizeRecordingType(value: unknown): RecordingTypeValue | null {
  return normalize(value, RECORDING_TYPES, 'recordingType');
}

export function normalizeTranscriptSource(value: unknown): TranscriptSourceValue | null {
  return normalize(value, TRANSCRIPT_SOURCES, 'transcriptSource');
}
