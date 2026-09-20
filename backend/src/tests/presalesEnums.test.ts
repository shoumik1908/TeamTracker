import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPresalesTrack, assertStageChangeSource } from '../lib/presalesEnums';

/**
 * TT-090 follow-up. Promoting `account` and `source` to enums left three request-fed
 * paths passing input straight to Prisma, so a caller mistake became a 500:
 *
 *   DELETE /presales?...&account=PNB   500 — `mode: 'insensitive'` is invalid on an enum
 *   PATCH  /presales/:id/stage         500 — body `source` written unvalidated
 *   PATCH  /presales/:id/progress      500 — likewise
 *
 * Each case below names what the unguarded version did, so a revert fails here.
 */

test('a valid track passes through, whatever the casing', () => {
  // The delete filter used to match case-insensitively, so this has to keep working.
  assert.equal(assertPresalesTrack('PNB'), 'PNB');
  assert.equal(assertPresalesTrack('pnb'), 'PNB');
  assert.equal(assertPresalesTrack('  Tnm  '), 'TNM');
});

test('an unknown track is a 400, not a database error', () => {
  // Previously reached Prisma and threw, surfacing as a 500 from the delete endpoint.
  for (const bad of ['Contoso Account', 'PNBX', '', 'null']) {
    assert.throws(() => assertPresalesTrack(bad), (e: any) => e.statusCode === 400, `expected 400 for ${JSON.stringify(bad)}`);
  }
});

test('a non-string track is rejected rather than coerced', () => {
  for (const bad of [null, undefined, 42, {}, []]) {
    assert.throws(() => assertPresalesTrack(bad), (e: any) => e.statusCode === 400);
  }
});

test('the error names the allowed values so the caller can act on it', () => {
  assert.throws(() => assertPresalesTrack('nope'), /account must be one of: PNB, TNM\./);
  assert.throws(() => assertStageChangeSource('nope'), /source must be one of: manual, ai_suggested\./);
});

test('a valid stage-change source passes through, whatever the casing', () => {
  assert.equal(assertStageChangeSource('manual'), 'manual');
  assert.equal(assertStageChangeSource('ai_suggested'), 'ai_suggested');
  assert.equal(assertStageChangeSource(' Manual '), 'manual');
  assert.equal(assertStageChangeSource('AI_SUGGESTED'), 'ai_suggested');
});

test('an invented stage-change source is a 400, not a 500', () => {
  // `source: source || 'manual'` sent whatever the caller typed straight to an enum column.
  for (const bad of ['bogus_source', 'automatic', 'ai suggested', 42, {}]) {
    assert.throws(() => assertStageChangeSource(bad), (e: any) => e.statusCode === 400, `expected 400 for ${JSON.stringify(bad)}`);
  }
});
