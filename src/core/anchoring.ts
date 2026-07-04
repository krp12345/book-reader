import type { Virtualizer } from './virtualizer';
import type {
  AnchoredCorrection,
  HeightMeasurement,
  IsSettled,
  ScrollDirection,
} from '../types/core';

export type {
  AnchoredCorrection,
  HeightMeasurement,
  IsSettled,
  ScrollDirection,
} from '../types/core';

/**
 * Anchor correction for **height changes** (the ResizeObserver path). Records
 * `measurements` into the height map (ids not in `seq` are ignored) and
 * returns the scroll correction, computed against the *pre-measurement*
 * offsets.
 *
 * Scrolling down, growth below the fold is below the line being read — no
 * correction (the long-standing rule); only nodes fully above the fold shift
 * the view. Scrolling up, the reader's true anchor is the first *settled* node
 * at/below the fold (the content they scrolled up from): everything
 * materialising above it — including nodes straddling or below the fold line
 * but above the anchor — must correct in full, or each load yanks the anchored
 * content down and the viewport ratchets endlessly up the resolving branch.
 */
export function applyHeightMeasurements(
  virtualizer: Virtualizer,
  input: {
    seq: string[];
    scrollTop: number;
    direction: ScrollDirection;
    isSettled: IsSettled;
    measurements: HeightMeasurement[];
  },
): AnchoredCorrection {
  const { seq, scrollTop, direction, isSettled, measurements } = input;

  // Snapshot each measured node's pre-measurement span (start/bottom) before
  // any height-map mutation — corrections are relative to where things *were*.
  const pending: {
    id: string;
    start: number;
    bottom: number;
    height: number;
  }[] = [];
  for (const { id, height } of measurements) {
    const index = seq.indexOf(id);
    if (index === -1) continue;
    const start = virtualizer.offsetAt(seq, index);
    pending.push({
      id,
      start,
      bottom: start + virtualizer.getHeight(id),
      height,
    });
  }

  let anchorStart = scrollTop;
  if (direction === 'up') {
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
    if (direction === 'up') {
      if (start < anchorStart) correction += delta;
    } else if (bottom <= scrollTop) {
      correction += delta;
    }
  }

  return { correction, changed };
}

/**
 * Anchor correction for **sequence changes** (not height changes): when lazy
 * children replace their branch placeholder — or the tree otherwise swaps ids —
 * the height-map offsets of everything after the swap shift by
 * (sum of new estimates − old placeholder height), and no ResizeObserver ever
 * fires for an insertion/removal. Without compensation the reading line jumps
 * whenever a subtree materialises *above* the fold (the recursive scroll-up
 * resolution case). Scrolling up, pin the first *settled* survivor at/below
 * the fold — the content the reader scrolled up from — so the whole
 * materialising region above it extends the scrollback without moving it.
 * Scrolling down, pin the fold node itself (children unfold in place below
 * the line being read); if the fold node was removed, pin the nearest
 * survivor above.
 *
 * Mutates the height map with `mountedHeights` (DOM truth) and returns the
 * scrollTop that keeps the anchor pinned; the caller applies it when it
 * differs from the input `scrollTop`.
 */
export function reconcileSequenceSwap(
  virtualizer: Virtualizer,
  input: {
    prevIds: string[];
    nextIds: string[];
    /** The scroll position at the moment of the swap. */
    scrollTop: number;
    direction: ScrollDirection;
    isSettled: IsSettled;
    /** Current DOM heights of every mounted node. */
    mountedHeights: ReadonlyMap<string, number>;
  },
): { targetScrollTop: number; measured: boolean } {
  const {
    prevIds: prev,
    nextIds,
    scrollTop: scrollTop0,
    direction,
    isSettled,
    mountedHeights,
  } = input;

  // Step A — reconcile the height map with DOM truth. Freshly-inserted items
  // are already mounted at their *real* height while the map still holds
  // estimates, and an item may have grown just before the swap with its
  // ResizeObserver tick still pending. Sync every mounted height, applying the
  // same fold-relative correction the observer path would have (against the
  // *pre-sync* offsets of the old sequence) — absorbing a delta without its
  // correction would silently lose that scroll adjustment forever, since the
  // observer will then see delta 0.
  const oldIndex = new Map(prev.map((id, i) => [id, i]));
  const newIndex = new Map(nextIds.map((id, i) => [id, i]));
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
  if (direction === 'up') {
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
  for (const [id, height] of mountedHeights) {
    const oldHeight = virtualizer.getHeight(id);
    const delta = virtualizer.setHeight(id, height);
    if (delta === 0) continue;
    measured = true;
    const oi = oldIndex.get(id);
    if (oi === undefined) continue; // brand-new this commit: nothing to correct
    const preStart = preStarts[oi] as number;
    if (anchorIdx !== -1) {
      if (oi < anchorIdx) syncCorrection += delta;
    } else if (preStart + oldHeight <= scrollTop0) {
      syncCorrection += delta;
    } else if (preStart < scrollTop0 && direction === 'up') {
      syncCorrection += delta;
    }
  }

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
    if (foldIdx === -1) return { targetScrollTop: scrollTop, measured };
    if (newIndex.has(prev[foldIdx] as string)) {
      anchorIdx = foldIdx;
    } else if (direction === 'up') {
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
      pinDelta =
        virtualizer.offsetAt(nextIds, ni) - (oldStarts[anchorIdx] as number);
  }

  return { targetScrollTop: scrollTop + pinDelta, measured };
}
