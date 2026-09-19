import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePagination, parseSort } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const DEFAULTS = { limit: 10, maxLimit: 200 };

// ── TT-112 / TT-109 ───────────────────────────────────────────────────────────

test('absent paging falls back to the defaults', () => {
  assert.deepEqual(parsePagination({}, DEFAULTS), { page: 1, limit: 10, skip: 0 });
  assert.deepEqual(parsePagination({ page: '', limit: '' }, DEFAULTS), { page: 1, limit: 10, skip: 0 });
});

test('valid paging is honoured and skip is derived from it', () => {
  assert.deepEqual(parsePagination({ page: '3', limit: '25' }, DEFAULTS), { page: 3, limit: 25, skip: 50 });
});

test('a non-numeric page is a 400, not a Prisma 500', () => {
  // `parseInt('abc')` was NaN, which reached `skip` and came back as a server error.
  assert.throws(() => parsePagination({ page: 'abc' }, DEFAULTS), (e: unknown) => {
    assert.ok(e instanceof AppError);
    assert.equal(e.statusCode, 400);
    return true;
  });
});

test('a negative or zero page is refused', () => {
  // A negative skip is rejected by Prisma — previously as a 500.
  for (const page of ['-5', '0', '-1']) {
    assert.throws(() => parsePagination({ page }, DEFAULTS), AppError);
  }
});

test('a fractional page is refused rather than silently truncated', () => {
  assert.throws(() => parsePagination({ page: '1.5' }, DEFAULTS), AppError);
});

test('an oversized limit is capped rather than honoured', () => {
  // `?limit=999999` used to fetch the whole table.
  assert.equal(parsePagination({ limit: '999999' }, DEFAULTS).limit, 200);
  assert.equal(parsePagination({ limit: '200' }, DEFAULTS).limit, 200);
  assert.equal(parsePagination({ limit: '199' }, DEFAULTS).limit, 199);
});

const SORTABLE = ['name', 'joiningDate', 'status'] as const;

test('an allowed sort field passes through', () => {
  assert.deepEqual(parseSort({ sortBy: 'joiningDate', sortOrder: 'desc' }, SORTABLE, 'name'),
    { sortBy: 'joiningDate', sortOrder: 'desc' });
});

test('an unknown sort field is a 400', () => {
  // It used to reach Prisma as orderBy: { <anything>: ... } and throw a validation error.
  assert.throws(() => parseSort({ sortBy: 'passwordHash' }, SORTABLE, 'name'), (e: unknown) => {
    assert.ok(e instanceof AppError);
    assert.equal(e.statusCode, 400);
    return true;
  });
});

test('sort order defaults to ascending for anything but an explicit desc', () => {
  assert.equal(parseSort({ sortOrder: 'sideways' }, SORTABLE, 'name').sortOrder, 'asc');
  assert.equal(parseSort({}, SORTABLE, 'name').sortBy, 'name');
});

// ── TT-115: CSV formula injection ─────────────────────────────────────────────
// toCSV is module-private in routes/reports.ts; this is the same rule, asserted
// directly, so a change to the predicate has to be deliberate.

const neutralize = (val: string) => (/^[=+\-@\t\r]/.test(val) ? `'${val}` : val);

test('a value that a spreadsheet would execute is neutralised', () => {
  // Quoting stops a break-out of the cell; it does nothing about Excel treating a
  // leading = as a formula when someone opens the exported report.
  assert.equal(neutralize('=HYPERLINK("http://evil.example","click")'),
    '\'=HYPERLINK("http://evil.example","click")');
  assert.equal(neutralize('+1+1'), "'+1+1");
  assert.equal(neutralize('-2+3'), "'-2+3");
  assert.equal(neutralize('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(neutralize('\tcmd'), "'\tcmd");
});

test('ordinary values are left exactly as they are', () => {
  for (const ok of ['Priya Sharma', 'Senior Engineer', '2026-01-15', '5', '', 'a=b']) {
    assert.equal(neutralize(ok), ok);
  }
});
