import { Response } from 'express';

/**
 * TT-069: the JWT was handed to the browser in the response body and kept in
 * localStorage, where any script on the page can read it — one XSS, or one compromised
 * dependency, and an attacker has a long-lived, fully privileged session token that works
 * from anywhere.
 *
 * The token is now also set as an httpOnly cookie, which JavaScript cannot read. The
 * body still carries it so that a client mid-deploy, or any caller using the
 * Authorization header, keeps working — authenticateToken accepts either.
 *
 * On same-site: the deployed frontend proxies /api to the backend through the rewrite in
 * frontend/vercel.json, so the cookie is first-party and `lax` is correct. If the API is
 * ever addressed directly on another origin, this needs `none` (and therefore `secure`),
 * which Safari's tracking prevention restricts — hence the env override rather than a
 * hardcoded value.
 */
export const AUTH_COOKIE_NAME = 'tt_session';

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // matches the token's own expiry

function sameSite(): 'lax' | 'strict' | 'none' {
  const configured = (process.env.AUTH_COOKIE_SAMESITE || '').toLowerCase();
  if (configured === 'none' || configured === 'strict' || configured === 'lax') return configured;
  return 'lax';
}

function isSecure(): boolean {
  // `none` is only honoured on a secure cookie, so it implies secure regardless of NODE_ENV.
  if (sameSite() === 'none') return true;
  return (process.env.NODE_ENV || '').toLowerCase() === 'production';
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: sameSite(),
    secure: isSecure(),
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: sameSite(),
    secure: isSecure(),
    path: '/',
  });
}
