import { AppError } from '../middleware/errorHandler';

// The field is labelled "LinkedIn Profile URL" and is rendered as a clickable link on
// a member's profile. Nothing validated it, and the profile page prefixed a scheme at
// render time — so any string a member typed became a live link on their own profile.
// Validation belongs at write time, where it can be enforced once for every caller.

const MAX_LENGTH = 500;

function isLinkedInHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'linkedin.com' || host.endsWith('.linkedin.com');
}

/**
 * Normalise a LinkedIn profile URL for storage.
 *
 * Returns `undefined` when the field was not supplied at all, so callers can leave the
 * column untouched; `null` when it was supplied but blank, which clears it.
 * Throws AppError(400) for anything that is not a LinkedIn URL.
 */
export function normalizeLinkedinUrl(input: unknown): string | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;

  if (typeof input !== 'string') {
    throw new AppError('LinkedIn profile URL must be text.', 400);
  }

  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.length > MAX_LENGTH) {
    throw new AppError(`LinkedIn profile URL must be ${MAX_LENGTH} characters or fewer.`, 400);
  }

  // Accept what people actually paste — "linkedin.com/in/me" as readily as the full
  // URL. Anything with an explicit scheme keeps it, so the checks below still see it.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new AppError('That does not look like a valid LinkedIn profile URL.', 400);
  }

  // http is upgraded rather than rejected; everything else — javascript:, data:,
  // file: — is refused outright, since the value ends up in an href.
  if (url.protocol === 'http:') {
    url.protocol = 'https:';
  } else if (url.protocol !== 'https:') {
    throw new AppError('LinkedIn profile URL must start with https://.', 400);
  }

  if (!isLinkedInHost(url.hostname)) {
    throw new AppError('That must be a linkedin.com URL.', 400);
  }

  return url.toString();
}
