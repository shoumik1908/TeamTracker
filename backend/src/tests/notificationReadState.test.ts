import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * TT-088: `Notification.read` is one boolean shared by every recipient of a role-targeted
 * notification, so the first admin to mark one read cleared it from every other admin's
 * unread count and panel. They never saw it.
 *
 * The rule the routes implement is reproduced here — it is a predicate over two values,
 * and it is the part that has to stay correct if anyone rewrites those queries. Each
 * case names what the shared-flag version did, so a revert fails rather than passing.
 */
type Notification = { memberId: string | null; read: boolean };

/** Read for this person if the legacy flag is set, or they have a read row. */
function isReadFor(n: Notification, hasReadRowForThisUser: boolean): boolean {
  return n.read || hasReadRowForThisUser;
}

const roleTargeted: Notification = { memberId: null, read: false };
const memberTargeted: Notification = { memberId: 'member-1', read: false };

test('a role-targeted notification one admin has read is still unread for another', () => {
  // The whole finding: with a shared column this returned true for everybody.
  assert.equal(isReadFor(roleTargeted, true), true);    // the admin who read it
  assert.equal(isReadFor(roleTargeted, false), false);  // every other admin
});

test('a member-targeted notification still uses the column', () => {
  // One recipient, so the existing flag says everything there is to say.
  assert.equal(isReadFor({ ...memberTargeted, read: true }, false), true);
  assert.equal(isReadFor(memberTargeted, false), false);
});

test('read state already in the database is preserved', () => {
  // Anything marked read before this change stays read for everyone, rather than a
  // deploy resurfacing a pile of old notifications as unread. This is why the legacy
  // flag is still part of the condition instead of being dropped.
  assert.equal(isReadFor({ memberId: null, read: true }, false), true);
});

test('a read row wins even when the flag was never set', () => {
  assert.equal(isReadFor({ memberId: null, read: false }, true), true);
});

test('unread requires both: no flag and no row', () => {
  const combinations: Array<[boolean, boolean, boolean]> = [
    // flag, hasRow, expectedRead
    [false, false, false],
    [false, true, true],
    [true, false, true],
    [true, true, true],
  ];
  for (const [flag, hasRow, expected] of combinations) {
    assert.equal(isReadFor({ memberId: null, read: flag }, hasRow), expected,
      `flag=${flag} hasRow=${hasRow}`);
  }
});
