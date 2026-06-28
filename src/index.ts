export const VERSION = '0.0.0';

export { BookReader } from './BookReader';
export { TreePane, TreePaneView } from './tree/TreePane';
export type { TreePaneProps, TreePaneViewProps } from './tree/TreePane';
export { ContentPane } from './content/ContentPane';
export type { ContentPaneProps, ScrollRequest } from './content/ContentPane';
export { ContentNode } from './content/ContentNode';
export type { ContentNodeProps } from './content/ContentNode';

export { createTreeStore } from './core/treeStore';
export type { TreeStore, CreateTreeStoreOptions } from './core/treeStore';
export { createReadingOrder } from './core/traversal';
export type { ReadingOrder } from './core/traversal';
export { createContentCache } from './core/cache';
export type { ContentCache } from './core/cache';
export {
  createVirtualizer,
  correctScrollTop,
  pinnedIds,
  prefetchIds,
} from './core/virtualizer';
export type {
  Virtualizer,
  VirtualizerConfig,
  VirtualItem,
  VirtualWindow,
  WindowInput,
} from './core/virtualizer';
export {
  activeNodeAt,
  isNearBottom,
  nextNodeToLoad,
  withReadingOverrides,
} from './core/scrollSync';
export type { NodeSpan, ReadingOverrides } from './core/scrollSync';
export { sanitizeHtml } from './content/sanitize';
export { defaultTreeNode } from './tree/defaultTreeNode';
export { TreeOverlay } from './tree/TreeOverlay';
export type { TreeOverlayProps } from './tree/TreeOverlay';

export type {
  BookNode,
  BookReaderProps,
  BookReaderClassNames,
  ReadingDirection,
  ReadingOrderContext,
  GetNextNode,
  GetPrevNode,
  BookLocation,
  LoadChildren,
  LoadChildrenContext,
  TreeNodeState,
  RenderTreeNode,
  ExpandCollapseApi,
  RenderExpandCollapse,
  TreeToggleApi,
  RenderTreeToggle,
  TreeOverlayApi,
  RenderTreeOverlay,
  FetchContext,
  FetchContent,
  SanitizeOption,
  ContentStatus,
  ContentState,
  RenderContent,
  ContentNodeWrapperProps,
  ContentNodeApi,
  RenderContentNode,
  RenderLoading,
  RenderEmpty,
  RenderError,
  CacheConfig,
  ResolvedCacheConfig,
  CacheEntry,
  CacheGetter,
  EvictFn,
  EvictionInput,
} from './types';
