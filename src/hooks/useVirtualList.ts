import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ContentCache } from '../core/cache';
import {
  createVirtualizer,
  pinnedIds,
  prefetchIds,
  type VirtualItem,
} from '../core/virtualizer';
import { activeNodeByCoverage, isNearBottom } from '../core/scrollSync';
import {
  applyHeightMeasurements,
  reconcileSequenceSwap,
  type HeightMeasurement,
  type ScrollDirection,
} from '../core/anchoring';

export interface UseVirtualListOptions<Content = string> {
  ids: string[];
  overscan?: number | undefined;
  prefetchCount?: number | undefined;
  estimateHeight?: number | undefined;
  cache?: ContentCache<Content> | undefined;
  prefetch?: ((id: string) => void) | undefined;
}

export interface VirtualList {
  scrollRef: React.RefObject<HTMLDivElement>;
  items: VirtualItem[];
  paddingTop: number;
  paddingBottom: number;
  totalHeight: number;
  measureRef: (id: string) => (el: HTMLElement | null) => void;
  activeId: string | undefined;
  activeOffset: number;
  atBottom: boolean;
  scrollToId: (id: string, offset?: number) => void;
}

interface Metrics {
  scrollTop: number;
  viewportHeight: number;
}

const readHeight = (el: HTMLElement): number =>
  el.getBoundingClientRect().height;

