/**
 * Public type contract for book-reader.
 *
 * Design notes:
 * - `Meta` is a generic so consumers can attach arbitrary, *typed* data to nodes
 *   without us resorting to `any`.
 * - The tree can be supplied fully (sync) or lazily (`loadChildren`). A node that
 *   may have unloaded children sets `hasChildren: true` while `children` is
 *   undefined — this is how the store distinguishes "leaf" from "not yet loaded".
 */

/** A single section / subsection in the book tree. */
export interface BookNode<Meta = unknown> {
  /** Stable unique id. Required — it keys the tree store, cache, and height map. */
  id: string;
  /** Display label for the tree. */
  title: string;
  /**
   * Child nodes when known up front (sync trees, or already-loaded lazy nodes).
   * `undefined` means "not loaded" — consult `hasChildren` to know if loadable.
   */
  children?: BookNode<Meta>[];
  /**
   * For lazy trees: `true` marks the node as expandable before its children are
   * loaded. Ignored when `children` is present. Omit/false ⇒ treated as a leaf.
   */
  hasChildren?: boolean;
  /**
   * Whether this node has readable content to fetch. Defaults to `true`.
   * Set `false` for pure organizational branches with no body text.
   */
  hasContent?: boolean;
  /** Arbitrary consumer-defined, typed metadata. */
  meta?: Meta;
}

/** Direction the reader is moving through the book. */
export type ReadingDirection = 'forward' | 'backward';

/**
 * Context handed to `fetchContent` (and traversal overrides). Carries everything
 * a fetcher needs to resolve a node's body without reaching back into the tree.
 */
export interface FetchContext<Meta = unknown> {
  /** The node whose content is being fetched. */
  node: BookNode<Meta>;
  /** Ancestor ids from root → parent (excludes `node.id`). */
  path: string[];
  /** Why we're fetching: which way the reader is heading. */
  direction: ReadingDirection;
  /** Aborts when the fetch is no longer needed (node evicted / unmounted). */
  signal: AbortSignal;
}

/** Resolves a node id → its already-cached content, if present. */
export type CacheGetter<Content> = (id: string) => Content | undefined;

/**
 * Custom eviction policy. Receives current entries (LRU-ordered, oldest first)
 * and the configured budgets; returns the ids to evict. Pinned ids are never
 * passed in — the store filters them out before calling this.
 */
export interface EvictionInput<Content> {
  /** Evictable entries, least-recently-used first. */
  entries: ReadonlyArray<CacheEntry<Content>>;
  /** Current total of `entry.size` across evictable + pinned entries. */
  totalSize: number;
  config: ResolvedCacheConfig<Content>;
}

export type EvictFn<Content> = (input: EvictionInput<Content>) => string[];

/** One stored content entry. */
export interface CacheEntry<Content> {
  id: string;
  content: Content;
  /** Cost units for this entry (default: character length of stringified HTML). */
  size: number;
}

/** Caching configuration as accepted from consumers (all optional). */
export interface CacheConfig<Content = string> {
  /** Eviction budget by summed `size` (default: total characters). */
  maxChars?: number;
  /** Optional hard cap on number of entries. */
  maxNodes?: number;
  /** Override how an entry's `size` is measured. Default: string length. */
  sizeOf?: (content: Content) => number;
  /** Fully custom eviction policy (overrides the default LRU-by-size). */
  evict?: EvictFn<Content>;
}

/** Caching config after defaults are applied. */
export interface ResolvedCacheConfig<Content = string> {
  maxChars: number;
  maxNodes: number;
  sizeOf: (content: Content) => number;
  evict?: EvictFn<Content>;
}
