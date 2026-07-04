export const VERSION = '0.0.0';

export { BookReader } from './components/BookReader';
export { TreePane, TreePaneView } from './components/tree/TreePane';
export type {
  TreePaneProps,
  TreePaneViewProps,
} from './components/tree/TreePane';
export { TreeSearch } from './components/tree/TreeSearch';
export type { TreeSearchProps } from './components/tree/TreeSearch';
export { ContentPane } from './components/content/ContentPane';
export type { ContentPaneProps } from './components/content/ContentPane';
export { ContentNode } from './components/content/ContentNode';
export type { ContentNodeProps } from './components/content/ContentNode';
export { TreeOverlay } from './components/tree/TreeOverlay';
export type { TreeOverlayProps } from './components/tree/TreeOverlay';
export { defaultTreeNode } from './components/tree/defaultTreeNode';

export { createTreeStore } from './core/treeStore';
export type { TreeStore, CreateTreeStoreOptions } from './core/treeStore';
export { createReadingOrder, resolveToNode } from './core/traversal';
export type { ReadingOrder, ResolveDeps } from './core/traversal';
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
  withReadingOverrides,
} from './core/scrollSync';
export type { NodeSpan, ReadingOverrides } from './core/scrollSync';

export { sanitizeHtml } from './utils/sanitize';

export type {
  BookNode,
  BookReaderProps,
  BookReaderClassNames,
  ReadingDirection,
  ReadingOrderContext,
  GetNextNode,
  GetPrevNode,
  BookLocation,
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
  FetchChildren,
  FetchPath,
  LazyStatus,
  SearchContext,
  SearchFn,
  ResetFn,
  SearchApi,
  RenderSearch,
  SanitizeOption,
  ContentStatus,
  ContentState,
  RenderContent,
  ContentNodeWrapperProps,
  ContentNodeApi,
  RenderContentNode,
  RenderLoading,
  RenderEmpty,
  RenderNoData,
  RenderError,
  ScrollRequest,
  CacheConfig,
  ResolvedCacheConfig,
  CacheEntry,
  CacheGetter,
  EvictFn,
  EvictionInput,
} from './types';
