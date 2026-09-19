import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DashboardGreeting } from './DashboardGreeting';

// TT-124: the interval was created inside a setTimeout callback, and the cleanup that
// cleared it was returned from that callback — where React never sees it. Past the first
// hour boundary the interval outlived the component. Fake timers let us cross that
// boundary deliberately and then check the handle is actually released on unmount.
describe('greeting hourly refresh', () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('clears the hourly interval when the component unmounts', () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const setSpy = vi.spyOn(globalThis, 'setInterval');

    const view = render(<DashboardGreeting name="QA" />);
    // cross the hour boundary so the interval is actually created
    vi.advanceTimersByTime(60 * 60 * 1000 + 1000);

    const created = setSpy.mock.results.map(r => r.value);
    expect(created.length, 'an hourly interval should exist after the boundary').toBeGreaterThan(0);

    view.unmount();

    const cleared = new Set(clearSpy.mock.calls.map(c => c[0]));
    const leaked = created.filter(id => !cleared.has(id));
    expect(leaked, `interval(s) left running after unmount: ${leaked.length}`).toHaveLength(0);
  });
});
