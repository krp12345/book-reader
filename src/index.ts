// Public entry point for the book-reader library.
// Real exports land as milestones complete (see MILESTONES.md).

export const VERSION = '0.0.0';

// --- components ---
export { BookReader } from './BookReader';
export { TreePane } from './tree/TreePane';
export type { TreePaneProps } from './tree/TreePane';
export { ContentPane } from './content/ContentPane';
export type { ContentPaneProps } from './content/ContentPane';
export { ContentNode } from './content/ContentNode';
export type { ContentNodeProps } from './content/ContentNode';

// --- core (pure, framework-free) ---
export { createTreeStore } from './core/treeStore';
export type { TreeStore, CreateTreeStoreOptions } from './core/treeStore';
export { createReadingOrder } from './core/traversal';
export type { ReadingOrder } from './core/traversal';
export { createContentCache } from './core/cache';
export type { ContentCache } from './core/cache';
export { sanitizeHtml } from './content/sanitize';
export { defaultTreeNode } from './tree/defaultTreeNode';

// --- public type contract ---
export type {
  BookNode,
  BookReaderProps,
  BookReaderClassNames,
  ReadingDirection,
  LoadChildren,
  LoadChildrenContext,
  TreeNodeState,
  RenderTreeNode,
  FetchContext,
  FetchContent,
  SanitizeOption,
  ContentStatus,
  ContentState,
  RenderContent,
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
