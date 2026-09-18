import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../lib/jwtSecret';

/**
 * Single-use password reset tokens, without a tokens table.
 *
 * The signing key is derived from JWT_SECRET *and the user's current password hash*.
 * Consuming a token changes the password, which changes the hash, which changes the
 * key — so a spent token can never verify again. Expiry, single use and
 * invalidate-on-use all fall out of that, with no schema change and nothing to clean
 * up. (Django's password-reset tokens work the same way.)
 *
 * It also means a token is invalidated by *any* password change, including one the
 * user makes themselves, which is the behaviour you want.
 */
export const RESET_TOKEN_TTL_MINUTES = 60;

function signingKeyFor(passwordHash: string): string {
  return crypto.createHmac('sha256', JWT_SECRET).update(passwordHash).digest('hex');
}

export function createResetToken(userId: string, passwordHash: string): string {
  return jwt.sign({ sub: userId }, signingKeyFor(passwordHash), {
    expiresIn: `${RESET_TOKEN_TTL_MINUTES}m`,
  });
}

/**
 * Which user is this token for? Decoded WITHOUT verifying, because the key cannot be
 * derived until the user's current hash is loaded. Nothing is trusted from this —
 * the caller must still call verifyResetToken.
 */
export function readUserIdFromToken(token: string): string | null {
  try {
    const decoded = jwt.decode(token);
    const sub = typeof decoded === 'object' && decoded ? decoded.sub : null;
    return typeof sub === 'string' && sub ? sub : null;
  } catch {
    return null;
  }
}

export function verifyResetToken(token: string, passwordHash: string): boolean {
  try {
    jwt.verify(token, signingKeyFor(passwordHash));
    return true;
  } catch {
    return false;
  }
}
