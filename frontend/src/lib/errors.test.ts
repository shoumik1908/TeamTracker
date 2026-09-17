import { describe, expect, it, vi, afterEach } from 'vitest';
import { errorMessage, notifyError } from './errors';
import { OpaqueHttpError } from './api';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
import { toast } from 'sonner';

describe('errorMessage', () => {
  afterEach(() => vi.clearAllMocks());

  it('uses the message the api client threw', () => {
    // lib/api.ts throws `new Error(resData.error)`, so this is the server's own text.
    expect(errorMessage(new Error('Forbidden: Only Admins can delete documents'))).toBe(
      'Forbidden: Only Admins can delete documents',
    );
  });

  it('falls back when the error carries no message', () => {
    expect(errorMessage(new Error(''), 'Could not save.')).toBe('Could not save.');
  });

  it('falls back for a rejection that is not an Error', () => {
    expect(errorMessage(undefined, 'Could not save.')).toBe('Could not save.');
    expect(errorMessage(null, 'Could not save.')).toBe('Could not save.');
    expect(errorMessage({ response: { data: { error: 'axios shape' } } }, 'Could not save.')).toBe('Could not save.');
  });

  it('accepts a bare string rejection', () => {
    expect(errorMessage('something broke')).toBe('something broke');
  });

  it('prefers the fallback over a blob request\'s status-code message', () => {
    // Report exports use responseType: 'blob', whose only message is
    // `HTTP error! status: NNN`. Showing that to a user is worse than the
    // caller's own wording, so the fallback wins.
    expect(errorMessage(new OpaqueHttpError(403), 'Could not generate that report.')).toBe(
      'Could not generate that report.',
    );
  });

  it('still has a usable default when a blob request fails with no fallback given', () => {
    expect(errorMessage(new OpaqueHttpError(500))).toMatch(/went wrong/i);
    expect(errorMessage(new OpaqueHttpError(500))).not.toMatch(/HTTP error/);
  });

  it('has a generic default so a caller can omit the fallback', () => {
    expect(errorMessage(undefined)).toMatch(/went wrong/i);
  });
});

describe('notifyError', () => {
  afterEach(() => vi.clearAllMocks());

  it('routes through sonner, the only toast library with a mounted Toaster', () => {
    notifyError(new Error('Could not reach the server'));
    expect(toast.error).toHaveBeenCalledWith('Could not reach the server');
  });

  it('shows the fallback when the failure has no usable message', () => {
    notifyError({}, 'Could not delete the project.');
    expect(toast.error).toHaveBeenCalledWith('Could not delete the project.');
  });
});
