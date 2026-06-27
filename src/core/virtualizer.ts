const DEFAULT_ESTIMATE = 200;

export interface VirtualizerConfig {
  estimateHeight?: number | undefined;
}

export interface VirtualItem {
  id: string;
  index: number;
  start: number;
  height: number;
}

export interface VirtualWindow {
  startIndex: number;
  endIndex: number;
  items: VirtualItem[];
  paddingTop: number;
  paddingBottom: number;
  totalHeight: number;
}

export interface WindowInput {
  ids: string[];
  scrollTop: number;
  viewportHeight: number;
  overscan?: number | undefined;
}

export interface Virtualizer {
  setHeight(id: string, height: number): number;
  getHeight(id: string): number;
  isMeasured(id: string): boolean;
  offsetAt(ids: string[], index: number): number;
  delete(id: string): boolean;
  getWindow(input: WindowInput): VirtualWindow;
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

    offsetAt(ids, index) {
      const upto = Math.min(Math.max(0, index), ids.length);
      let acc = 0;
      for (let i = 0; i < upto; i++) {
        const id = ids[i];
        if (id !== undefined) acc += getHeight(id);
      }
      return acc;
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

      if (viewportHeight <= 0) return fullRange();

      const viewportTop = Math.max(0, scrollTop);
      const viewportBottom = scrollTop + viewportHeight;

      let first = -1;
      for (const [i, item] of layout.entries()) {
        if (item.start + item.height > viewportTop) {
          first = i;
          break;
        }
      }
      if (first === -1) first = n - 1;

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

      return {
        startIndex,
        endIndex,
        items,
        paddingTop,
        paddingBottom,
        totalHeight,
      };
    },
  };
}

export function correctScrollTop(
  itemBottom: number,
  delta: number,
  scrollTop: number,
): number {
  return itemBottom <= scrollTop ? scrollTop + delta : scrollTop;
}

function slice(ids: string[], from: number, to: number): string[] {
  return ids.slice(Math.max(0, from), Math.max(0, to));
}

export function pinnedIds(
  ids: string[],
  window: VirtualWindow,
  prefetchCount: number,
): string[] {
  if (window.endIndex < window.startIndex) return [];
  return slice(
    ids,
    window.startIndex,
    window.endIndex + 1 + Math.max(0, prefetchCount),
  );
}

export function prefetchIds(
  ids: string[],
  window: VirtualWindow,
  prefetchCount: number,
): string[] {
  if (prefetchCount <= 0 || window.endIndex < window.startIndex) return [];
  return slice(ids, window.endIndex + 1, window.endIndex + 1 + prefetchCount);
}
