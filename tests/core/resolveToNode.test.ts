/**
 * `resolveToNode` — the pure deep-link resolver. Given a target that may live
 * inside an unfetched `lazy` branch, it walks the ancestry (`path`, else
 * `fetchPath`) and resolves each lazy ancestor via `ensureAsync` (in order —
 * resolving one surfaces the next) until the node exists, then reports success.
 *
 * Tested here at the pure/core layer (no React, no viewport) because that's the
 * only place the "off-screen branch stays unfetched" premise holds — in jsdom
 * <BookReader> mounts every node, so the viewport trigger resolves lazy branches
 * incidentally. The real on-screen deep-link flow is covered in the Playwright
 * e2e (`e2e/lazy-search.spec.ts`).
 */
import { describe, it, expect, vi } from 'vitest';
import { createTreeStore } from '../../src/core/tree/treeStore';
import { resolveToNode } from '../../src/core/tree/traversal';
import type { BookNode } from '../../src/types';

// root (known) → p0 (lazy) → p0a (lazy) → target (leaf)
const tree: BookNode = {
  id: 'root',
  title: 'Root',
  children: [{ id: 'p0', title: 'P0', lazy: true, hasContent: false }],
};

// What each lazy node resolves to when fetched.
const childrenMap: Record<string, BookNode[]> = {
  p0: [
    { id: 'p0a', title: 'P0A', lazy: true, hasContent: false },
    { id: 'p0b', title: 'P0B' },
  ],
  p0a: [
    { id: 'p0a-x', title: 'X' },
    { id: 'target', title: 'Target' },
  ],
};

/** A fake `ensureAsync` that inserts a node's children (mirrors useLazyChildren). */
function makeStore() {
  const store = createTreeStore({ tree: structuredClone(tree) });
  const ensureAsync = vi.fn(async (id: string) => {
    const kids = childrenMap[id];
    if (kids) store.setChildren(id, structuredClone(kids));
  });
  return { store, ensureAsync };
}

const fresh = () => new AbortController().signal;

describe('resolveToNode', () => {
  it('returns true immediately for an already-known node (no fetch)', async () => {
    const { store, ensureAsync } = makeStore();
    // `p0` is in the tree (a lazy placeholder) — known, so no resolution needed.
    const ok = await resolveToNode(store, 'p0', {
      ensureAsync,
      signal: fresh(),
    });
    expect(ok).toBe(true);
    expect(ensureAsync).not.toHaveBeenCalled();
  });

  it('resolves a chain of lazy ancestors in order, then finds the target', async () => {
    const { store, ensureAsync } = makeStore();
    expect(store.getNode('target')).toBeUndefined();

    const ok = await resolveToNode(store, 'target', {
      ensureAsync,
      path: ['root', 'p0', 'p0a'],
      signal: fresh(),
    });

    expect(ok).toBe(true);
    expect(store.getNode('target')).toBeDefined();
    // Only the lazy ancestors are fetched (root is not lazy), and strictly in order.
    expect(ensureAsync.mock.calls.map((c) => c[0])).toEqual(['p0', 'p0a']);
  });

  it('falls back to fetchPath when no path is supplied', async () => {
    const { store, ensureAsync } = makeStore();
    const signal = fresh();
    const fetchPath = vi.fn(async () => ['root', 'p0', 'p0a']);

    const ok = await resolveToNode(store, 'target', {
      ensureAsync,
      fetchPath,
      signal,
    });

    expect(fetchPath).toHaveBeenCalledWith('target', signal);
    expect(ok).toBe(true);
    expect(store.getNode('target')).toBeDefined();
  });

  it('is a no-op (false) when neither path nor fetchPath can supply ancestry', async () => {
    const { store, ensureAsync } = makeStore();

    const ok = await resolveToNode(store, 'target', {
      ensureAsync,
      signal: fresh(),
    });

    expect(ok).toBe(false);
    expect(ensureAsync).not.toHaveBeenCalled();
    expect(store.getNode('target')).toBeUndefined();
  });

  it('returns false when fetchPath yields undefined ancestry', async () => {
    const { store, ensureAsync } = makeStore();
    const fetchPath = vi.fn(async () => undefined);

    const ok = await resolveToNode(store, 'target', {
      ensureAsync,
      fetchPath,
      signal: fresh(),
    });

    expect(ok).toBe(false);
    expect(ensureAsync).not.toHaveBeenCalled();
  });

  it('returns false when the path references an unknown ancestor', async () => {
    const { store, ensureAsync } = makeStore();

    // `ghost` never comes into existence (p0 resolves to p0a, not ghost).
    const ok = await resolveToNode(store, 'target', {
      ensureAsync,
      path: ['root', 'p0', 'ghost', 'p0a'],
      signal: fresh(),
    });

    expect(ok).toBe(false);
  });

  it('returns false when an ancestor fetch rejects', async () => {
    const { store } = makeStore();
    const ensureAsync = vi.fn(async (id: string) => {
      if (id === 'p0') throw new Error('network down');
    });

    const ok = await resolveToNode(store, 'target', {
      ensureAsync,
      path: ['root', 'p0', 'p0a'],
      signal: fresh(),
    });

    expect(ok).toBe(false);
    expect(store.getNode('target')).toBeUndefined();
  });

  it('short-circuits before any fetch when the signal is already aborted', async () => {
    const { store, ensureAsync } = makeStore();
    const ac = new AbortController();
    ac.abort();

    const ok = await resolveToNode(store, 'target', {
      ensureAsync,
      path: ['root', 'p0', 'p0a'],
      signal: ac.signal,
    });

    expect(ok).toBe(false);
    expect(ensureAsync).not.toHaveBeenCalled();
  });

  it('stops resolving further ancestors once the signal aborts mid-walk', async () => {
    const { store } = makeStore();
    const ac = new AbortController();
    const ensureAsync = vi.fn(async (id: string) => {
      const kids = childrenMap[id];
      if (kids) store.setChildren(id, structuredClone(kids));
      // A superseding navigation aborts us right after the first ancestor resolves.
      if (id === 'p0') ac.abort();
    });

    const ok = await resolveToNode(store, 'target', {
      ensureAsync,
      path: ['root', 'p0', 'p0a'],
      signal: ac.signal,
    });

    expect(ok).toBe(false);
    // p0 was fetched; the walk bailed before touching p0a.
    expect(ensureAsync).toHaveBeenCalledWith('p0');
    expect(ensureAsync).not.toHaveBeenCalledWith('p0a');
  });
});
