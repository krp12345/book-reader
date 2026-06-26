/**
 * Virtualization geometry (§3 layers 2 & 3): the pure math behind "huge books
 * perform; zero flicker".
 *
 * Three independent concerns, all framework-free and unit-testable:
 *
 * - **Height map** — remember each node's *measured* height; fall back to an
 *   estimate for nodes not yet on screen. `setHeight` returns the delta from the
 *   height previously in use, which is what anchor correction keys on.
 * - **Windowing** — `getWindow` turns a scroll position into the slice of the
 *   sequence to mount (viewport + overscan), plus the spacer paddings that hold
 *   the off-screen scroll height. Offsets come from the height map, so a measured
 *   node and its estimated neighbours coexist without layout drift.
 * - **Anchor correction** — when a node above the viewport top changes height the
 *   content under the reader's eyes would jump; `correctScrollTop` says how much
 *   to nudge `scrollTop` to cancel it.
 *
 * The cache (pinning) is a separate layer; `pinnedIds`/`prefetchIds` translate a
 * window into the id sets the cache layer pins and warms.
 *
 * Pure: no React. See CONVENTIONS.md.
 */

/** Estimated height (px) for a node we haven't measured yet. */
const DEFAULT_ESTIMATE = 200;

export interface VirtualizerConfig {
  /** Height (px) assumed for not-yet-measured nodes. Default {@link DEFAULT_ESTIMATE}. */
  estimateHeight?: number | undefined;
}

/** A mounted node with its resolved position in the scroll surface. */
export interface VirtualItem {
  id: string;
  /** Index within the input sequence. */
  index: number;
  /** Absolute top offset (px) from the top of the content surface. */
  start: number;
  /** Height (px): the measured value if known, else the estimate. */
  height: number;
}

/** The result of windowing: which nodes to mount and the spacers around them. */
export interface VirtualWindow {
  /** First mounted index (after overscan); `0` for an empty list. */
  startIndex: number;
  /** Last mounted index, inclusive; `-1` for an empty list. */
  endIndex: number;
  /** Mounted nodes, in order, with absolute positions. */
  items: VirtualItem[];
  /** Spacer height (px) above the first mounted node. */
  paddingTop: number;
  /** Spacer height (px) below the last mounted node. */
  paddingBottom: number;
  /** Total height (px) of the whole sequence. */
  totalHeight: number;
}

export interface WindowInput {
  /** The full reading sequence, in order. */
  ids: string[];
  /** Current scroll offset (px) of the content surface. */
  scrollTop: number;
  /**
   * Visible height (px) of the scroll surface. A non-positive value means the
   * viewport hasn't been measured yet; the whole sequence is mounted (the safe,
   * no-flicker default) until a real height arrives.
   */
  viewportHeight: number;
  /** Extra nodes mounted on each side of the viewport. Default `0`. */
  overscan?: number | undefined;
}

export interface Virtualizer {
  /**
   * Record a node's measured height. Returns the delta from the height that was
   * previously in use (measured value or estimate) — feed this to
   * {@link correctScrollTop}.
   */
  setHeight(id: string, height: number): number;
  /** Height in use for `id`: the measured value if known, else the estimate. */
  getHeight(id: string): number;
  /** Whether `id` has a real measurement (vs. the estimate). */
  isMeasured(id: string): boolean;
  /** Forget a node's measurement (e.g. it left the book). */
  delete(id: string): boolean;
  /** Compute the mounted window for a scroll state. */
  getWindow(input: WindowInput): VirtualWindow;
  /** The estimate used for unmeasured nodes. */
  readonly estimateHeight: number;
}

