import { describe, it, expect } from 'vitest';
import {
  createVirtualizer,
  correctScrollTop,
  pinnedIds,
  prefetchIds,
  type VirtualWindow,
} from '../../src/core/virtualizer';

const ids = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `n${i}`);

describe('virtualizer — height map (measure / remember / estimate)', () => {
  it('uses the configured estimate for unmeasured ids', () => {
    const v = createVirtualizer({ estimateHeight: 50 });
    expect(v.getHeight('x')).toBe(50);
    expect(v.isMeasured('x')).toBe(false);
  });

  it('falls back to a default estimate when none is configured', () => {
    const v = createVirtualizer();
    expect(v.getHeight('x')).toBeGreaterThan(0);
    expect(v.isMeasured('x')).toBe(false);
  });

  it('remembers a measured height and reports it as measured', () => {
    const v = createVirtualizer({ estimateHeight: 50 });
    v.setHeight('x', 123);
    expect(v.getHeight('x')).toBe(123);
    expect(v.isMeasured('x')).toBe(true);
  });

  it('returns the delta from the previously-used height when measuring', () => {
    const v = createVirtualizer({ estimateHeight: 50 });
    // first measurement: delta vs the estimate (50)
    expect(v.setHeight('x', 80)).toBe(30);
    // re-measurement: delta vs the prior measured value (80)
    expect(v.setHeight('x', 70)).toBe(-10);
    // identical re-measurement: no delta
    expect(v.setHeight('x', 70)).toBe(0);
  });

  it('computes a node’s absolute offset from heights in use', () => {
    const v = createVirtualizer({ estimateHeight: 100 });
    const list = ids(5);
    v.setHeight('n0', 150); // measured; others use the 100 estimate
    expect(v.offsetAt(list, 0)).toBe(0);
    expect(v.offsetAt(list, 1)).toBe(150); // past n0 (measured 150)
    expect(v.offsetAt(list, 3)).toBe(150 + 100 + 100);
    // Clamped at both ends.
    expect(v.offsetAt(list, -2)).toBe(0);
    expect(v.offsetAt(list, 99)).toBe(150 + 100 * 4);
  });

  it('forgets a measurement with delete', () => {
    const v = createVirtualizer({ estimateHeight: 50 });
    v.setHeight('x', 80);
    expect(v.delete('x')).toBe(true);
    expect(v.isMeasured('x')).toBe(false);
    expect(v.getHeight('x')).toBe(50);
    expect(v.delete('x')).toBe(false);
  });
});

