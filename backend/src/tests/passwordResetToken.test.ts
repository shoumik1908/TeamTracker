import assert from 'node:assert/strict';
import test from 'node:test';
import { createResetToken, readUserIdFromToken, verifyResetToken } from '../services/passwordResetToken';

const hashA = '$2a$10$abcdefghijklmnopqrstuv.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const hashB = '$2a$10$abcdefghijklmnopqrstuv.BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

test('a freshly minted token verifies against the hash it was minted from', () => {
  const token = createResetToken('user-1', hashA);
  assert.equal(verifyResetToken(token, hashA), true);
});

test('the token names the user it was minted for', () => {
  assert.equal(readUserIdFromToken(createResetToken('user-1', hashA)), 'user-1');
});

test('a token stops verifying once the password hash changes — this is what makes it single-use', () => {
  const token = createResetToken('user-1', hashA);
  assert.equal(verifyResetToken(token, hashA), true);
  // Consuming the token sets a new password, so the hash — and therefore the signing
  // key — is different on any replay.
  assert.equal(verifyResetToken(token, hashB), false);
});

test('a token minted for one user does not verify against another user\'s hash', () => {
  const token = createResetToken('user-1', hashA);
  assert.equal(verifyResetToken(token, hashB), false);
});

test('a tampered token does not verify', () => {
  const token = createResetToken('user-1', hashA);
  const tampered = token.slice(0, -4) + 'AAAA';
  assert.equal(verifyResetToken(tampered, hashA), false);
});

test('garbage input is rejected rather than throwing', () => {
  assert.equal(verifyResetToken('not-a-token', hashA), false);
  assert.equal(readUserIdFromToken('not-a-token'), null);
  assert.equal(readUserIdFromToken(''), null);
});
