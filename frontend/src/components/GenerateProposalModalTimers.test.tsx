import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GenerateProposalModal from './GenerateProposalModal';

// TT-125: the step interval was started inside mutationFn and only cleared in
// onSuccess/onError. Generation takes 15-30s; unmounting while one is in flight — a route
// change, the parent navigating — left it calling setStepIdx forever on a dead component.
vi.mock('@/lib/presalesApi', () => ({
  presalesApi: {
    // never settles, so the request is still in flight at unmount — the exact case
    generateProposal: () => new Promise(() => {}),
    addToProposal: () => new Promise(() => {}),
  },
}));

const wrap = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{ui}</QueryClientProvider>
);

describe('proposal modal timers', () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('clears the step interval when unmounted mid-generation', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);   // the non-add path gates on it
    const setSpy = vi.spyOn(globalThis, 'setInterval');
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');

    const view = render(wrap(
      <GenerateProposalModal opportunityId="o1" opportunityName="QA" sourceDocuments={[{ fileName:'a.pdf', blobUrl:'u', uploadedAt:'now' }]} onClose={() => {}} />
    ));

    const go = [...view.container.querySelectorAll('button')].find(b => /generate/i.test(b.textContent || ''));
    expect(go, 'a generate button should exist').toBeTruthy();
    fireEvent.click(go!);
    await vi.advanceTimersByTimeAsync(4000);   // let the step interval tick

    const created = setSpy.mock.results.map(r => r.value);
    expect(created.length, 'the step interval should be running').toBeGreaterThan(0);

    view.unmount();   // request still in flight

    const cleared = new Set(clearSpy.mock.calls.map(c => c[0]));
    const leaked = created.filter(id => !cleared.has(id));
    expect(leaked, `interval(s) still running after unmount: ${leaked.length}`).toHaveLength(0);
  });
});
