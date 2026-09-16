import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCredentialId } from '../services/certificateVerification';

// These cases were previously titled as if they covered certificate upload and OCR
// persistence (audit TT-120). They do not: every one exercises normalizeCredentialId,
// a pure string helper, with no database, upload or OCR involved. The titles now say
// so. Real upload/OCR coverage needs a test-database harness and does not exist yet.

test('normalizeCredentialId leaves a well-formed credential ID untouched', () => {
  assert.equal(normalizeCredentialId('AZ-900-2026-12345'), 'AZ-900-2026-12345');
});

test('normalizeCredentialId trims surrounding whitespace', () => {
  assert.equal(normalizeCredentialId('  AWS-SAA-001  '), 'AWS-SAA-001');
});

test('normalizeCredentialId returns null for empty, blank or undefined input', () => {
  assert.equal(normalizeCredentialId(''), null);
  assert.equal(normalizeCredentialId('   '), null);
  assert.equal(normalizeCredentialId(undefined), null);
});

test('normalizeCredentialId returns null for non-string input', () => {
  assert.equal(normalizeCredentialId(null), null);
  assert.equal(normalizeCredentialId(900123), null);
});
