import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertActionItemStatus,
  onlyIdsOfferedToTheModel,
  completedActionItemIds,
} from '../lib/meetingContinuity';
import { AppError } from '../middleware/errorHandler';
import { getContainerNameFromUrl } from '../services/blobStorage';

// ── TT-040 ────────────────────────────────────────────────────────────────────

const OFFERED = [{ id: 'blk_own_1' }, { id: 'blk_own_2' }];

test('an id the model was shown is kept', () => {
  assert.deepEqual(onlyIdsOfferedToTheModel(['blk_own_1'], OFFERED), ['blk_own_1']);
});

test("an id belonging to another project is dropped", () => {
  // This is the finding: transcript text reaches the prompt verbatim, so a prompt-injected
  // transcript could name a blocker in a project the caller cannot see and have it closed.
  assert.deepEqual(onlyIdsOfferedToTheModel(['blk_other_project'], OFFERED), []);
});

test('a hallucinated id is dropped rather than thrown on', () => {
  // Previously this reached update({where:{id}}), which threw after the meeting record
  // and its children had already been written — a half-populated record and a 500.
  assert.deepEqual(onlyIdsOfferedToTheModel(['does-not-exist'], OFFERED), []);
});

test('a mixed answer keeps only the legitimate ids, in order', () => {
  const got = onlyIdsOfferedToTheModel(['blk_other', 'blk_own_2', 'nope', 'blk_own_1'], OFFERED);
  assert.deepEqual(got, ['blk_own_2', 'blk_own_1']);
});

test('non-array and non-string model output is tolerated', () => {
  for (const junk of [undefined, null, 'blk_own_1', 42, {}]) {
    assert.deepEqual(onlyIdsOfferedToTheModel(junk, OFFERED), []);
  }
  assert.deepEqual(onlyIdsOfferedToTheModel([null, 42, {}, 'blk_own_1'], OFFERED), ['blk_own_1']);
});

test('nothing is resolvable when the model was shown nothing', () => {
  assert.deepEqual(onlyIdsOfferedToTheModel(['blk_own_1'], []), []);
});

test('only items the model marked completed are collected', () => {
  const updated = [
    { id: 'a', new_status: 'completed' },
    { id: 'b', new_status: 'open' },
    { id: 'c' },
    null,
    { new_status: 'completed' },
  ];
  assert.deepEqual(completedActionItemIds(updated), ['a', undefined]);
  // …and the id filter above is what removes the undefined.
  assert.deepEqual(onlyIdsOfferedToTheModel(completedActionItemIds(updated), [{ id: 'a' }]), ['a']);
});

test('malformed updated_previous_action_items yields nothing', () => {
  for (const junk of [undefined, null, 'completed', {}]) {
    assert.deepEqual(completedActionItemIds(junk), []);
  }
});

// ── TT-041 ────────────────────────────────────────────────────────────────────

test('a known status is accepted', () => {
  assert.equal(assertActionItemStatus('open'), 'open');
  assert.equal(assertActionItemStatus('completed'), 'completed');
});

test('an arbitrary string is refused with a 400', () => {
  // It used to be stored verbatim, and the status === 'open' queries that build the
  // prior-context prompt then stopped matching that row entirely.
  assert.throws(() => assertActionItemStatus('probably done'), (e: unknown) => {
    assert.ok(e instanceof AppError);
    assert.equal(e.statusCode, 400);
    return true;
  });
});

test('a missing or non-string status is refused', () => {
  for (const junk of [undefined, null, 1, true, {}]) {
    assert.throws(() => assertActionItemStatus(junk), AppError);
  }
});

// ── TT-036 / TT-042 ───────────────────────────────────────────────────────────

test('the container is read back off the stored blob URL', () => {
  // Both fixes depend on this: the delete paths hardcoded project-documents while the
  // uploads went to project-recordings and presales-documents.
  assert.equal(
    getContainerNameFromUrl('https://acct.blob.core.windows.net/project-recordings/abc-def/talk.mp4'),
    'project-recordings');
  assert.equal(
    getContainerNameFromUrl('https://acct.blob.core.windows.net/presales-documents/abc-def/deck.pdf'),
    'presales-documents');
});

test('an unparseable URL falls back rather than throwing', () => {
  assert.equal(getContainerNameFromUrl('not a url'), 'project-documents');
});
