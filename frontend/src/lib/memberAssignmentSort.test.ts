import { describe, expect, it } from 'vitest';
import { sortMembersForAssignment } from './memberAssignmentSort';

/**
 * TT-149 / TT-153: the assign-member panels in ProjectDetailPage and PreSalesDetailPage
 * did `filtered.sort(...)`, and when the search box is empty `filtered` IS the array React
 * Query handed back — so rendering either page sorted the shared ['members'] cache in
 * place. Any other consumer of that query silently received reordered data with no
 * re-render to tell it.
 *
 * The first cut of these tests re-implemented the sort locally, which meant they passed
 * whether or not the pages were fixed. They now exercise the function both pages call, so
 * dropping the copy fails the suite.
 */

type M = { id: string; name: string; allocationStatus?: string | null };

const cacheArray = (): M[] => [
  { id: '1', name: 'Zoe', allocationStatus: 'BENCHED' },
  { id: '2', name: 'Adam', allocationStatus: 'BENCHED' },
  { id: '3', name: 'Mia', allocationStatus: 'BENCHED' },
];

describe('member sorting must not mutate the query cache', () => {
  it('leaves the source array in its original order', () => {
    const cache = cacheArray();
    const before = cache.map(m => m.id);

    const result = sortMembersForAssignment(cache, '', []);

    expect(result.map(m => m.id)).toEqual(['2', '3', '1']);   // sorted output
    expect(cache.map(m => m.id)).toEqual(before);              // untouched input
  });

  it('returns a different array instance from the one it was given', () => {
    const cache = cacheArray();
    expect(sortMembersForAssignment(cache, '', [])).not.toBe(cache);
  });

  it('does not mutate even when a search has already filtered the list', () => {
    const cache = cacheArray();
    const before = cache.map(m => m.id);
    sortMembersForAssignment(cache, 'a', []);
    expect(cache.map(m => m.id)).toEqual(before);
  });
});

describe('the ordering the panels rely on', () => {
  it('sinks members who are already assigned to the bottom', () => {
    const members = cacheArray();
    const result = sortMembersForAssignment(members, '', [{ member: { id: '2' } }]);
    expect(result.map(m => m.id)).toEqual(['3', '1', '2']);
  });

  it('floats members ticked for assignment to the top', () => {
    const members = cacheArray();
    const result = sortMembersForAssignment(members, '', [], new Set(['1']));
    expect(result[0].id).toBe('1');
  });

  it('orders benched before allocated before anything else', () => {
    const members: M[] = [
      { id: 'a', name: 'A', allocationStatus: 'ALLOCATED' },
      { id: 'b', name: 'B', allocationStatus: null },
      { id: 'c', name: 'C', allocationStatus: 'BENCHED' },
    ];
    expect(sortMembersForAssignment(members, '', []).map(m => m.id)).toEqual(['c', 'a', 'b']);
  });

  it('filters by name, case-insensitively', () => {
    const result = sortMembersForAssignment(cacheArray(), 'mi', []);
    expect(result.map(m => m.name)).toEqual(['Mia']);
  });
});
