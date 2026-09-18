import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeLinkedinUrl } from '../lib/linkedinUrl';
import { AppError } from '../middleware/errorHandler';

const rejects = (input: unknown) =>
  assert.throws(() => normalizeLinkedinUrl(input), (err: unknown) => {
    assert.ok(err instanceof AppError);
    assert.equal(err.statusCode, 400);
    return true;
  });

test('an omitted field leaves the column untouched, a blank one clears it', () => {
  // The distinction matters: PUT spreads the result, so undefined must not become null.
  assert.equal(normalizeLinkedinUrl(undefined), undefined);
  assert.equal(normalizeLinkedinUrl(''), null);
  assert.equal(normalizeLinkedinUrl('   '), null);
  assert.equal(normalizeLinkedinUrl(null), null);
});

test('a bare host is accepted and given a scheme', () => {
  assert.equal(normalizeLinkedinUrl('linkedin.com/in/someone'), 'https://linkedin.com/in/someone');
  assert.equal(normalizeLinkedinUrl('www.linkedin.com/in/someone'), 'https://www.linkedin.com/in/someone');
});

test('a full https URL survives, and surrounding whitespace is trimmed', () => {
  assert.equal(
    normalizeLinkedinUrl('  https://www.linkedin.com/in/someone  '),
    'https://www.linkedin.com/in/someone',
  );
});

test('regional subdomains are LinkedIn too', () => {
  assert.equal(normalizeLinkedinUrl('https://in.linkedin.com/in/someone'), 'https://in.linkedin.com/in/someone');
});

test('http is upgraded rather than rejected', () => {
  assert.equal(normalizeLinkedinUrl('http://linkedin.com/in/someone'), 'https://linkedin.com/in/someone');
});

test('a script URL is refused', () => {
  // The value is rendered into an href on the profile page, so this is the one that
  // matters. Previously any string was stored verbatim.
  rejects('javascript:alert(1)');
  rejects('data:text/html,<script>alert(1)</script>');
});

test('a host that merely looks like LinkedIn is refused', () => {
  rejects('https://linkedin.com.evil.example/in/someone');
  rejects('https://notlinkedin.com/in/someone');
  rejects('https://evil.example/linkedin.com');
});

test('an over-length value is refused', () => {
  rejects(`https://linkedin.com/in/${'a'.repeat(600)}`);
});

test('a non-string is refused rather than coerced', () => {
  rejects(42);
  rejects({ url: 'https://linkedin.com/in/someone' });
});
