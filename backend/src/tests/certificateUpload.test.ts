import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCredentialId } from '../services/certificateVerification';

test('persists a credential ID extracted by OCR with a certificate upload', () => {
  assert.equal(normalizeCredentialId('AZ-900-2026-12345'), 'AZ-900-2026-12345');
});

test('accepts a manually entered credential ID and removes accidental whitespace', () => {
  assert.equal(normalizeCredentialId('  AWS-SAA-001  '), 'AWS-SAA-001');
});

test('clears the credential ID when OCR cannot detect one so the upload is unverified', () => {
  assert.equal(normalizeCredentialId(''), null);
  assert.equal(normalizeCredentialId('   '), null);
  assert.equal(normalizeCredentialId(undefined), null);
});

test('does not persist non-string OCR values as credential IDs', () => {
  assert.equal(normalizeCredentialId(null), null);
  assert.equal(normalizeCredentialId(900123), null);
});
