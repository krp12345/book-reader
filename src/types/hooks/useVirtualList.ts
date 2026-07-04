import type { RefObject } from 'react';
import type { ContentCache } from '../core/cache';
import type { VirtualItem } from '../core/virtualizer';

export interface UseVirtualListOptions<Content = string> {
  ids: string[];
  overscan?: number | undefined;
  prefetchCount?: number | undefined;
  estimateHeight?: number | undefined;
  cache?: ContentCache<Content> | undefined;
  prefetch?: ((id: string) => void) | undefined;
}

export interface VirtualList {
  scrollRef: RefObject<HTMLDivElement>;
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

export interface Metrics {
  scrollTop: number;
  viewportHeight: number;
}
