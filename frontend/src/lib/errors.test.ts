import { describe, expect, it, vi, afterEach } from 'vitest';
import { errorMessage, notifyError } from './errors';

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
