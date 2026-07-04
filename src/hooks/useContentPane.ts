import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ContentCache } from '../core/cache';
import type { TreeStore } from '../core/treeStore';
import { createReadingOrder } from '../core/traversal';
import { withReadingOverrides } from '../core/scrollSync';
import type { VirtualItem } from '../core/virtualizer';
import type {
  FetchContent,
  GetNextNode,
  GetPrevNode,
  SanitizeOption,
  ScrollRequest,
} from '../types';
import { prefetchNodeContent } from '../utils/prefetchNodeContent';
import { useVirtualList } from './useVirtualList';
import { useStoreVersion } from './useStoreVersion';

export interface UseContentPaneOptions<Meta = unknown, Content = string> {
  store: TreeStore<Meta>;
  fetchContent: FetchContent<Meta, Content>;
  sanitize?: SanitizeOption | undefined;
  cache?: ContentCache<Content> | undefined;
  overscan?: number | undefined;
  prefetchCount?: number | undefined;
  estimateHeight?: number | undefined;
  getNextNode?: GetNextNode<Meta> | undefined;
  getPrevNode?: GetPrevNode<Meta> | undefined;
  onActiveChange?: ((id: string, offset: number) => void) | undefined;
  /** Ensure a lazy node's children load when it enters the reading window. */
  ensureLazy?: ((id: string) => void) | undefined;
  scrollRequest?: ScrollRequest | undefined;
}

export interface ContentPaneState {
  scrollRef: React.RefObject<HTMLDivElement>;
  items: VirtualItem[];
  paddingTop: number;
  paddingBottom: number;
  totalHeight: number;
  measureRef: (id: string) => (el: HTMLElement | null) => void;
  /** Whether `id` is an unresolved lazy branch (renders the placeholder). */
  isLazyPending: (id: string) => boolean;
  /**
   * Book-level empty state: the whole (possibly search-replaced) tree has no
   * showable content node at all — an empty book, or a zero-result search. The
   * per-*section* empty state (`renderEmpty`) is unrelated: that is one node
   * whose fetched content came back empty.
   */
  noData: boolean;
}

/**
 * All of `ContentPane`'s behavior: reading-order sequence (override-aware,
 * recomputed on store changes), lazy-placeholder filtering, virtualization
 * wiring, pin/prefetch, the scroll-to-node request, the lazy scroll trigger,
 * and active-node reporting. The component only renders the scroll surface.
 */
export function useContentPane<Meta = unknown, Content = string>(
  options: UseContentPaneOptions<Meta, Content>,
): ContentPaneState {
  const {
    store,
    fetchContent,
    sanitize,
    cache,
    overscan = 2,
    prefetchCount = 2,
    estimateHeight,
    getNextNode,
    getPrevNode,
    onActiveChange,
    ensureLazy,
    scrollRequest,
  } = options;

  // Recompute the reading order when lazy children load / the tree is replaced.
  const version = useStoreVersion(store);

  const fullSeq = useMemo(() => {
    const order = withReadingOverrides(store, createReadingOrder(store), {
      getNextNode,
      getPrevNode,
    });
    return order.getSequence();
  }, [store, getNextNode, getPrevNode, version]);

  const isLazyPending = useCallback(
    (id: string): boolean =>
      store.isLazy(id) && store.getLazyStatus(id) !== 'loaded',
    [store],
  );

  const ids = useMemo(
    () =>
      fullSeq.filter(
        (id) =>
          // An unresolved lazy branch renders a placeholder in reading order so
          // (a) the reader sees it loading and (b) scrolling to it triggers the
          // fetch; once loaded a pure-branch (hasContent:false) drops out again.
          isLazyPending(id) || store.getNode(id)?.hasContent !== false,
      ),
    [fullSeq, store, version, isLazyPending],
  );

  const contentIds = useMemo(() => new Set(ids), [ids]);
  const resolveContentId = useCallback(
    (id: string): string | undefined => {
      if (contentIds.has(id)) return id;
      const from = fullSeq.indexOf(id);
      if (from === -1) return undefined;
      for (let i = from + 1; i < fullSeq.length; i++) {
        const candidate = fullSeq[i];
        if (candidate !== undefined && contentIds.has(candidate))
          return candidate;
      }
      return undefined;
    },
    [contentIds, fullSeq],
  );

  const prefetch = useCallback(
    (id: string) => {
      const node = store.getNode(id);
      if (node === undefined || cache === undefined) return;
      prefetchNodeContent({
        node,
        path: store.getPath(id),
        fetchContent,
        sanitize,
        cache,
      });
    },
    [store, cache, fetchContent, sanitize],
  );

  const {
    scrollRef,
    items,
    paddingTop,
    paddingBottom,
    totalHeight,
    measureRef,
    activeId,
    activeOffset,
    scrollToId,
  } = useVirtualList({
    ids,
    overscan,
    prefetchCount,
    estimateHeight,
    cache,
    prefetch: cache !== undefined ? prefetch : undefined,
  });

  useEffect(() => {
    if (activeId !== undefined) onActiveChange?.(activeId, activeOffset);
  }, [activeId, activeOffset, onActiveChange]);

  // Scroll-trigger: when an unresolved lazy branch is in (or near) the window,
  // fetch its children. `ensureLazy` is idempotent / dedup'd, so re-running on
  // every window change is safe.
  useEffect(() => {
    if (ensureLazy === undefined) return;
    for (const { id } of items) {
      if (store.isLazy(id) && store.getLazyStatus(id) === 'unloaded') {
        ensureLazy(id);
      }
    }
  }, [items, store, ensureLazy, version]);

  const lastScrollToken = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (scrollRequest === undefined) return;
    if (scrollRequest.token === lastScrollToken.current) return;
    lastScrollToken.current = scrollRequest.token;
    const targetId = resolveContentId(scrollRequest.id);
    if (targetId !== undefined) scrollToId(targetId, scrollRequest.offset);
  }, [scrollRequest, scrollToId, resolveContentId]);

  return {
    scrollRef,
    items,
    paddingTop,
    paddingBottom,
    totalHeight,
    measureRef,
    isLazyPending,
    noData: ids.length === 0,
  };
}
