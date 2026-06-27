import { describe, it, expect, vi } from 'vitest';
import { createContentCache } from '../../src/core/cache';
import type { EvictionInput } from '../../src/types';

describe('createContentCache — basic store + recency', () => {
  it('stores and retrieves content by id', () => {
    const cache = createContentCache();
    cache.set('a', 'hello');
    expect(cache.get('a')).toBe('hello');
    expect(cache.has('a')).toBe(true);
  });

  it('returns undefined for a missing id', () => {
    const cache = createContentCache();
    expect(cache.get('missing')).toBeUndefined();
    expect(cache.has('missing')).toBe(false);
  });

  it('overwrites an existing id and re-measures its size', () => {
    const cache = createContentCache();
    cache.set('a', 'hi'); // size 2
    cache.set('a', 'hello'); // size 5
    expect(cache.get('a')).toBe('hello');
    expect(cache.count).toBe(1);
    expect(cache.totalSize).toBe(5);
  });

  it('tracks count and totalSize (default sizeOf = string length)', () => {
    const cache = createContentCache();
    cache.set('a', 'ab'); // 2
    cache.set('b', 'cde'); // 3
    expect(cache.count).toBe(2);
    expect(cache.totalSize).toBe(5);
  });

  it('reports ids least-recently-used first', () => {
    const cache = createContentCache();
    cache.set('a', 'x');
    cache.set('b', 'y');
    cache.set('c', 'z');
    expect(cache.ids()).toEqual(['a', 'b', 'c']);
    // touching 'a' via get makes it most-recently-used
    cache.get('a');
    expect(cache.ids()).toEqual(['b', 'c', 'a']);
  });

  it('deletes and clears entries', () => {
    const cache = createContentCache();
    cache.set('a', 'x');
    cache.set('b', 'y');
    expect(cache.delete('a')).toBe(true);
    expect(cache.has('a')).toBe(false);
    cache.clear();
    expect(cache.count).toBe(0);
    expect(cache.totalSize).toBe(0);
  });
});

describe('createContentCache — LRU eviction by maxChars', () => {
  it('evicts the least-recently-used node when maxChars is exceeded', () => {
    const cache = createContentCache({ maxChars: 10 });
    cache.set('a', 'aaaa'); // 4, total 4
    cache.set('b', 'bbbb'); // 4, total 8
    cache.set('c', 'cccc'); // 4, total 12 > 10 → evict 'a'
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.totalSize).toBe(8);
  });

  it('evicts multiple nodes until within budget', () => {
    const cache = createContentCache({ maxChars: 10 });
    cache.set('a', 'aaaa'); // 4
    cache.set('b', 'bbbb'); // 8
    cache.set('c', 'cccccccc'); // 8 → total 16, evict a then b
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
  });

  it('respects recency: a recently-read node survives over an older one', () => {
    const cache = createContentCache({ maxChars: 10 });
    cache.set('a', 'aaaa');
    cache.set('b', 'bbbb');
    cache.get('a'); // 'a' now most-recently-used; 'b' is oldest
    cache.set('c', 'cccc'); // total 12 → evict oldest evictable = 'b'
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
  });
});

describe('createContentCache — eviction by maxNodes', () => {
  it('evicts the least-recently-used node when maxNodes is exceeded', () => {
    const cache = createContentCache({ maxNodes: 2 });
    cache.set('a', 'x');
    cache.set('b', 'y');
    cache.set('c', 'z'); // count 3 > 2 → evict 'a'
    expect(cache.has('a')).toBe(false);
    expect(cache.count).toBe(2);
  });
});

