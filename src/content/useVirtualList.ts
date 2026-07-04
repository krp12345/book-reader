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
  const scrollDirRef = useRef<'down' | 'up'>('down');
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

  // Anchor correction for **sequence changes** (not height changes): when lazy
  // children replace their branch placeholder — or the tree otherwise swaps ids —
  // the height-map offsets of everything after the swap shift by
  // (sum of new estimates − old placeholder height), and no ResizeObserver ever
  // fires for an insertion/removal. Without compensation the reading line jumps
  // whenever a subtree materialises *above* the fold (the recursive scroll-up
  // resolution case). Scrolling up, pin the first *settled* survivor at/below
  // the fold — the content the reader scrolled up from — so the whole
  // materialising region above it extends the scrollback without moving it.
  // Scrolling down, pin the fold node itself (children unfold in place below
  // the line being read); if the fold node was removed, pin the nearest
  // survivor above.
  const prevIdsRef = useRef(ids);
  useLayoutEffect(() => {
    const prev = prevIdsRef.current;
    if (prev === ids) return;
    prevIdsRef.current = ids;
    const el = scrollRef.current;
    if (el === null) return;
    // A pending navigation re-pins its own target in the ResizeObserver path.
    if (navAnchorRef.current !== null) return;

    // Step A — reconcile the height map with DOM truth. Freshly-inserted items
    // are already mounted at their *real* height (their refs ran before this
    // effect) while the map still holds estimates, and an item may have grown
    // just before the swap with its ResizeObserver tick still pending. Sync
    // every mounted height, applying the same fold-relative correction the
    // observer path would have (against the *pre-sync* offsets of the old
    // sequence) — absorbing a delta without its correction would silently lose
    // that scroll adjustment forever, since the observer will then see delta 0.
    const scrollTop0 = el.scrollTop;
    const oldIndex = new Map(prev.map((id, i) => [id, i]));
    const newIndex = new Map(ids.map((id, i) => [id, i]));
    const preStarts: number[] = [];
    {
      let acc = 0;
      for (const id of prev) {
        preStarts.push(acc);
        acc += virtualizer.getHeight(id);
      }
    }

    // Choose the anchor BEFORE reconciling heights. Scrolling up, it is the
    // first *settled* survivor at/below the fold — the content the reader
    // scrolled up from. The fold itself sits inside the materialising region,
    // so anchoring there would make the view follow the churn up the resolving
    // branch (and push the reader's content out below). Scrolling down the
    // legacy fold policy is right: content unfolds in place below the line.
    let anchorIdx = -1;
    if (scrollDirRef.current === 'up') {
      for (let i = 0; i < prev.length; i++) {
        const id = prev[i] as string;
        if (
          (preStarts[i] as number) + virtualizer.getHeight(id) > scrollTop0 &&
          isSettled(id) &&
          newIndex.has(id)
        ) {
          anchorIdx = i;
          break;
        }
      }
    }

    let syncCorrection = 0;
    let measured = false;
    for (const [id, node] of idToEl.current) {
      const oldHeight = virtualizer.getHeight(id);
      const delta = virtualizer.setHeight(id, readHeight(node));
      if (delta === 0) continue;
      measured = true;
      const oi = oldIndex.get(id);
      if (oi === undefined) continue; // brand-new this commit: nothing to correct
      const preStart = preStarts[oi] as number;
      if (anchorIdx !== -1) {
        if (oi < anchorIdx) syncCorrection += delta;
      } else if (preStart + oldHeight <= scrollTop0) {
        syncCorrection += delta;
      } else if (preStart < scrollTop0 && scrollDirRef.current === 'up') {
        syncCorrection += delta;
      }
    }
    if (measured) setMeasureVersion((n) => n + 1);

    // Step B — pin the anchor across the sequence swap, in the now-exact
    // coordinates. Post-sync starts of the old sequence:
    const scrollTop = scrollTop0 + syncCorrection;
    let foldIdx = -1;
    let start = 0;
    const oldStarts: number[] = [];
    for (let i = 0; i < prev.length; i++) {
      oldStarts.push(start);
      const height = virtualizer.getHeight(prev[i] as string);
      if (foldIdx === -1 && start + height > scrollTop) foldIdx = i;
      start += height;
    }

    // No settled anchor (or scrolling down): legacy fold policy — prefer the
    // fold node itself; else the nearest survivor on the side the reader came
    // from (below when scrolling up, above when scrolling down).
    if (anchorIdx === -1) {
      if (foldIdx === -1) {
        if (syncCorrection !== 0) {
          setScrollTop(scrollTop);
          syncMetrics();
        }
        return;
      }
      if (newIndex.has(prev[foldIdx] as string)) {
        anchorIdx = foldIdx;
      } else if (scrollDirRef.current === 'up') {
        for (let i = foldIdx + 1; i < prev.length; i++) {
          if (newIndex.has(prev[i] as string)) {
            anchorIdx = i;
            break;
          }
        }
      } else {
        for (let i = foldIdx - 1; i >= 0; i--) {
          if (newIndex.has(prev[i] as string)) {
            anchorIdx = i;
            break;
          }
        }
      }
    }
    let pinDelta = 0;
    if (anchorIdx !== -1) {
      const anchorId = prev[anchorIdx] as string;
      const ni = newIndex.get(anchorId);
      if (ni !== undefined)
        pinDelta = virtualizer.offsetAt(ids, ni) - (oldStarts[anchorIdx] as number);
    }

    const target = scrollTop + pinDelta;
    if (target !== scrollTop0) {
      setScrollTop(target);
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

      const pending: {
        id: string;
        start: number;
        bottom: number;
        height: number;
      }[] = [];
      for (const entry of entries) {
        const id = elToId.current.get(entry.target);
        if (id === undefined) continue;
        const index = seq.indexOf(id);
        if (index === -1) continue;
        const start = virtualizer.offsetAt(seq, index);
        pending.push({
          id,
          start,
          bottom: start + virtualizer.getHeight(id),
          height: readHeight(entry.target as HTMLElement),
        });
      }

      // Scrolling down, growth below the fold is below the line being read —
      // no correction (the long-standing rule); only nodes fully above the
      // fold shift the view. Scrolling up, the reader's true anchor is the
      // first *settled* node at/below the fold (the content they scrolled up
      // from): everything materialising above it — including nodes straddling
      // or below the fold line but above the anchor — must correct in full,
      // or each load yanks the anchored content down and the viewport
      // ratchets endlessly up the resolving branch.
      let anchorStart = scrollTop;
      if (scrollDirRef.current === 'up') {
        let acc = 0;
        for (const id of seq) {
          const h = virtualizer.getHeight(id);
          if (acc + h > scrollTop && isSettled(id)) {
            anchorStart = acc;
            break;
          }
          acc += h;
        }
      }

      let correction = 0;
      let changed = false;
      for (const { id, start, bottom, height } of pending) {
        const delta = virtualizer.setHeight(id, height);
        if (delta === 0) continue;
        changed = true;
        if (scrollDirRef.current === 'up') {
          if (start < anchorStart) correction += delta;
        } else if (bottom <= scrollTop) {
          correction += delta;
        }
      }

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
