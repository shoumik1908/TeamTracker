/**
 * Normalizes an OCR or manually entered credential ID for persistence.
 * A blank value deliberately clears any prior ID so the uploaded certificate
 * remains unverified until a usable credential ID is supplied.
 */
export function normalizeCredentialId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
