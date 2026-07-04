import type { RefObject } from 'react';
import type {
  FetchContent,
  GetNextNode,
  GetPrevNode,
  SanitizeOption,
  ScrollRequest,
} from '../public';
import type { ContentCache } from '../core/cache';
import type { TreeStore } from '../core/treeStore';
import type { VirtualItem } from '../core/virtualizer';

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
  scrollRef: RefObject<HTMLDivElement>;
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