describe('virtualizer — windowing (mount viewport + overscan)', () => {
  it('mounts only the items intersecting the viewport', () => {
    const v = createVirtualizer({ estimateHeight: 100 });
    // 10 items × 100px = 1000px tall. Viewport [250, 550).
    const w = v.getWindow({ ids: ids(10), scrollTop: 250, viewportHeight: 300 });
    // items 2 (200-300), 3, 4, 5 (500-600) intersect.
    expect(w.startIndex).toBe(2);
    expect(w.endIndex).toBe(5);
    expect(w.items.map((i) => i.id)).toEqual(['n2', 'n3', 'n4', 'n5']);
  });

  it('extends the window by overscan on both sides', () => {
    const v = createVirtualizer({ estimateHeight: 100 });
    const w = v.getWindow({
      ids: ids(10),
      scrollTop: 250,
      viewportHeight: 300,
      overscan: 2,
    });
    expect(w.startIndex).toBe(0);
    expect(w.endIndex).toBe(7);
  });

  it('clamps the window to the bounds of the list', () => {
    const v = createVirtualizer({ estimateHeight: 100 });
    const w = v.getWindow({
      ids: ids(5),
      scrollTop: 0,
      viewportHeight: 250,
      overscan: 3,
    });
    expect(w.startIndex).toBe(0);
    expect(w.endIndex).toBe(4);
    expect(w.paddingTop).toBe(0);
    expect(w.paddingBottom).toBe(0);
  });

  it('reports spacer paddings and total height around the window', () => {
    const v = createVirtualizer({ estimateHeight: 100 });
    const w = v.getWindow({ ids: ids(10), scrollTop: 250, viewportHeight: 300 });
    expect(w.totalHeight).toBe(1000);
    expect(w.paddingTop).toBe(200); // items 0..1
    expect(w.paddingBottom).toBe(400); // items 6..9
    // top spacer + window heights + bottom spacer == total height
    const windowHeight = w.items.reduce((s, i) => s + i.height, 0);
    expect(w.paddingTop + windowHeight + w.paddingBottom).toBe(w.totalHeight);
  });

  it('honours measured heights when computing offsets', () => {
    const v = createVirtualizer({ estimateHeight: 100 });
    v.setHeight('n0', 400); // taller than the estimate
    const w = v.getWindow({ ids: ids(10), scrollTop: 0, viewportHeight: 300 });
    // only n0 covers [0,400) which spans the whole viewport.
    expect(w.items.map((i) => i.id)).toEqual(['n0']);
    expect(w.items[0]?.start).toBe(0);
    expect(w.totalHeight).toBe(400 + 9 * 100);
  });

  it('gives each mounted item its absolute start offset', () => {
    const v = createVirtualizer({ estimateHeight: 100 });
    const w = v.getWindow({ ids: ids(10), scrollTop: 250, viewportHeight: 300 });
    expect(w.items.map((i) => i.start)).toEqual([200, 300, 400, 500]);
  });

  it('mounts the whole list when the viewport is not yet measured (height 0)', () => {
    const v = createVirtualizer({ estimateHeight: 100 });
    const w = v.getWindow({ ids: ids(10), scrollTop: 0, viewportHeight: 0 });
    expect(w.startIndex).toBe(0);
    expect(w.endIndex).toBe(9);
    expect(w.paddingTop).toBe(0);
    expect(w.paddingBottom).toBe(0);
  });

  it('returns an empty window for an empty list', () => {
    const v = createVirtualizer({ estimateHeight: 100 });
    const w = v.getWindow({ ids: [], scrollTop: 0, viewportHeight: 300 });
    expect(w.items).toEqual([]);
    expect(w.startIndex).toBe(0);
    expect(w.endIndex).toBe(-1);
    expect(w.totalHeight).toBe(0);
  });
});

describe('virtualizer — anchor correction (no scroll jump)', () => {
  it('shifts scrollTop by the delta when the changed item is entirely above the viewport top', () => {
    // item's bottom edge is at 100, the viewport top is at 300 → fully above the
    // fold, so its growth pushes on-screen content down; cancel it.
    expect(correctScrollTop(100, 40, 300)).toBe(340);
    // bottom exactly at the viewport top still counts as above.
    expect(correctScrollTop(300, 40, 300)).toBe(340);
  });

  it('leaves scrollTop untouched when the item straddles or sits below the viewport top', () => {
    // bottom past the fold → the item straddles the viewport top, so it grows
    // *below* the top (off-screen): nothing on screen moves.
    expect(correctScrollTop(360, 40, 300)).toBe(300);
    // fully below the fold → growth pushes downward content only.
    expect(correctScrollTop(500, 40, 300)).toBe(300);
  });

  it('shifts scrollTop up when an above-fold item shrinks', () => {
    expect(correctScrollTop(100, -30, 300)).toBe(270);
  });
});

describe('virtualizer — pinned + prefetch windows', () => {
  const window: VirtualWindow = {
    startIndex: 2,
    endIndex: 5,
    items: [],
    paddingTop: 0,
    paddingBottom: 0,
    totalHeight: 0,
  };

  it('pins the mounted window plus prefetchCount ahead', () => {
    expect(pinnedIds(ids(10), window, 2)).toEqual([
      'n2',
      'n3',
      'n4',
      'n5',
      'n6',
      'n7',
    ]);
  });

  it('clamps the pinned window to the end of the list', () => {
    const w = { ...window, endIndex: 9 };
    expect(pinnedIds(ids(10), w, 3)).toEqual(['n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9']);
  });

  it('lists only the prefetch-ahead ids just past the window', () => {
    expect(prefetchIds(ids(10), window, 2)).toEqual(['n6', 'n7']);
  });

  it('returns no prefetch ids at the end of the book', () => {
    const w = { ...window, endIndex: 9 };
    expect(prefetchIds(ids(10), w, 2)).toEqual([]);
  });

  it('returns no prefetch ids when prefetchCount is 0', () => {
    expect(prefetchIds(ids(10), window, 0)).toEqual([]);
  });
});
