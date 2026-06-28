import type { TreeStore } from './treeStore';
import type { ReadingOrder } from './traversal';
import type { GetNextNode, GetPrevNode } from '../types';

export interface NodeSpan {
  id: string;
  start: number;
  height: number;
}

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
    if (span.start >= bottom) break;
    const overlap =
      Math.min(bottom, span.start + span.height) - Math.max(top, span.start);
    if (overlap > bestCoverage) {
      bestCoverage = overlap;
      bestId = span.id;
    }
  }
  return bestId;
}

export function isNearBottom(
  scrollTop: number,
  viewportHeight: number,
  totalHeight: number,
  threshold: number,
): boolean {
  return totalHeight - (scrollTop + viewportHeight) <= threshold;
}

export interface ReadingOverrides<Meta = unknown> {
  getNextNode?: GetNextNode<Meta> | undefined;
  getPrevNode?: GetPrevNode<Meta> | undefined;
}

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
