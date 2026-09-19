import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';

function rawResponse(status: number, body: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => body,
    blob: async () => new Blob(),
  } as unknown as Response;
}

// TT-071: the client did `text ? JSON.parse(text) : {}` with no try/catch, ahead of the
// res.ok check. A proxy's HTML error page threw a SyntaxError from inside the client,
// which LoginPage and the other error surfaces then showed to the user verbatim — and
// the real HTTP status was lost on the way.
describe('api client with a non-JSON response body', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports a gateway error instead of a JSON parse error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      rawResponse(502, '<html><head><title>502 Bad Gateway</title></head><body>nginx</body></html>')));

    await expect(api.get('/members')).rejects.toThrow(/server is unavailable/i);
    await expect(api.get('/members')).rejects.not.toThrow(/JSON|Unexpected token/i);
  });

  it('keeps the status meaningful for a 504', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => rawResponse(504, 'upstream timed out')));
    await expect(api.get('/members')).rejects.toThrow(/server is unavailable/i);
  });

  it('describes a 500 that returned no JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => rawResponse(500, 'Internal Server Error')));
    await expect(api.get('/members')).rejects.toThrow(/HTTP 500/);
  });

  it('still prefers the server message when the body IS json', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      rawResponse(400, JSON.stringify({ error: 'Name and joining date are required' }))));
    await expect(api.get('/members')).rejects.toThrow('Name and joining date are required');
  });

  it('rejects a 200 that is not JSON rather than returning an empty object', async () => {
    // A dev-server fallback serving index.html for an unknown path used to arrive here
    // as `{}` and be treated as valid data by the caller.
    vi.stubGlobal('fetch', vi.fn(async () => rawResponse(200, '<!doctype html><html></html>')));
    await expect(api.get('/members')).rejects.toThrow(/unexpected response/i);
  });

  it('an empty 200 body is still fine', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => rawResponse(200, '')));
    await expect(api.get('/members')).resolves.toMatchObject({ status: 200 });
  });
});
