import { AppError } from '../middleware/errorHandler';

/**
 * TT-112 / TT-109: `page` and `limit` were parseInt'd straight off the query string and
 * fed to Prisma. `?page=abc` produced NaN, which reached `skip` and surfaced as a 500;
 * `?page=-5` produced a negative skip, which Prisma also rejects; and `?limit=999999`
 * was honoured, so one request could ask for the entire table.
 */
export function parsePagination(
  query: { page?: unknown; limit?: unknown },
  defaults: { limit: number; maxLimit: number },
): { page: number; limit: number; skip: number } {
  const page = toPositiveInt(query.page, 1, 'page');
  const limit = Math.min(toPositiveInt(query.limit, defaults.limit, 'limit'), defaults.maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

function toPositiveInt(value: unknown, fallback: number, name: string): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw new AppError(`${name} must be a positive whole number.`, 400);
  }
  return n;
}

/**
 * TT-112: `sortBy` went into `orderBy: { [sortBy]: sortOrder }` verbatim, so any field
 * name the caller invented reached Prisma and came back as a
 * PrismaClientValidationError — a 500 for what is a caller mistake. An allow-list is
 * also the only thing stopping a sort on a column the endpoint does not mean to expose.
 */
export function parseSort<T extends string>(
  query: { sortBy?: unknown; sortOrder?: unknown },
  allowed: readonly T[],
  fallback: T,
): { sortBy: T; sortOrder: 'asc' | 'desc' } {
  const requested = typeof query.sortBy === 'string' ? query.sortBy : undefined;
  if (requested && !allowed.includes(requested as T)) {
    throw new AppError(`sortBy must be one of: ${allowed.join(', ')}.`, 400);
  }
  const order = query.sortOrder === 'desc' ? 'desc' : 'asc';
  return { sortBy: (requested as T) ?? fallback, sortOrder: order };
}