describe('createContentCache — pinned window is never evicted', () => {
  it('keeps a pinned node even when it is the least-recently-used', () => {
    const cache = createContentCache({ maxChars: 10 });
    cache.set('a', 'aaaa');
    cache.set('b', 'bbbb');
    cache.setPinned(['a']); // 'a' pinned despite being oldest
    cache.set('c', 'cccc'); // total 12 → must evict non-pinned oldest = 'b'
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
  });

  it('does not evict pinned nodes even if budget cannot otherwise be met', () => {
    const cache = createContentCache({ maxChars: 8 });
    cache.set('a', 'aaaa'); // 4
    cache.set('b', 'bbbb'); // 4 → total 8, within budget
    cache.setPinned(['a', 'b']); // both pinned, total 8 == budget
    cache.set('c', 'cc'); // 2 → total 10 > 8; only 'c' is evictable
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(false); // evicted to claw back what we can
  });

  it('re-runs eviction when a node is unpinned', () => {
    const cache = createContentCache({ maxChars: 8 });
    cache.set('a', 'aaaa');
    cache.set('b', 'bbbb');
    cache.setPinned(['a']);
    cache.set('c', 'cccc'); // total 12 → evict 'b', 'a' pinned survives
    expect(cache.has('a')).toBe(true);
    expect(cache.has('c')).toBe(true);
    cache.setPinned([]); // 'a' now evictable; total 8 == budget, fine
    expect(cache.has('a')).toBe(true);
    cache.set('d', 'dddd'); // total 12 → evict oldest evictable = 'a'
    expect(cache.has('a')).toBe(false);
  });
});

describe('createContentCache — custom sizeOf and evict', () => {
  it('uses a custom sizeOf to measure entries', () => {
    const cache = createContentCache<{ text: string }>({
      maxChars: 10,
      sizeOf: (c) => c.text.length,
    });
    cache.set('a', { text: 'aaaaaa' }); // 6
    cache.set('b', { text: 'bbbbbb' }); // 12 → evict 'a'
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
  });

  it('delegates to a custom evict policy when provided', () => {
    const evict = vi.fn((input: EvictionInput<string>) =>
      // evict everything whose content starts with 'x'
      input.entries.filter((e) => e.content.startsWith('x')).map((e) => e.id),
    );
    const cache = createContentCache({ maxChars: 4, evict });
    cache.set('a', 'xx');
    cache.set('b', 'yy');
    cache.set('c', 'xx'); // triggers eviction → 'a' and 'c' (start with 'x') go
    expect(evict).toHaveBeenCalled();
    expect(cache.has('a')).toBe(false);
    expect(cache.has('c')).toBe(false);
    expect(cache.has('b')).toBe(true);
  });

  it('never passes pinned entries to a custom evict policy', () => {
    const seen: string[][] = [];
    const evict = (input: EvictionInput<string>): string[] => {
      seen.push(input.entries.map((e) => e.id));
      return input.entries.map((e) => e.id); // try to evict all it can see
    };
    const cache = createContentCache({ maxChars: 3, evict });
    cache.set('a', 'aa'); // total 2, within budget — no eviction yet
    cache.setPinned(['a']);
    cache.set('b', 'bb'); // total 4 > 3 → eviction runs, 'a' is pinned
    // 'a' was pinned, so it must never appear in the evict input
    expect(seen.every((ids) => !ids.includes('a'))).toBe(true);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });
});

describe('createContentCache — in-flight de-duplication', () => {
  it('returns the same promise for concurrent loads of one id', async () => {
    const cache = createContentCache();
    const factory = vi.fn(() => Promise.resolve('content'));
    const p1 = cache.dedupe('a', factory);
    const p2 = cache.dedupe('a', factory);
    expect(p1).toBe(p2);
    expect(factory).toHaveBeenCalledTimes(1);
    await expect(p1).resolves.toBe('content');
  });

  it('caches the resolved value and clears the in-flight entry', async () => {
    const cache = createContentCache();
    const factory = vi.fn(() => Promise.resolve('content'));
    await cache.dedupe('a', factory);
    expect(cache.get('a')).toBe('content');
    expect(cache.getInFlight('a')).toBeUndefined();
    // a subsequent dedupe does not re-run the factory if cached path is used
    // by the caller; dedupe itself starts a fresh load only when asked.
  });

  it('does not cache a rejected load and clears the in-flight entry', async () => {
    const cache = createContentCache();
    const factory = vi.fn(() => Promise.reject(new Error('boom')));
    await expect(cache.dedupe('a', factory)).rejects.toThrow('boom');
    expect(cache.has('a')).toBe(false);
    expect(cache.getInFlight('a')).toBeUndefined();
  });

  it('exposes an in-flight promise while a load is pending', async () => {
    const cache = createContentCache();
    let resolve!: (v: string) => void;
    const factory = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const p = cache.dedupe('a', factory);
    expect(cache.getInFlight('a')).toBe(p);
    resolve('done');
    await p;
    expect(cache.getInFlight('a')).toBeUndefined();
  });
});
