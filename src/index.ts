export const VERSION = '0.0.0';

export { BookReader } from './components/bookReader/BookReader';
export { TreePane } from './components/tree/TreePane';
export { TreePaneView } from './components/tree/view/TreePaneView';
export type { TreePaneProps } from './components/tree/TreePane';
export type { TreePaneViewProps } from './components/tree/view/TreePaneView';
export { TreeSearch } from './components/tree/search/TreeSearch';
export type { TreeSearchProps } from './components/tree/search/TreeSearch';
export { ContentPane } from './components/content/ContentPane';
export type { ContentPaneProps } from './components/content/ContentPane';
export { ContentNode } from './components/content/node/ContentNode';
export type { ContentNodeProps } from './components/content/node/ContentNode';
export { TreeOverlay } from './components/tree/overlay/TreeOverlay';
export type { TreeOverlayProps } from './components/tree/overlay/TreeOverlay';
export { defaultTreeNode } from './components/tree/view/defaultTreeNode';

export { createTreeStore } from './core/tree/treeStore';
export type { TreeStore, CreateTreeStoreOptions } from './core/tree/treeStore';
export { createReadingOrder, resolveToNode } from './core/tree/traversal';
export type { ReadingOrder, ResolveDeps } from './core/tree/traversal';
export { createContentCache } from './core/content/cache';
export type { ContentCache } from './core/content/cache';
export {
  createVirtualizer,
  correctScrollTop,
  pinnedIds,
  prefetchIds,
} from './core/content/virtualizer';
export type {
  Virtualizer,
  VirtualizerConfig,
  VirtualItem,
  VirtualWindow,
  WindowInput,
} from './core/content/virtualizer';
export {
  activeNodeAt,
  isNearBottom,
  withReadingOverrides,
} from './core/content/scrollSync';
export type { NodeSpan, ReadingOverrides } from './core/content/scrollSync';

export { sanitizeHtml } from './utils/content/sanitize';

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
