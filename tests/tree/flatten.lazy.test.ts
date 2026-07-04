/**
 * `flattenVisible` for lazy branches: an expanded-but-unresolved lazy node emits
 * a synthetic status row (loading / error) beneath itself instead of descending,
 * so the tree pane can show the in-branch spinner / retry. Once resolved it walks
 * the real children like any other node.
 */
import { describe, it, expect } from 'vitest';
import { createTreeStore } from '../../src/core/treeStore';
import { flattenVisible } from '../../src/core/flatten';
import type { BookNode } from '../../src/types';

const lazyBook: BookNode = {
  id: 'root',
  title: 'Root',
  children: [{ id: 'lazy1', title: 'Lazy Part', lazy: true, hasContent: false }],
};

describe('flattenVisible — lazy branches', () => {
  it('emits a loading status row when an unresolved lazy node is expanded', () => {
    const store = createTreeStore({ tree: lazyBook });
    expect(flattenVisible(store, new Set(['root', 'lazy1']))).toEqual([
      { kind: 'node', id: 'root', depth: 0 },
      { kind: 'node', id: 'lazy1', depth: 1 },
      { kind: 'lazy', id: 'lazy1', depth: 2, status: 'loading' },
    ]);
  });

  it('emits an error status row when the lazy fetch failed', () => {
    const store = createTreeStore({ tree: lazyBook });
    store.setLazyStatus('lazy1', 'error', new Error('boom'));
    expect(flattenVisible(store, new Set(['root', 'lazy1']))).toEqual([
      { kind: 'node', id: 'root', depth: 0 },
      { kind: 'node', id: 'lazy1', depth: 1 },
      { kind: 'lazy', id: 'lazy1', depth: 2, status: 'error' },
    ]);
  });

  it('walks the real children once the lazy node is resolved', () => {
    const store = createTreeStore({ tree: lazyBook });
    store.setChildren('lazy1', [
      { id: 'lazy1.a', title: 'A' },
      { id: 'lazy1.b', title: 'B' },
    ]);
    expect(flattenVisible(store, new Set(['root', 'lazy1']))).toEqual([
      { kind: 'node', id: 'root', depth: 0 },
      { kind: 'node', id: 'lazy1', depth: 1 },
      { kind: 'node', id: 'lazy1.a', depth: 2 },
      { kind: 'node', id: 'lazy1.b', depth: 2 },
    ]);
  });

  it('shows no status row while the lazy node stays collapsed', () => {
    const store = createTreeStore({ tree: lazyBook });
    expect(flattenVisible(store, new Set(['root']))).toEqual([
      { kind: 'node', id: 'root', depth: 0 },
      { kind: 'node', id: 'lazy1', depth: 1 },
    ]);
  });
});