export function useVirtualList<Content = string>(
  options: UseVirtualListOptions<Content>,
): VirtualList {
  const { ids, overscan = 0, prefetchCount = 0, cache, prefetch } = options;

  const scrollRef = useRef<HTMLDivElement>(null);
  const vRef = useRef<ReturnType<typeof createVirtualizer>>();
  if (vRef.current === undefined) {
    vRef.current = createVirtualizer({
      estimateHeight: options.estimateHeight,
    });
  }
  const virtualizer = vRef.current;

  const [metrics, setMetrics] = useState<Metrics>({
    scrollTop: 0,
    viewportHeight: 0,
  });
  const [measureVersion, setMeasureVersion] = useState(0);

  const window = useMemo(
    () =>
      virtualizer.getWindow({
        ids,
        scrollTop: metrics.scrollTop,
        viewportHeight: metrics.viewportHeight,
        overscan,
      }),
    [virtualizer, ids, metrics, overscan, measureVersion],
  );

  const idsRef = useRef(ids);
  idsRef.current = ids;

  const syncMetrics = useCallback(() => {
    const el = scrollRef.current;
    if (el === null) return;
    setMetrics((prev) =>
      prev.scrollTop === el.scrollTop && prev.viewportHeight === el.clientHeight
        ? prev
        : { scrollTop: el.scrollTop, viewportHeight: el.clientHeight },
    );
  }, []);

  const navAnchorRef = useRef<{ id: string; offset: number } | null>(null);
  const expectedTopRef = useRef<number | null>(null);

  const setScrollTop = useCallback((top: number) => {
    const el = scrollRef.current;
    if (el === null) return;
    el.scrollTop = top;
    expectedTopRef.current = el.scrollTop;
  }, []);

  // Last *user* scroll direction (programmatic sets — nav/corrections — are
  // excluded via expectedTopRef). Disambiguates which side to pin when a lazy
  // placeholder straddling the fold is swapped for its children.
  const scrollDirRef = useRef<ScrollDirection>('down');
  const lastTopRef = useRef(0);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el === null) return;
    const isProgrammatic =
      expectedTopRef.current !== null &&
      Math.abs(el.scrollTop - expectedTopRef.current) <= 2;
    if (navAnchorRef.current !== null && !isProgrammatic) {
      navAnchorRef.current = null;
    }
    if (!isProgrammatic && el.scrollTop !== lastTopRef.current) {
      scrollDirRef.current = el.scrollTop > lastTopRef.current ? 'down' : 'up';
    }
    lastTopRef.current = el.scrollTop;
    syncMetrics();
  }, [syncMetrics]);

  useLayoutEffect(() => {
    syncMetrics();
    const el = scrollRef.current;
    if (el === null) return;
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(syncMetrics)
        : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro?.disconnect();
    };
  }, [syncMetrics, onScroll]);

  const elToId = useRef(new Map<Element, string>());
  const idToEl = useRef(new Map<string, HTMLElement>());
  const observerRef = useRef<ResizeObserver | null>(null);

  // A node is *settled* when its rendered height is final: content loaded (or
  // definitively empty). Lazy placeholders and still-fetching sections report
  // `loading` and will change height, so they make useless scroll anchors.
  const isSettled = useCallback((id: string): boolean => {
    const status = idToEl.current.get(id)?.getAttribute('data-status');
    return status === 'loaded' || status === 'empty';
  }, []);

  // Anchor correction for **sequence changes** (id swaps never fire a
  // ResizeObserver): the pin/correction policy lives in
  // `core/anchoring.reconcileSequenceSwap`; this effect only detects the swap,
  // feeds it DOM truth (mounted heights), and applies the returned scrollTop.
  const prevIdsRef = useRef(ids);
  useLayoutEffect(() => {
    const prev = prevIdsRef.current;
    if (prev === ids) return;
    prevIdsRef.current = ids;
    const el = scrollRef.current;
    if (el === null) return;
    // A pending navigation re-pins its own target in the ResizeObserver path.
    if (navAnchorRef.current !== null) return;

    // Freshly-inserted items are already mounted at their *real* height (their
    // refs ran before this effect), so the DOM is the source of truth here.
    const scrollTop0 = el.scrollTop;
    const mountedHeights = new Map<string, number>();
    for (const [id, node] of idToEl.current) {
      mountedHeights.set(id, readHeight(node));
    }

    const { targetScrollTop, measured } = reconcileSequenceSwap(virtualizer, {
      prevIds: prev,
      nextIds: ids,
      scrollTop: scrollTop0,
      direction: scrollDirRef.current,
      isSettled,
      mountedHeights,
    });

    if (measured) setMeasureVersion((n) => n + 1);
    if (targetScrollTop !== scrollTop0) {
      setScrollTop(targetScrollTop);
      syncMetrics();
    }
  }, [ids, virtualizer, setScrollTop, syncMetrics, isSettled]);

  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const scrollEl = scrollRef.current;
      const scrollTop = scrollEl?.scrollTop ?? 0;
      const seq = idsRef.current;

      const nav = navAnchorRef.current;
      if (nav !== null) {
        let navChanged = false;
        for (const entry of entries) {
          const id = elToId.current.get(entry.target);
          if (id === undefined) continue;
          const delta = virtualizer.setHeight(
            id,
            readHeight(entry.target as HTMLElement),
          );
          if (delta !== 0) navChanged = true;
        }
        const idx = seq.indexOf(nav.id);
        if (idx !== -1 && scrollEl !== null) {
          const target = virtualizer.offsetAt(seq, idx) + nav.offset;
          if (Math.abs(scrollEl.scrollTop - target) > 0.5) {
            setScrollTop(target);
            syncMetrics();
          } else {
            expectedTopRef.current = scrollEl.scrollTop;
          }
        }
        if (navChanged) setMeasureVersion((n) => n + 1);
        return;
      }

      // The direction-aware correction policy lives in
      // `core/anchoring.applyHeightMeasurements`; this callback only maps
      // observed elements back to ids and applies the returned correction.
      const measurements: HeightMeasurement[] = [];
      for (const entry of entries) {
        const id = elToId.current.get(entry.target);
        if (id === undefined) continue;
        measurements.push({
          id,
          height: readHeight(entry.target as HTMLElement),
        });
      }

      const { correction, changed } = applyHeightMeasurements(virtualizer, {
        seq,
        scrollTop,
        direction: scrollDirRef.current,
        isSettled,
        measurements,
      });

      if (correction !== 0 && scrollEl !== null) {
        setScrollTop(scrollEl.scrollTop + correction);
        syncMetrics();
      }
      if (changed) setMeasureVersion((n) => n + 1);
    });
    observerRef.current = ro;
    for (const el of idToEl.current.values()) ro.observe(el);
    return () => {
      ro.disconnect();
      observerRef.current = null;
    };
  }, [syncMetrics, virtualizer, setScrollTop, isSettled]);

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

  useEffect(() => {
    if (cache === undefined) return;
    cache.setPinned(pinnedIds(ids, window, prefetchCount));
  }, [cache, ids, window, prefetchCount]);

  useEffect(() => {
    if (prefetch === undefined) return;
    for (const id of prefetchIds(ids, window, prefetchCount)) prefetch(id);
  }, [prefetch, ids, window, prefetchCount]);

  const { activeId, activeOffset } = useMemo(() => {
    const nav = navAnchorRef.current;
    if (nav !== null && ids.includes(nav.id)) {
      return { activeId: nav.id, activeOffset: nav.offset };
    }
    const id = activeNodeByCoverage(
      window.items,
      metrics.scrollTop,
      metrics.viewportHeight,
    );
    const item = window.items.find((i) => i.id === id);
    return {
      activeId: id,
      activeOffset:
        item === undefined ? 0 : Math.max(0, metrics.scrollTop - item.start),
    };
  }, [window, metrics.scrollTop, metrics.viewportHeight, ids]);

  const atBottom = isNearBottom(
    metrics.scrollTop,
    metrics.viewportHeight,
    window.totalHeight,
    metrics.viewportHeight,
  );

  const scrollToId = useCallback(
    (id: string, offset = 0) => {
      const el = scrollRef.current;
      if (el === null) return;
      const index = ids.indexOf(id);
      if (index === -1) return;
      navAnchorRef.current = { id, offset };
      setScrollTop(virtualizer.offsetAt(ids, index) + offset);
      syncMetrics();
    },
    [ids, virtualizer, syncMetrics, setScrollTop],
  );

  return {
    scrollRef,
    items: window.items,
    paddingTop: window.paddingTop,
    paddingBottom: window.paddingBottom,
    totalHeight: window.totalHeight,
    measureRef,
    activeId,
    activeOffset,
    atBottom,
    scrollToId,
  };
}
