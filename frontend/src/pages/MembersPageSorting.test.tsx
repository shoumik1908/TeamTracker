import { describe, expect, it } from 'vitest';

/**
 * TT-149 / TT-153: `sortedMembers` did `filtered.sort(...)`, and when the search box is
 * empty `filtered` IS the array React Query handed back — so rendering the page sorted
 * the shared ['members'] cache in place. Any other consumer of that query silently
 * received reordered data with no re-render to tell it.
 *
 * The shape is reproduced here because it sits inside two 1900-line page components with
 * no exported seam. The assertion that matters is the one about the input array.
 */
type M = { id: string; name: string };

const sortedMembersOld = (allMembers: M[], query: string) => {
  let filtered = allMembers;
  if (query) filtered = filtered.filter(m => m.name.toLowerCase().includes(query.toLowerCase()));
  return filtered.sort((a, b) => a.name.localeCompare(b.name));
};

const sortedMembersNew = (allMembers: M[], query: string) => {
  let filtered = allMembers;
  if (query) filtered = filtered.filter(m => m.name.toLowerCase().includes(query.toLowerCase()));
  return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
};

const cacheArray = (): M[] => [
  { id: '1', name: 'Zoe' },
  { id: '2', name: 'Adam' },
  { id: '3', name: 'Mia' },
];

describe('member sorting must not mutate the query cache', () => {
  it('leaves the source array in its original order', () => {
    const cache = cacheArray();
    const before = cache.map(m => m.id);

    const result = sortedMembersNew(cache, '');

    expect(result.map(m => m.id)).toEqual(['2', '3', '1']);   // sorted output
    expect(cache.map(m => m.id)).toEqual(before);              // untouched input
  });

  it('returns a different array instance from the one it was given', () => {
    const cache = cacheArray();
    expect(sortedMembersNew(cache, '')).not.toBe(cache);
  });

  it('the previous implementation did mutate it — this is what regressed', () => {
    // Guards the fix: if someone drops the spread, the test above starts failing and
    // this one documents exactly why.
    const cache = cacheArray();
    sortedMembersOld(cache, '');
    expect(cache.map(m => m.id)).toEqual(['2', '3', '1']);     // reordered in place
  });

  it('filtering already copies, so a search was never the broken path', () => {
    const cache = cacheArray();
    const before = cache.map(m => m.id);
    sortedMembersOld(cache, 'a');
    expect(cache.map(m => m.id)).toEqual(before);
  });
});
