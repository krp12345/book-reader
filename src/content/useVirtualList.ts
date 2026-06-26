/**
 * React binding for the pure {@link createVirtualizer} geometry: turns a reading
 * sequence into the windowed slice to mount, and keeps the view stable.
 *
 * What it owns (the browser-only half deliberately kept out of the pure core):
 * - the scroll container ref + its live `scrollTop`/`clientHeight`;
 * - per-node height measurement via `ResizeObserver`, fed into the height map;
 * - **anchor correction** — when a measured node above the viewport top changes
 *   height, `scrollTop` is nudged synchronously (in the RO callback, before
 *   paint) so on-screen content never jumps;
 * - driving the cache's **pinned window** (mounted nodes + `prefetchCount` ahead)
 *   and **prefetch-ahead** so scroll-back and about-to-enter nodes are synchronous
 *   cache hits.
 *
 * Per CONVENTIONS the geometry is unit-tested in `virtualizer.test.ts`; this
 * wiring (real scroll/layout) is covered only by a light integration test.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ContentCache } from '../core/cache';
import {
  createVirtualizer,
  pinnedIds,
  prefetchIds,
  type VirtualItem,
} from '../core/virtualizer';

export interface UseVirtualListOptions {
  /** The full reading sequence, in order. */
  ids: string[];
  /** Extra nodes mounted on each side of the viewport. */
  overscan?: number | undefined;
  /** How many nodes past the window to keep pinned + warmed. */
  prefetchCount?: number | undefined;
  /** Height (px) assumed for not-yet-measured nodes. */
  estimateHeight?: number | undefined;
  /** Shared content cache whose pinned window this drives. */
  cache?: ContentCache<string> | undefined;
  /** Warm a node ahead of view (no-op if already cached/in-flight). */
  prefetch?: ((id: string) => void) | undefined;
}

export interface VirtualList {
  /** Attach to the scroll container element. */
  scrollRef: React.RefObject<HTMLDivElement>;
  /** Mounted nodes with absolute positions. */
  items: VirtualItem[];
  /** Spacer height above the first mounted node. */
  paddingTop: number;
  /** Spacer height below the last mounted node. */
  paddingBottom: number;
  /** Total height of the whole sequence. */
  totalHeight: number;
  /** Ref callback factory for measuring a mounted node's height. */
  measureRef: (id: string) => (el: HTMLElement | null) => void;
}

interface Metrics {
  scrollTop: number;
  viewportHeight: number;
}

const readHeight = (el: HTMLElement): number => el.getBoundingClientRect().height;

export function useVirtualList(options: UseVirtualListOptions): VirtualList {
  const { ids, overscan = 0, prefetchCount = 0, cache, prefetch } = options;

  const scrollRef = useRef<HTMLDivElement>(null);
  // One virtualizer per list instance; the estimate is captured at mount.
  const vRef = useRef<ReturnType<typeof createVirtualizer>>();
  if (vRef.current === undefined) {
    vRef.current = createVirtualizer({ estimateHeight: options.estimateHeight });
  }
  const virtualizer = vRef.current;

  const [metrics, setMetrics] = useState<Metrics>({
    scrollTop: 0,
    viewportHeight: 0,
  });
  // Bumped whenever a measurement changes a height, to recompute the window.
  const [measureVersion, setMeasureVersion] = useState(0);

  const window = useMemo(
    () =>
      virtualizer.getWindow({
        ids,
        scrollTop: metrics.scrollTop,
        viewportHeight: metrics.viewportHeight,
        overscan,
      }),
    // measureVersion is a recompute signal (heights live in the virtualizer).
    [virtualizer, ids, metrics, overscan, measureVersion],
  );

  // Keep the latest window readable from the (non-reactive) RO callback so it can
  // look up a measured node's pre-change start offset for anchor correction.
  const windowRef = useRef(window);
  windowRef.current = window;

  const syncMetrics = useCallback(() => {
    const el = scrollRef.current;
    if (el === null) return;
    setMetrics({ scrollTop: el.scrollTop, viewportHeight: el.clientHeight });
  }, []);

  // Initial viewport measurement + keep it current as the container resizes.
  useLayoutEffect(() => {
    syncMetrics();
    const el = scrollRef.current;
    if (el === null || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(syncMetrics);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncMetrics]);

  // One ResizeObserver measures every mounted node. On a height change we update
  // the height map and, if the node sits above the viewport top, correct
  // scrollTop synchronously so content under the reader's eyes doesn't jump.
  const elToId = useRef(new Map<Element, string>());
  const idToEl = useRef(new Map<string, HTMLElement>());
  const observerRef = useRef<ResizeObserver | null>(null);

  // Created eagerly (lazy-init ref) so it exists when item refs first fire during
  // commit — a passive effect would run too late and miss the first mount.
  if (observerRef.current === null && typeof ResizeObserver !== 'undefined') {
    observerRef.current = new ResizeObserver((entries) => {
      const scrollEl = scrollRef.current;
      let changed = false;
      for (const entry of entries) {
        const id = elToId.current.get(entry.target);
        if (id === undefined) continue;
        const delta = virtualizer.setHeight(id, readHeight(entry.target as HTMLElement));
        if (delta === 0) continue;
        changed = true;
        // Anchor correction: a node starting above the current scrollTop pushes
        // the viewport when it grows/shrinks — cancel it.
        const item = windowRef.current.items.find((i) => i.id === id);
        if (scrollEl !== null && item !== undefined && item.start < scrollEl.scrollTop) {
          scrollEl.scrollTop += delta;
        }
      }
      if (changed) setMeasureVersion((n) => n + 1);
    });
  }
  useEffect(() => {
    const ro = observerRef.current;
    return () => ro?.disconnect();
  }, []);

  // One stable ref callback per id (cached) so React doesn't churn observe/
  // unobserve every render; the closure captures `id`, so unmount (el === null)
  // cleans up the right element.
  const refCbs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const measureRef = useCallback((id: string) => {
    const existing = refCbs.current.get(id);
    if (existing !== undefined) return existing;
    const cb = (el: HTMLElement | null): void => {
      const ro = observerRef.current;
      const prev = idToEl.current.get(id);
      if (prev !== undefined) {
        ro?.unobserve(prev);
        elToId.current.delete(prev);
        idToEl.current.delete(id);
      }
      if (el !== null) {
        idToEl.current.set(id, el);
        elToId.current.set(el, id);
        ro?.observe(el);
      }
    };
    refCbs.current.set(id, cb);
    return cb;
  }, []);

  // Drive the cache's pinned window (mounted + prefetch-ahead) so scroll-back and
  // about-to-enter nodes are never evicted → always synchronous cache hits.
  useEffect(() => {
    if (cache === undefined) return;
    cache.setPinned(pinnedIds(ids, window, prefetchCount));
  }, [cache, ids, window, prefetchCount]);

  // Warm the next prefetchCount nodes ahead of view.
  useEffect(() => {
    if (prefetch === undefined) return;
    for (const id of prefetchIds(ids, window, prefetchCount)) prefetch(id);
  }, [prefetch, ids, window, prefetchCount]);

  return {
    scrollRef,
    items: window.items,
    paddingTop: window.paddingTop,
    paddingBottom: window.paddingBottom,
    totalHeight: window.totalHeight,
    measureRef,
  };
}
