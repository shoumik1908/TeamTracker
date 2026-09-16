import { createHash } from 'crypto';

// Single source of truth for the JWT signing secret.
//
// There is deliberately no fallback value. A default here would be committed to
// the repository, and anyone holding it could mint a token with arbitrary id,
// roleId and permissions.manageTeam claims — requirePermission trusts the
// token's claims verbatim, so that is full admin access. Refusing to boot is
// the safer failure.
const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error(
    'JWT_SECRET is not set — refusing to start.\n' +
      '  local:      add JWT_SECRET to backend/.env\n' +
      '  production: set it in the Render dashboard (declared in render.yaml)\n' +
      '  generate:   openssl rand -base64 48',
  );
}

// The secret this code used to fall back to is public in this repository's git
// history, so it can never be used again. Compared as a digest so the retired
// value is not re-committed here for secret scanners to keep finding.
const RETIRED_SECRET_SHA256 =
  '91c639766b2b68c20122fe5cdf48fb4f15dedbae82b896ba8d4f2b8e8fe09a68';

if (createHash('sha256').update(secret).digest('hex') === RETIRED_SECRET_SHA256) {
  throw new Error(
    'JWT_SECRET is set to the retired hardcoded fallback, which is public in ' +
      'this repository. Generate a new one: openssl rand -base64 48',
  );
}

export const JWT_SECRET = secret;