export function createVirtualizer(config: VirtualizerConfig = {}): Virtualizer {
  const estimateHeight = config.estimateHeight ?? DEFAULT_ESTIMATE;
  const measured = new Map<string, number>();

  const getHeight = (id: string): number => measured.get(id) ?? estimateHeight;

  return {
    estimateHeight,
    getHeight,
    isMeasured: (id) => measured.has(id),

    setHeight(id, height) {
      const delta = height - getHeight(id);
      measured.set(id, height);
      return delta;
    },

    delete(id) {
      return measured.delete(id);
    },

    getWindow({ ids, scrollTop, viewportHeight, overscan = 0 }) {
      const n = ids.length;
      if (n === 0) {
        return {
          startIndex: 0,
          endIndex: -1,
          items: [],
          paddingTop: 0,
          paddingBottom: 0,
          totalHeight: 0,
        };
      }

      // Resolve every node's height + absolute start once (O(n)); fine for the
      // tens-of-thousands range we target.
      const layout: { id: string; start: number; height: number }[] = [];
      let acc = 0;
      for (const id of ids) {
        const height = getHeight(id);
        layout.push({ id, start: acc, height });
        acc += height;
      }
      const totalHeight = acc;

      const fullRange = (): VirtualWindow => ({
        startIndex: 0,
        endIndex: n - 1,
        items: layout.map((item, index) => ({ ...item, index })),
        paddingTop: 0,
        paddingBottom: 0,
        totalHeight,
      });

      // Viewport not yet measured → mount everything (no basis to window on).
      if (viewportHeight <= 0) return fullRange();

      const viewportTop = Math.max(0, scrollTop);
      const viewportBottom = scrollTop + viewportHeight;

      // First node whose bottom edge is past the viewport top.
      let first = -1;
      for (const [i, item] of layout.entries()) {
        if (item.start + item.height > viewportTop) {
          first = i;
          break;
        }
      }
      if (first === -1) first = n - 1; // scrolled past the end → mount the last

      // Extend down while nodes still begin before the viewport bottom.
      let last = first;
      for (let i = first + 1; i < n; i++) {
        const item = layout[i];
        if (item === undefined || item.start >= viewportBottom) break;
        last = i;
      }

      const startIndex = Math.max(0, first - overscan);
      const endIndex = Math.min(n - 1, last + overscan);

      const items: VirtualItem[] = [];
      for (let i = startIndex; i <= endIndex; i++) {
        const item = layout[i];
        if (item === undefined) continue;
        items.push({ ...item, index: i });
      }

      const head = layout[startIndex];
      const tail = layout[endIndex];
      const paddingTop = head?.start ?? 0;
      const paddingBottom =
        tail === undefined ? 0 : totalHeight - (tail.start + tail.height);

      return { startIndex, endIndex, items, paddingTop, paddingBottom, totalHeight };
    },
  };
}

/**
 * Anchor correction: the new `scrollTop` that cancels a height change so content
 * under the reader's eyes never jumps.
 *
 * A node only shifts the viewport when it sits *above* the viewport top: growing
 * it pushes everything below — including what's on screen — down by `delta`, so
 * we add `delta` back to `scrollTop`. A node starting at or below the viewport
 * top grows into off-screen space (or stays pinned at the top), so no correction.
 *
 * @param itemStart absolute top offset of the changed node (unaffected by its own
 *   height change)
 * @param delta signed height change (`newHeight - oldHeight`)
 * @param scrollTop current scroll offset
 */
export function correctScrollTop(
  itemStart: number,
  delta: number,
  scrollTop: number,
): number {
  return itemStart < scrollTop ? scrollTop + delta : scrollTop;
}

/** The slice `[from, to)` of `ids`, clamped to the array bounds. */
function slice(ids: string[], from: number, to: number): string[] {
  return ids.slice(Math.max(0, from), Math.max(0, to));
}

/**
 * Ids the cache should pin: the mounted window plus `prefetchCount` nodes ahead,
 * so scroll-back over read content and the about-to-enter nodes are always
 * synchronous cache hits (never evicted, never re-fetched into view).
 */
export function pinnedIds(
  ids: string[],
  window: VirtualWindow,
  prefetchCount: number,
): string[] {
  if (window.endIndex < window.startIndex) return [];
  return slice(ids, window.startIndex, window.endIndex + 1 + Math.max(0, prefetchCount));
}

/**
 * Ids just past the mounted window to warm ahead of the reader (length ≤
 * `prefetchCount`) — the content pane routes these through `cache.dedupe`.
 */
export function prefetchIds(
  ids: string[],
  window: VirtualWindow,
  prefetchCount: number,
): string[] {
  if (prefetchCount <= 0 || window.endIndex < window.startIndex) return [];
  return slice(ids, window.endIndex + 1, window.endIndex + 1 + prefetchCount);
}
