/**
 * Lazy-tree mutations on the (now mutable + subscribable) tree store — the M10
 * foundation. `setChildren`/`setLazyStatus`/`replaceTree` bump a monotonic
 * version and notify subscribers (that's what drives `useSyncExternalStore` so
 * both panes re-derive), and lazy nodes report expandable/status correctly so a
 * caret shows before the children exist.
 */
import { describe, it, expect, vi } from 'vitest';
import { createTreeStore } from '../../src/core/tree/treeStore';
import type { BookNode } from '../../src/types';

const lazyBook: BookNode = {
  id: 'root',
  title: 'Root',
  children: [
    { id: 'lazy1', title: 'Lazy Part 1', lazy: true, hasContent: false },
    { id: 'plain', title: 'Plain Chapter' },
  ],
};

describe('treeStore — lazy nodes', () => {
  it('marks an unresolved lazy node expandable with status "unloaded"', () => {
    const store = createTreeStore({ tree: lazyBook });
    expect(store.isLazy('lazy1')).toBe(true);
    expect(store.getLazyStatus('lazy1')).toBe('unloaded');
    // A caret must show even though the node has no children yet.
    expect(store.isExpandable('lazy1')).toBe(true);
    expect(store.getChildren('lazy1')).toEqual([]);
  });

  it('treats a non-lazy node as always "loaded" and never lazy', () => {
    const store = createTreeStore({ tree: lazyBook });
    expect(store.isLazy('plain')).toBe(false);
    expect(store.getLazyStatus('plain')).toBe('loaded');
    expect(store.isExpandable('plain')).toBe(false);
  });

  it('treats a lazy node that ships children as pre-resolved (loaded)', () => {
    const store = createTreeStore({
      tree: {
        id: 'root',
        title: 'Root',
        lazy: true,
        children: [{ id: 'c', title: 'Child' }],
      },
    });
    expect(store.isLazy('root')).toBe(true);
    expect(store.getLazyStatus('root')).toBe('loaded');
    expect(store.isExpandable('root')).toBe(true);
  });
});

describe('treeStore — mutation + subscription', () => {
  it('setLazyStatus records status + error, bumps version, notifies', () => {
    const store = createTreeStore({ tree: lazyBook });
    const listener = vi.fn();
    store.subscribe(listener);
    const v0 = store.getVersion();

    const err = new Error('boom');
    store.setLazyStatus('lazy1', 'error', err);

    expect(store.getLazyStatus('lazy1')).toBe('error');
    expect(store.getLazyError('lazy1')).toBe(err);
    expect(store.getVersion()).toBe(v0 + 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('setChildren inserts + indexes children, marks loaded, bumps version', () => {
    const store = createTreeStore({ tree: lazyBook });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setChildren('lazy1', [
      { id: 'lazy1.a', title: 'Section A' },
      { id: 'lazy1.b', title: 'Section B', lazy: true, hasContent: false },
    ]);

    expect(store.getLazyStatus('lazy1')).toBe('loaded');
    expect(store.getChildren('lazy1')).toEqual(['lazy1.a', 'lazy1.b']);
    // Children are fully indexed: reachable, with parent + path wired up.
    expect(store.getNode('lazy1.a')?.title).toBe('Section A');
    expect(store.getParentId('lazy1.a')).toBe('lazy1');
    expect(store.getPath('lazy1.a')).toEqual(['root', 'lazy1']);
    // A returned lazy child stays deferred (one level per fetch).
    expect(store.getLazyStatus('lazy1.b')).toBe('unloaded');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('setChildren with an empty list still marks the node loaded (no caret)', () => {
    const store = createTreeStore({ tree: lazyBook });
    store.setChildren('lazy1', []);
    expect(store.getLazyStatus('lazy1')).toBe('loaded');
    // Resolved to zero children → no longer expandable.
    expect(store.isExpandable('lazy1')).toBe(false);
  });

  it('replaceTree swaps the whole book and clears prior lazy state', () => {
    const store = createTreeStore({ tree: lazyBook });
    store.setLazyStatus('lazy1', 'error', new Error('x'));
    const listener = vi.fn();
    store.subscribe(listener);
    const v0 = store.getVersion();

    store.replaceTree({ id: 'new', title: 'New Book' });

    expect(store.getRootIds()).toEqual(['new']);
    expect(store.getNode('root')).toBeUndefined();
    expect(store.getNode('lazy1')).toBeUndefined();
    expect(store.getVersion()).toBe(v0 + 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores mutations targeting an unknown id (no notify)', () => {
    const store = createTreeStore({ tree: lazyBook });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setChildren('nope', [{ id: 'x', title: 'X' }]);
    store.setLazyStatus('nope', 'loading');

    expect(listener).not.toHaveBeenCalled();
    expect(store.getNode('x')).toBeUndefined();
  });

  it('stops notifying after unsubscribe', () => {
    const store = createTreeStore({ tree: lazyBook });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.setLazyStatus('lazy1', 'loading');
    expect(listener).not.toHaveBeenCalled();
  });
});
