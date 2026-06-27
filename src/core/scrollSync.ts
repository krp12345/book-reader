/**
 * Scroll ⟷ tree synchronisation: the pure mapping behind "the two panes move
 * together" (§2.3). All framework-free and unit-testable; the React wiring that
 * reads real scroll geometry lives in `content/useVirtualList.ts`.
 *
 * Three concerns:
 * - **Active-node detection** — `activeNodeAt` turns a scroll reference line into
 *   the node the reader is currently on (drives tree highlight + auto-expand).
 * - **Bottom approach** — `isNearBottom` says when to auto-fetch the next node.
 * - **Reading order** — `withReadingOverrides` layers the optional
 *   `getNextNode`/`getPrevNode` consumer overrides over the base DFS
 *   {@link ReadingOrder}; `nextNodeToLoad` finds the next lazy subtree to fetch so
 *   reading can continue past the currently-loaded frontier.
 *
 * Pure: no React. See CONVENTIONS.md.
 */
import type { TreeStore } from './treeStore';
import type { ReadingOrder } from './traversal';
import type { GetNextNode, GetPrevNode } from '../types';

/** A node's resolved vertical span on the reading surface. */
export interface NodeSpan {
  id: string;
  /** Absolute top offset (px). */
  start: number;
  /** Height (px) in use (measured or estimated). */
  height: number;
}

/**
 * The id of the node whose span contains `referenceLine` (typically the scroll
 * offset, i.e. the node at the top of the viewport). Spans are assumed contiguous
 * and ordered by `start`. A reference line before the first / past the last span
 * clamps to that end node; an empty list yields `undefined`.
 */
export function activeNodeAt(
  spans: NodeSpan[],
  referenceLine: number,
): string | undefined {
  if (spans.length === 0) return undefined;
  let activeId = spans[0]?.id;
  for (const span of spans) {
    if (span.start <= referenceLine) activeId = span.id;
    else break;
  }
  return activeId;
}

/**
 * The id of the node occupying the **most vertical space** inside the viewport
 * `[scrollTop, scrollTop + viewportHeight)` — i.e. the section the reader is
 * actually on, not merely whichever node clips the top edge (`activeNodeAt`).
 * This is what drives the tree highlight while *scrolling*.
 *
 * Coverage = the overlap between each node's span and the viewport. On a tie
 * (two sections splitting the viewport equally) the **lower** node wins, so the
 * highlight advances as soon as the next section owns at least half the screen —
 * biasing toward forward reading progress. Spans are assumed ordered by `start`;
 * a non-positive `viewportHeight` (not yet measured) falls back to the first span.
 */
export function activeNodeByCoverage(
  spans: NodeSpan[],
  scrollTop: number,
  viewportHeight: number,
): string | undefined {
  if (spans.length === 0) return undefined;
  if (viewportHeight <= 0) return spans[0]?.id;

  const top = scrollTop;
  const bottom = scrollTop + viewportHeight;
  let bestId = spans[0]?.id;
  let bestCoverage = -1;

  for (const span of spans) {
    // Ordered spans: once one starts at/after the viewport bottom, the rest do too.
    if (span.start >= bottom) break;
    const overlap =
      Math.min(bottom, span.start + span.height) - Math.max(top, span.start);
    // `>=` (not `>`) so that on equal coverage the later — i.e. *lower* — span
    // replaces the earlier one: ties resolve downward.
    if (overlap >= bestCoverage) {
      bestCoverage = overlap;
      bestId = span.id;
    }
  }
  return bestId;
}

/**
 * Whether the viewport bottom is within `threshold` px of the end of the surface
 * (or the whole surface already fits) — the cue to auto-fetch the next node.
 */
export function isNearBottom(
  scrollTop: number,
  viewportHeight: number,
  totalHeight: number,
  threshold: number,
): boolean {
  return totalHeight - (scrollTop + viewportHeight) <= threshold;
}

/** Optional consumer overrides for reading order. */
export interface ReadingOverrides<Meta = unknown> {
  getNextNode?: GetNextNode<Meta> | undefined;
  getPrevNode?: GetPrevNode<Meta> | undefined;
}

/**
 * The first node at/after `fromId` (in `sequence`) whose children are loadable
 * but not yet loaded — the next lazy subtree to fetch so reading continues past
 * the loaded frontier. `undefined` when the forward frontier is fully loaded.
 */
export function nextNodeToLoad<Meta = unknown>(
  store: TreeStore<Meta>,
  sequence: string[],
  fromId?: string,
): string | undefined {
  const from = fromId === undefined ? 0 : Math.max(0, sequence.indexOf(fromId));
  for (let i = from; i < sequence.length; i++) {
    const id = sequence[i];
    if (id !== undefined && store.isExpandable(id) && !store.isLoaded(id)) {
      return id;
    }
  }
  return undefined;
}

/**
 * Wraps a base DFS {@link ReadingOrder} with the consumer's `getNextNode` /
 * `getPrevNode` overrides. When an override is present it decides the neighbour
 * (translating the returned node → its id); otherwise the base order is used.
 * `getSequence` walks forward via the (possibly overridden) `getNext` with a
 * visited guard, so a misbehaving override can never spin forever.
 */
export function withReadingOverrides<Meta = unknown>(
  store: TreeStore<Meta>,
  base: ReadingOrder,
  overrides: ReadingOverrides<Meta> = {},
): ReadingOrder {
  const { getNextNode, getPrevNode } = overrides;

  function neighbour(
    id: string,
    override: GetNextNode<Meta> | GetPrevNode<Meta>,
    direction: 'forward' | 'backward',
  ): string | undefined {
    const node = store.getNode(id);
    if (node === undefined) return undefined;
    const next = override(node, { node, path: store.getPath(id), direction });
    return next === null ? undefined : next.id;
  }

  return {
    getFirst: () => base.getFirst(),
    getLast: () => base.getLast(),

    getNext(id) {
      if (getNextNode === undefined) return base.getNext(id);
      return neighbour(id, getNextNode, 'forward');
    },

    getPrev(id) {
      if (getPrevNode === undefined) return base.getPrev(id);
      return neighbour(id, getPrevNode, 'backward');
    },

    getSequence() {
      const out: string[] = [];
      const seen = new Set<string>();
      let id = this.getFirst();
      while (id !== undefined && !seen.has(id)) {
        out.push(id);
        seen.add(id);
        id = this.getNext(id);
      }
      return out;
    },
  };
}
