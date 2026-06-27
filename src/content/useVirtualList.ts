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
import { activeNodeByCoverage, isNearBottom } from '../core/scrollSync';

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
  /** The node currently at the top of the viewport (drives tree sync). */
  activeId: string | undefined;
  /** Pixels scrolled past the active node's top (for `location`). */
  activeOffset: number;
  /** Whether the viewport is within one screen of the end of the surface. */
  atBottom: boolean;
  /** Scroll a (possibly off-screen) node to the top of the viewport. */
  scrollToId: (id: string, offset?: number) => void;
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

  // The current reading sequence, readable from the (non-reactive) RO callback so
  // anchor correction resolves a measured node's start straight from the height
  // map (`offsetAt`) instead of a possibly-stale rendered window.
  const idsRef = useRef(ids);
  idsRef.current = ids;

  const syncMetrics = useCallback(() => {
    const el = scrollRef.current;
    if (el === null) return;
    // Bail when nothing changed so programmatic scrolls / RO ticks don't churn
    // renders (a fresh object would always re-render otherwise).
    setMetrics((prev) =>
      prev.scrollTop === el.scrollTop && prev.viewportHeight === el.clientHeight
        ? prev
        : { scrollTop: el.scrollTop, viewportHeight: el.clientHeight },
    );
  }, []);

  // --- Navigation anchor (tree click / controlled-location jump) -------------
  // When the reader jumps to a node we own "where the view is" until the user
  // takes over: `navAnchorRef` holds the node whose top must stay at the viewport
  // top, and `expectedTopRef` is the last scrollTop *we* wrote, so a scroll event
  // that doesn't match it is a real user scroll (which releases the anchor).
  const navAnchorRef = useRef<{ id: string; offset: number } | null>(null);
  const expectedTopRef = useRef<number | null>(null);

  // Every programmatic scrollTop write goes through here so `expectedTopRef`
  // tracks the value the browser actually settled on (it may clamp).
  const setScrollTop = useCallback((top: number) => {
    const el = scrollRef.current;
    if (el === null) return;
    el.scrollTop = top;
    expectedTopRef.current = el.scrollTop;
  }, []);

  // Scroll listener: a scroll we didn't initiate (beyond rounding) means the user
  // has taken over, so release any navigation anchor before syncing metrics.
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el === null) return;
    if (
      navAnchorRef.current !== null &&
      (expectedTopRef.current === null ||
        Math.abs(el.scrollTop - expectedTopRef.current) > 2)
    ) {
      navAnchorRef.current = null;
    }
    syncMetrics();
  }, [syncMetrics]);

  // Initial viewport measurement + keep it current as the reader scrolls and as
  // the container resizes. (M5 windowed only at mount/resize; live scroll
  // tracking is what M6 needs for active-node detection + auto-advance.)
  useLayoutEffect(() => {
    syncMetrics();
    const el = scrollRef.current;
    if (el === null) return;
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncMetrics) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro?.disconnect();
    };
  }, [syncMetrics, onScroll]);

  // One ResizeObserver measures every mounted node. On a height change we update
  // the height map and, if the node sits above the viewport top, correct
  // scrollTop synchronously so content under the reader's eyes doesn't jump.
  const elToId = useRef(new Map<Element, string>());
  const idToEl = useRef(new Map<string, HTMLElement>());
  const observerRef = useRef<ResizeObserver | null>(null);

  // Own the ResizeObserver's lifecycle in a layout effect — *not* lazy-init during
  // render. Creating it in render is an impure side effect that StrictMode (double
  // render + mount/unmount/remount) duplicates, leaving two live observers that
  // both apply anchor correction → a double-correction scroll jump. A layout effect
  // runs after commit (so the ref callbacks have already populated the element maps)
  // but before paint, and tears the observer down cleanly.
  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const scrollEl = scrollRef.current;
      const scrollTop = scrollEl?.scrollTop ?? 0;
      const seq = idsRef.current;

      // Navigation in progress: we own the view. Record the new heights, then
      // re-assert the anchor node's top straight from the height map so it stays
      // pinned to the viewport top while content *above* it (overscan nodes still
      // fetching / measuring) settles. This is deterministic — unlike relying on
      // incidental anchor correction, which let an async body above the target
      // drift the target's title above the fold (the "title beginning is gone"
      // bug). The anchor is released the moment the user actually scrolls (see
      // `onScroll`).
      const nav = navAnchorRef.current;
      if (nav !== null) {
        let navChanged = false;
        for (const entry of entries) {
          const id = elToId.current.get(entry.target);
          if (id === undefined) continue;
          const delta = virtualizer.setHeight(id, readHeight(entry.target as HTMLElement));
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

      // Snapshot every changed node's *pre-change* bottom edge from the height map
      // before recording any new height, so all corrections in this batch share one
      // consistent reference frame (an earlier entry's growth must not shift a later
      // entry's offset, and the cached window — which may lag the live scroll — is
      // never consulted). A height change happens at the node's bottom, so its old
      // bottom is what decides whether it shifts on-screen content.
      const pending: { id: string; bottom: number; height: number }[] = [];
      for (const entry of entries) {
        const id = elToId.current.get(entry.target);
        if (id === undefined) continue;
        const index = seq.indexOf(id);
        if (index === -1) continue;
        pending.push({
          id,
          bottom: virtualizer.offsetAt(seq, index) + virtualizer.getHeight(id),
          height: readHeight(entry.target as HTMLElement),
        });
      }

      // Apply the new heights and sum the anchor correction for every node that sat
      // *entirely above* the viewport top (its old bottom at/above scrollTop): only
      // then does its grow/shrink push on-screen content, so the whole delta is
      // cancelled in a single scrollTop write. A node *straddling* the viewport top
      // grows below the top — correcting it would jerk the view (the flicker).
      let correction = 0;
      let changed = false;
      for (const { id, bottom, height } of pending) {
        const delta = virtualizer.setHeight(id, height);
        if (delta === 0) continue;
        changed = true;
        if (bottom <= scrollTop) correction += delta;
      }

      if (correction !== 0 && scrollEl !== null) {
        setScrollTop(scrollEl.scrollTop + correction);
        // Fold the corrected scrollTop into React state *now*, in the same batch
        // as the window recompute below — otherwise the measure-driven render
        // paints the new heights against a stale scrollTop for one frame (the
        // intermittent jump). A real browser's scroll event fixes metrics only a
        // frame later, after that bad frame may already have painted.
        syncMetrics();
      }
      if (changed) setMeasureVersion((n) => n + 1);
    });
    observerRef.current = ro;
    // Observe nodes already mounted: their ref callbacks fired during commit,
    // before this effect existed, so they couldn't observe themselves yet.
    for (const el of idToEl.current.values()) ro.observe(el);
    return () => {
      ro.disconnect();
      observerRef.current = null;
    };
  }, [syncMetrics, virtualizer, setScrollTop]);

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

  // The active node drives the tree highlight. Two regimes:
  //
  // 1. Navigation (a tree click / location jump). `navAnchorRef` is set by
  //    `scrollToId` and we own the view — the active node *is* the anchor. Deriving
  //    it from `scrollTop` here is fragile: `offsetAt(target)` can be fractional
  //    while the browser stores a rounded `scrollTop`, so a coverage/line test can
  //    flip to a neighbour when the target's start lands a sub-pixel off the settled
  //    scrollTop (content sits at the target, but the tree highlights the node
  //    before it). Reporting the anchor keeps the highlight on exactly what was
  //    clicked until the user scrolls (which releases the anchor; see `onScroll`).
  //
  // 2. Free scrolling. The active node is the one occupying the **most** of the
  //    viewport (`activeNodeByCoverage`), with ties resolved to the lower node — the
  //    section the reader is actually on, not whichever node merely clips the top.
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
      activeOffset: item === undefined ? 0 : Math.max(0, metrics.scrollTop - item.start),
    };
    // navAnchorRef is a ref; every change to it is paired with a metrics/window
    // update (scrollToId → syncMetrics, onScroll → syncMetrics, RO → measureVersion),
    // so this memo re-runs and observes the current anchor value.
  }, [window, metrics.scrollTop, metrics.viewportHeight, ids]);

  // Within one viewport of the end → cue the content pane to auto-fetch the next
  // node. A measured viewport is required (threshold 0 before it arrives).
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
      // Take ownership of the view: pin this node's top until the user scrolls,
      // so settling content above it can't drift it off the top.
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
