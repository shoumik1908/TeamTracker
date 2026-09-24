import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The session is an httpOnly SameSite=Lax cookie, which a browser will not send on a
 * cross-site request. The deployed app therefore has to reach the API on its own
 * origin, which is what this rewrite is for: /api/* on the Vercel domain is proxied
 * to Render, so the browser only ever sees one site and the cookie travels.
 *
 * It shipped with the literal placeholder still in place, so the proxy pointed at a
 * host that does not exist. The frontend fell back to calling Render directly,
 * cross-site, the cookie was never sent, and every page reload signed the user out.
 *
 * Note the other half of that fix lives in the Vercel project settings: VITE_API_URL
 * must stay unset in production, or `VITE_API_URL || '/api'` in lib/api.ts keeps using
 * an absolute cross-origin URL and bypasses this rewrite entirely. That part cannot be
 * asserted from here.
 */
describe('vercel.json api rewrite', () => {
  const config = JSON.parse(readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8'));
  const apiRule = config.rewrites?.find((r: { source: string }) => r.source === '/api/:path*');

  it('proxies /api to the backend', () => {
    expect(apiRule).toBeDefined();
  });

  it('names a real backend host, not the placeholder', () => {
    expect(apiRule.destination).not.toMatch(/REPLACE-WITH-YOUR-RENDER-URL/);
    expect(apiRule.destination).toMatch(/^https:\/\/[a-z0-9.-]+\/api\/:path\*$/i);
  });

  it('keeps the api rule ahead of the SPA catch-all, which would otherwise swallow it', () => {
    const sources = config.rewrites.map((r: { source: string }) => r.source);
    expect(sources.indexOf('/api/:path*')).toBeLessThan(sources.indexOf('/(.*)'));
  });
});
