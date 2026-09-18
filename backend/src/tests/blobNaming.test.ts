import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBlobName, sanitizeBlobFileName } from '../services/blobStorage';

test('two uploads of the same filename never share a blob key', () => {
  // This is the whole point of TT-063: the key used to be the sanitized filename, so
  // the second person to upload "resume.pdf" silently overwrote the first.
  const a = buildBlobName('resume.pdf');
  const b = buildBlobName('resume.pdf');
  assert.notEqual(a, b);
});

test('a thousand uploads of one filename produce a thousand distinct keys', () => {
  const keys = new Set(Array.from({ length: 1000 }, () => buildBlobName('cv.pdf')));
  assert.equal(keys.size, 1000);
});

test('the original filename is still recognisable in the key', () => {
  assert.match(buildBlobName('Quarterly Report.pdf'), /Quarterly Report\.pdf$/);
});

test('a caller-supplied prefix is kept, and still namespaced within it', () => {
  const key = buildBlobName('notes.pdf', 'knowledge-sessions/abc123');
  assert.match(key, /^knowledge-sessions\/abc123\//);
  assert.notEqual(key, buildBlobName('notes.pdf', 'knowledge-sessions/abc123'));
});

test('path traversal and separators are stripped from the filename', () => {
  const key = buildBlobName('../../etc/passwd');
  assert.ok(!key.includes('../'), key);
  assert.ok(!key.includes('/etc/'), key);
});

test('sanitizeBlobFileName keeps ordinary characters and replaces the rest', () => {
  assert.equal(sanitizeBlobFileName('Report (final) v2.pdf'), 'Report (final) v2.pdf');
  assert.equal(sanitizeBlobFileName('bad/name?.pdf'), 'bad_name_.pdf');
});
