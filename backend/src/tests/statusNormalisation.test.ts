import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeActionItemStatus,
  normalizeActionItemPriority,
  normalizeBlockerStatus,
} from '../lib/meetingContinuity';

/**
 * TT-090: these columns are real enums now, so a value outside the set is rejected by
 * Postgres. The AI pipeline writes three of them straight from model output, so the
 * normalisers are what stand between a hallucinated answer and a 500 in the retry job.
 * Each case below is a value a model has plausibly produced.
 */

test('an invented status becomes the default rather than being stored', () => {
  // Previously stored verbatim, and then silently skipped by every status:'open' filter.
  assert.equal(normalizeActionItemStatus('Critical'), 'open');
  assert.equal(normalizeActionItemStatus('In Review'), 'open');
  assert.equal(normalizeActionItemStatus('done'), 'open');
});

test('casing and separators are tolerated rather than rejected', () => {
  assert.equal(normalizeActionItemStatus('OPEN'), 'open');
  assert.equal(normalizeActionItemStatus(' Completed '), 'completed');
  assert.equal(normalizeActionItemStatus('in-progress'), 'in_progress');
  assert.equal(normalizeActionItemStatus('In Progress'), 'in_progress');
});

test('every allowed status survives unchanged', () => {
  for (const v of ['open', 'completed', 'in_progress', 'blocked']) {
    assert.equal(normalizeActionItemStatus(v), v);
  }
});

test('non-strings do not throw', () => {
  for (const v of [null, undefined, 42, {}, []]) {
    assert.equal(normalizeActionItemStatus(v), 'open');
  }
});

test('an invented priority becomes null, not a bad row', () => {
  assert.equal(normalizeActionItemPriority('Critical'), null);
  assert.equal(normalizeActionItemPriority('P1'), null);
  assert.equal(normalizeActionItemPriority('HIGH'), 'high');
  assert.equal(normalizeActionItemPriority(null), null);
});

test('an invented blocker status falls back to open', () => {
  // 'open' is the safe default: a blocker wrongly marked resolved disappears from the
  // project pulse, which is the failure that actually costs something.
  assert.equal(normalizeBlockerStatus('Mitigated'), 'open');
  assert.equal(normalizeBlockerStatus('RESOLVED'), 'resolved');
  assert.equal(normalizeBlockerStatus(undefined), 'open');
});
