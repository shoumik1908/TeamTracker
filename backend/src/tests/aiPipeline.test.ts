import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSignableBlob } from '../services/blobStorage';
import { correctNamesInTranscript } from '../utils/fuzzyMatch';

// ── TT-062: signing is the last line before the account key is used ───────────

test('a known container is signable', () => {
  assert.doesNotThrow(() => assertSignableBlob('project-documents', 'abc-def/report.pdf'));
  assert.doesNotThrow(() => assertSignableBlob('certificates', 'uuid-cert.pdf'));
});

test('an unknown container is refused', () => {
  // The account key can mint a readable URL for anything in the account, so an
  // unrecognised container name is the difference between "a file this app stores" and
  // "any blob at all".
  assert.throws(() => assertSignableBlob('$logs', 'anything'), /unknown container/i);
  assert.throws(() => assertSignableBlob('', 'anything'), /unknown container/i);
});

test('a path that climbs out of its container is refused', () => {
  assert.throws(() => assertSignableBlob('project-documents', '../certificates/someone.pdf'), /escapes/i);
  assert.throws(() => assertSignableBlob('project-documents', 'a/../../b'), /escapes/i);
  assert.throws(() => assertSignableBlob('project-documents', '/etc/passwd'), /escapes/i);
  // Backslashes are separators for some clients, so "..\\" must not slip past.
  assert.throws(() => assertSignableBlob('project-documents', '..\\certificates\\x.pdf'), /escapes/i);
});

test('a missing blob name is refused', () => {
  assert.throws(() => assertSignableBlob('project-documents', ''), /without a blob name/i);
  assert.throws(() => assertSignableBlob('project-documents', undefined as any), /without a blob name/i);
});

test('a dot-dot inside a filename is not mistaken for a climb', () => {
  assert.doesNotThrow(() => assertSignableBlob('project-documents', 'notes..final.pdf'));
});

// ── TT-064: name correction must not rewrite ordinary words ──────────────────

const MEMBERS = [
  { id: 'm1', name: 'Priya Sharma' },
  { id: 'm2', name: 'Daniel Fox' },
];

test('a misspelled full name is still corrected', () => {
  const { correctedText, corrections } = correctNamesInTranscript('Priya Sharme raised a point.', MEMBERS);
  assert.match(correctedText, /Priya Sharma/);
  assert.equal(corrections.length >= 1, true);
});

test('an ordinary two-word phrase is left alone', () => {
  // The two-word path had no stopword or length guard, so everyday phrases were rewritten
  // into people's names — in the only stored copy of the transcript.
  const input = 'We can do that if the team agrees.';
  const { correctedText } = correctNamesInTranscript(input, MEMBERS);
  assert.equal(correctedText, input);
});

test('short words and stopwords are never treated as names', () => {
  const input = 'It is on for the day, so we go.';
  const { correctedText } = correctNamesInTranscript(input, MEMBERS);
  assert.equal(correctedText, input);
});

test('an unrelated transcript comes back byte-identical', () => {
  const input = 'The migration finished overnight and the dashboards look healthy.';
  const { correctedText, corrections } = correctNamesInTranscript(input, MEMBERS);
  assert.equal(correctedText, input);
  assert.deepEqual(corrections, []);
});

test('no members means no rewriting', () => {
  const input = 'Priya Sharme said something.';
  assert.equal(correctNamesInTranscript(input, []).correctedText, input);
});

test('a large transcript is processed without pathological slowdown', () => {
  // TT-065: this ran fuzz.ratio for every token against every member with no pre-filter
  // or cache, blocking the event loop for seconds inside a two-minute cron.
  const many = Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, name: `Person${i} Surname${i}` }));
  const text = ('the quick brown fox jumped over the lazy dog and nothing else happened ').repeat(3000);
  const started = Date.now();
  const { correctedText } = correctNamesInTranscript(text, many);
  const elapsed = Date.now() - started;
  assert.equal(correctedText, text);
  // Generous: the point is that it is not tens of seconds.
  assert.ok(elapsed < 5000, `took ${elapsed}ms`);
});
