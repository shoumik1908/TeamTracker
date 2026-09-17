import assert from 'node:assert/strict';
import test from 'node:test';
import { canActOnOwnedRecord, scopedMemberId, verifyContextMember } from '../lib/contextAccess';

const admin = { teamMemberId: 'member-1', permissions: { manageTeam: true } };
const member = { teamMemberId: 'member-1', permissions: { manageTeam: false } };
const other = { teamMemberId: 'member-2', permissions: { manageTeam: false } };
const unlinked = { teamMemberId: null, permissions: { manageTeam: false } };

// ── scopedMemberId ────────────────────────────────────────────────────────────
// A caller with no linked team member must match nothing. Previously this was
// spelled `memberId: user?.teamMemberId` (Prisma drops undefined, so the constraint
// vanished) or `if (!isAdmin && memberId)` (the filter was skipped entirely) — both
// returned the whole table.

test('scopedMemberId returns the caller\'s own team member id', () => {
  assert.equal(scopedMemberId(member), 'member-1');
});

test('scopedMemberId never returns undefined or null for an unlinked caller', () => {
  for (const u of [unlinked, {}, undefined]) {
    const scope = scopedMemberId(u as any);
    assert.equal(typeof scope, 'string');
    assert.ok(scope.length > 0);
  }
});

test('scopedMemberId yields a sentinel that cannot collide with a real cuid', () => {
  // cuids are lowercase alphanumeric and never contain underscores.
  assert.match(scopedMemberId(unlinked), /^__/);
  assert.notEqual(scopedMemberId(unlinked), scopedMemberId(member));
});

// ── canActOnOwnedRecord ───────────────────────────────────────────────────────

test('canActOnOwnedRecord lets an admin act on anyone\'s record', () => {
  assert.equal(canActOnOwnedRecord('member-2', admin), true);
});

test('canActOnOwnedRecord lets a member act on their own record', () => {
  assert.equal(canActOnOwnedRecord('member-1', member), true);
});

test('canActOnOwnedRecord refuses a member acting on someone else\'s record', () => {
  assert.equal(canActOnOwnedRecord('member-2', member), false);
  assert.equal(canActOnOwnedRecord('member-1', other), false);
});

test('canActOnOwnedRecord refuses a caller with no team member profile', () => {
  assert.equal(canActOnOwnedRecord('member-1', unlinked), false);
  assert.equal(canActOnOwnedRecord(null, unlinked), false);
});

test('canActOnOwnedRecord does not treat two absent ids as a match', () => {
  // Both null must not satisfy `owner === caller`.
  assert.equal(canActOnOwnedRecord(null, { teamMemberId: null, permissions: {} }), false);
  assert.equal(canActOnOwnedRecord(undefined, {}), false);
});

test('canActOnOwnedRecord refuses when there is no user at all', () => {
  assert.equal(canActOnOwnedRecord('member-1', undefined), false);
});

// ── verifyContextMember: the two branches that never reach the database ───────

test('verifyContextMember admits an admin without consulting the database', async () => {
  await verifyContextMember('project-1', undefined, admin);
});

test('verifyContextMember rejects a caller with no team member profile', async () => {
  await assert.rejects(
    () => verifyContextMember('project-1', undefined, unlinked),
    (e: any) => e.statusCode === 403,
  );
});

test('verifyContextMember rejects when there is no user context', async () => {
  await assert.rejects(
    () => verifyContextMember('project-1', undefined, undefined),
    (e: any) => e.statusCode === 401,
  );
});
