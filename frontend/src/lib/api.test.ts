import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api, { SESSION_EXPIRED_EVENT, setSessionToken } from './api';

// TT-069: these tests used to seed the token with localStorage.setItem('token', ...).
// The token is deliberately no longer stored there — it is held in memory for the life
// of the tab, with an httpOnly cookie carrying the durable session. The assertions are
// unchanged; only the way the session is established has moved.

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify(body),
    blob: async () => new Blob(),
  } as unknown as Response;
}

describe('api client session handling', () => {
  let expired: number;

  const countEvent = () => {
    expired += 1;
  };

  beforeEach(() => {
    expired = 0;
    localStorage.clear();
    setSessionToken(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, countEvent);
  });

  afterEach(() => {
    window.removeEventListener(SESSION_EXPIRED_EVENT, countEvent);
    vi.unstubAllGlobals();
  });

  it('signals an expired session on 401 when a token was sent', async () => {
    setSessionToken('stale-token');
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(401, { error: 'No auth token provided' })));

    await expect(api.get('/members')).rejects.toThrow();
    expect(expired).toBe(1);
  });

  it('signals an expired session on a 403 that names the token', async () => {
    setSessionToken('stale-token');
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(403, { error: 'Invalid or expired token' })));

    await expect(api.get('/members')).rejects.toThrow();
    expect(expired).toBe(1);
  });

  it('does NOT sign out on a 403 permission denial', async () => {
    setSessionToken('good-token');
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(403, { error: 'Forbidden: Missing manageTeam permission' })));

    await expect(api.get('/admin/users')).rejects.toThrow('Forbidden: Missing manageTeam permission');
    expect(expired).toBe(0);
  });

  it('does NOT sign out on a route-specific 403', async () => {
    setSessionToken('good-token');
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(403, { error: 'Only Admins can view logs' })));

    await expect(api.get('/logs')).rejects.toThrow('Only Admins can view logs');
    expect(expired).toBe(0);
  });

  it('does NOT sign out on a failed login, where no token was sent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(401, { error: 'Invalid credentials' })));

    await expect(api.post('/auth/login', { email: 'a@b.c', password: 'wrong' })).rejects.toThrow('Invalid credentials');
    expect(expired).toBe(0);
  });

  it('names the rejected token so a replaced session is not signed out', async () => {
    setSessionToken('stale-token');
    let detail: unknown;
    const capture = (e: Event) => { detail = (e as CustomEvent).detail; };
    window.addEventListener(SESSION_EXPIRED_EVENT, capture);
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(403, { error: 'Invalid or expired token' })));

    await expect(api.get('/members')).rejects.toThrow();
    window.removeEventListener(SESSION_EXPIRED_EVENT, capture);
    expect(detail).toEqual({ token: 'stale-token' });
  });

  it('leaves ordinary errors alone', async () => {
    setSessionToken('good-token');
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(500, { error: 'Internal server error' })));

    await expect(api.get('/members')).rejects.toThrow('Internal server error');
    expect(expired).toBe(0);
  });

  it('signals on a 401 for a blob download', async () => {
    setSessionToken('stale-token');
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(401, {})));

    await expect(api.get('/reports/team', { responseType: 'blob' })).rejects.toThrow();
    expect(expired).toBe(1);
  });
});
