import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeRecordingType, normalizeTranscriptSource } from '../lib/meetingRecordEnums';

/**
 * TT-090 follow-up. `recordingType` and `transcriptSource` became enums, and the first
 * guard had two holes, both of which reached the client as a 500:
 *
 *   recordingType=bogus  ->  the right message under a 500, because the route's own
 *                            catch re-emitted every error as one
 *   recordingType=''     ->  skipped by the guard, `'' !== 'none'`, so it reached
 *                            meetingRecord.create() and Postgres rejected it
 *
 * Each case names what the unguarded version did, so a revert fails here.
 */

test('absent, blank and "none" all mean NULL', () => {
  // The column has no `none` member — "no recording" is stored as NULL. The blank case
  // is the one that used to reach Prisma and 500; multipart forms send it readily.
  for (const v of [undefined, null, '', '   ', 'none', 'None', ' NONE ']) {
    assert.equal(normalizeRecordingType(v), null, `recordingType ${JSON.stringify(v)}`);
    assert.equal(normalizeTranscriptSource(v), null, `transcriptSource ${JSON.stringify(v)}`);
  }
});

test('every allowed value survives unchanged', () => {
  assert.equal(normalizeRecordingType('file'), 'file');
  assert.equal(normalizeRecordingType('link'), 'link');
  assert.equal(normalizeTranscriptSource('pasted'), 'pasted');
  assert.equal(normalizeTranscriptSource('uploaded_file'), 'uploaded_file');
});

test('surrounding whitespace does not make a valid value invalid', () => {
  assert.equal(normalizeRecordingType('  link  '), 'link');
  assert.equal(normalizeTranscriptSource(' pasted '), 'pasted');
});

test('an unknown value is a 400, not a database error', () => {
  for (const bad of ['bogus', 'FILE', 'uploaded-file', 'video']) {
    assert.throws(() => normalizeRecordingType(bad), (e: any) => e.statusCode === 400, `recordingType ${bad}`);
  }
  for (const bad of ['bogus', 'PASTED', 'upload', 'typed']) {
    assert.throws(() => normalizeTranscriptSource(bad), (e: any) => e.statusCode === 400, `transcriptSource ${bad}`);
  }
});

test('a non-string is rejected rather than coerced', () => {
  for (const bad of [42, {}, [], true]) {
    assert.throws(() => normalizeRecordingType(bad), (e: any) => e.statusCode === 400);
    assert.throws(() => normalizeTranscriptSource(bad), (e: any) => e.statusCode === 400);
  }
});

test('the error names the allowed values, none included', () => {
  assert.throws(() => normalizeRecordingType('nope'), /recordingType must be one of: file, link, none\./);
  assert.throws(() => normalizeTranscriptSource('nope'), /transcriptSource must be one of: pasted, uploaded_file, none\./);
});
