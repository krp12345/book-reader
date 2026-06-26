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
 * Context handed to `loadChildren` when a lazy node is expanded. Carries what a
 * loader needs to resolve a node's children without walking back into the tree.
 */
export interface LoadChildrenContext<Meta = unknown> {
  /** The node being expanded. */
  node: BookNode<Meta>;
  /** Ancestor ids from root → parent (excludes `node.id`). */
  path: string[];
  /** Aborts when the load is no longer needed (node collapsed / unmounted). */
  signal: AbortSignal;
}

/** Lazily resolves a node's children (async tree strategy). */
export type LoadChildren<Meta = unknown> = (
  node: BookNode<Meta>,
  ctx: LoadChildrenContext<Meta>,
) => Promise<BookNode<Meta>[]>;

/** State the tree passes to a (default or custom) tree-node renderer. */
export interface TreeNodeState {
  /** Nesting depth; roots are 0. */
  depth: number;
  /** Whether the node can be expanded (has, or may lazily have, children). */
  expandable: boolean;
  /** Whether the node is currently expanded. */
  expanded: boolean;
  /** Whether the node is the selected one. */
  selected: boolean;
  /** Whether the node's children are currently being loaded (async). */
  loading: boolean;
}

/**
 * Renders the inner content of a tree row (the label, and any custom adornment).
 * The TreePane owns the row wrapper, indentation, expand affordance, and
 * keyboard/selection behavior; this controls what shows inside.
 */
export type RenderTreeNode<Meta = unknown> = (
  node: BookNode<Meta>,
  state: TreeNodeState,
) => import('react').ReactNode;

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

/**
 * Resolves a node's readable content (§2.2). May be sync or async; returns an
 * HTML string. Generic over `Meta` so fetchers see fully-typed nodes.
 */
export type FetchContent<Meta = unknown> = (
  node: BookNode<Meta>,
  ctx: FetchContext<Meta>,
) => string | Promise<string>;

/**
 * Sanitization control for fetched HTML:
 * - `true` (default) — run the built-in allowlist sanitizer before render.
 * - `false` — render as-is (consumer guarantees trusted HTML).
 * - function — plug in a custom sanitizer `(html) => safeHtml`.
 */
export type SanitizeOption = boolean | ((html: string) => string);

/** Lifecycle of a single node's content fetch. */
export type ContentStatus = 'loading' | 'loaded' | 'empty' | 'error';

/** State handed to a (default or custom) content renderer. */
export interface ContentState {
  status: ContentStatus;
  /** Sanitized HTML once `loaded`; an empty string in every other state. */
  html: string;
}

/** Renders a node's body once its (sanitized) HTML is available. */
export type RenderContent<Meta = unknown> = (
  node: BookNode<Meta>,
  html: string,
  state: ContentState,
) => import('react').ReactNode;

/** Renders the placeholder shown while a node's content is being fetched. */
export type RenderLoading<Meta = unknown> = (
  node: BookNode<Meta>,
) => import('react').ReactNode;

/** Renders the placeholder shown when a node resolves to no content. */
export type RenderEmpty<Meta = unknown> = (
  node: BookNode<Meta>,
) => import('react').ReactNode;

/** Renders the fallback shown when a fetch rejects; `retry` re-runs it. */
export type RenderError<Meta = unknown> = (
  node: BookNode<Meta>,
  error: unknown,
  retry: () => void,
) => import('react').ReactNode;

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

/**
 * Per-slot class names for styling without overriding renderers (§2.5 tier 2).
 * Each maps onto the same element exposed via its stable `data-part` hook.
 */
export interface BookReaderClassNames {
  /** The two-pane root wrapper. */
  root?: string | undefined;
  /** The tree (left/right) pane. */
  tree?: string | undefined;
  /** The scrollable content pane. */
  content?: string | undefined;
  /** A single content node wrapper within the content pane. */
  contentNode?: string | undefined;
}

/**
 * Props for `<BookReader>`. Only the props the component reads today are listed;
 * caching, virtualization, position and reading-order overrides land with their
 * milestones (M4–M6). Optional props admit `| undefined` so consumers can
 * forward maybe-undefined values under `exactOptionalPropertyTypes`.
 */
export interface BookReaderProps<Meta = unknown> {
  // --- data ---
  /** A single root, a forest of roots, or omitted for a fully-lazy tree. */
  tree?: BookNode<Meta> | BookNode<Meta>[] | undefined;
  /** Lazy children loader (async tree strategy); enables on-demand expansion. */
  loadChildren?: LoadChildren<Meta> | undefined;
  /** Resolves each node's readable HTML body. Required. */
  fetchContent: FetchContent<Meta>;

  /**
   * Bounded content-cache configuration (§3 layer 1). Sanitized HTML is cached
   * per node id so re-entering a node is a synchronous hit. Captured at mount;
   * omit to use the defaults (LRU by `maxChars`, ~5M characters).
   */
  cache?: CacheConfig<string> | undefined;

  /**
   * Bounded content-cache configuration's prefetch knob (§3.1): how many nodes
   * past the mounted window to keep pinned and warm ahead of view, so entering
   * them is a synchronous cache hit. Default `2`.
   */
  prefetchCount?: number | undefined;

  // --- view ---
  /** Which side the section tree sits on. Default `'left'`. */
  treeSide?: 'left' | 'right' | undefined;
  /** Width of the tree pane (number ⇒ px). Default `320`. */
  treeWidth?: number | string | undefined;
  /** HTML sanitization control. Default `true`. */
  sanitize?: SanitizeOption | undefined;
  /**
   * Extra content nodes mounted on each side of the viewport (virtualization
   * buffer). Larger values trade memory for fewer mounts while scrolling fast.
   * Default `2`.
   */
  overscan?: number | undefined;
  /**
   * Assumed height (px) for content nodes not yet measured. Tunes pre-measurement
   * scrollbar accuracy; the real height replaces it once a node is on screen.
   */
  estimateHeight?: number | undefined;

  // --- styling ---
  className?: string | undefined;
  classNames?: BookReaderClassNames | undefined;

  // --- custom renderers (each optional; sensible defaults ship) ---
  renderTreeNode?: RenderTreeNode<Meta> | undefined;
  renderContent?: RenderContent<Meta> | undefined;
  renderLoading?: RenderLoading<Meta> | undefined;
  renderError?: RenderError<Meta> | undefined;
  renderEmpty?: RenderEmpty<Meta> | undefined;

  'aria-label'?: string | undefined;
}
