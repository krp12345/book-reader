/**
 * `useLazyChildren` — the orchestration around the consumer's `fetchChildren`:
 * dedupes concurrent triggers into one fetch, drives the store's loading/error
 * status, inserts resolved children, retries after failure, and aborts in-flight
 * fetches on unmount (so a late result never mutates a torn-down store).
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createTreeStore, type TreeStore } from '../src/core/treeStore';
import { useLazyChildren } from '../src/useLazyChildren';
import type { BookNode, FetchChildren } from '../src/types';

const book: BookNode = {
  id: 'root',
  title: 'Root',
  children: [{ id: 'branch', title: 'Branch', lazy: true, hasContent: false }],
};

function setup(fetchChildren: FetchChildren | undefined): {
  store: TreeStore;
  result: { current: ReturnType<typeof useLazyChildren> };
  unmount: () => void;
} {
  const store = createTreeStore({ tree: book });
  const { result, unmount } = renderHook(() =>
    useLazyChildren(store, fetchChildren),
  );
  return { store, result, unmount };
}

/** A manually-resolvable promise for driving timing precisely. */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useLazyChildren', () => {
  it('resolves immediately for a non-lazy / already-loaded node without fetching', async () => {
    const fetchChildren = vi.fn<FetchChildren>();
    const { result } = setup(fetchChildren);
    await act(async () => {
      await result.current.ensureAsync('root'); // not lazy
    });
    expect(fetchChildren).not.toHaveBeenCalled();
  });

  it('fetches once, drives loading→loaded, and inserts the children', async () => {
    const fetchChildren = vi.fn<FetchChildren>(async () => [
      { id: 'branch.a', title: 'A' },
      { id: 'branch.b', title: 'B' },
    ]);
    const { store, result } = setup(fetchChildren);

    await act(async () => {
      await result.current.ensureAsync('branch');
    });

    expect(fetchChildren).toHaveBeenCalledTimes(1);
    expect(store.getLazyStatus('branch')).toBe('loaded');
    expect(store.getChildren('branch')).toEqual(['branch.a', 'branch.b']);
  });

  it('dedupes concurrent triggers into a single fetch', async () => {
    const d = deferred<BookNode[]>();
    const fetchChildren = vi.fn<FetchChildren>(() => d.promise);
    const { store, result } = setup(fetchChildren);

    await act(async () => {
      const p1 = result.current.ensureAsync('branch');
      const p2 = result.current.ensureAsync('branch');
      expect(p1).toBe(p2); // same in-flight promise
      d.resolve([{ id: 'branch.a', title: 'A' }]);
      await Promise.all([p1, p2]);
    });

    expect(fetchChildren).toHaveBeenCalledTimes(1);
    expect(store.getChildren('branch')).toEqual(['branch.a']);
  });

  it('sets the error state when no fetchChildren is configured', async () => {
    const { store, result } = setup(undefined);
    await act(async () => {
      await expect(result.current.ensureAsync('branch')).rejects.toThrow(
        /no `fetchChildren`/,
      );
    });
    expect(store.getLazyStatus('branch')).toBe('error');
  });

  it('records a fetch rejection as the error status, then retries on the next call', async () => {
    let attempt = 0;
    const fetchChildren = vi.fn<FetchChildren>(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('network down');
      return [{ id: 'branch.a', title: 'A' }];
    });
    const { store, result } = setup(fetchChildren);

    // First attempt fails → error status recorded; fire-and-forget swallows it.
    await act(async () => {
      result.current.ensure('branch');
    });
    await waitFor(() => expect(store.getLazyStatus('branch')).toBe('error'));
    expect((store.getLazyError('branch') as Error).message).toBe('network down');

    // Retry: the failed load was cleared, so a second trigger refetches + succeeds.
    await act(async () => {
      await result.current.ensureAsync('branch');
    });
    expect(fetchChildren).toHaveBeenCalledTimes(2);
    expect(store.getLazyStatus('branch')).toBe('loaded');
    expect(store.getChildren('branch')).toEqual(['branch.a']);
  });

  it('aborts an in-flight fetch on unmount and never applies its result', async () => {
    const d = deferred<BookNode[]>();
    let sawAbort = false;
    const fetchChildren = vi.fn<FetchChildren>(async (_node, ctx) => {
      const children = await d.promise;
      if (ctx.signal.aborted) {
        sawAbort = true;
        return [];
      }
      return children;
    });
    const { store, result, unmount } = setup(fetchChildren);

    act(() => {
      result.current.ensure('branch');
    });
    expect(store.getLazyStatus('branch')).toBe('loading');

    // Tear down while the fetch is still pending, then let it resolve.
    unmount();
    await act(async () => {
      d.resolve([{ id: 'branch.a', title: 'A' }]);
      await d.promise;
    });

    expect(sawAbort).toBe(true);
    // The late result was discarded — no children applied…
    expect(store.getChildren('branch')).toEqual([]);
    // …and the node is reset to 'unloaded' (not stuck 'loading' with no in-flight
    // promise), so a later trigger — e.g. a StrictMode remount's scroll trigger —
    // can pick it up again.
    expect(store.getLazyStatus('branch')).toBe('unloaded');
  });
});
