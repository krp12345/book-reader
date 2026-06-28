export interface BookNode<Meta = unknown> {
  id: string;
  title: string;
  children?: BookNode<Meta>[];
  hasContent?: boolean;
  meta?: Meta;
}

export type ReadingDirection = 'forward' | 'backward';

export interface ReadingOrderContext<Meta = unknown> {
  node: BookNode<Meta>;
  path: string[];
  direction: ReadingDirection;
}

export type GetNextNode<Meta = unknown> = (
  node: BookNode<Meta>,
  ctx: ReadingOrderContext<Meta>,
) => BookNode<Meta> | null;

export type GetPrevNode<Meta = unknown> = (
  node: BookNode<Meta>,
  ctx: ReadingOrderContext<Meta>,
) => BookNode<Meta> | null;

export interface BookLocation {
  nodeId: string;
  offset?: number | undefined;
}

export interface TreeNodeState {
  depth: number;
  expandable: boolean;
  expanded: boolean;
  selected: boolean;
}

export type RenderTreeNode<Meta = unknown> = (
  node: BookNode<Meta>,
  state: TreeNodeState,
) => import('react').ReactNode;

/**
 * The control surface handed to `renderExpandCollapse`. Lets a custom
 * disclosure control (chevron, +/− button, twisty, …) drive a row's
 * expand/collapse state. The library still owns the row wrapper,
 * `aria-expanded`, and keyboard nav — the custom control is presentation +
 * the click handler only.
 */
export interface ExpandCollapseApi {
  /** Whether this row has children. */
  expandable: boolean;
  /** Whether this row is currently expanded. */
  expanded: boolean;
  /** This row's depth in the tree (0 = root). */
  depth: number;
  /** Toggle this row open/closed. */
  toggle(): void;
  /** Expand this row. */
  expand(): void;
  /** Collapse this row. */
  collapse(): void;
}

/**
 * Replaces *only* the hard-coded disclosure caret in a tree row. The library
 * keeps `data-part="tree-node-caret"` as the no-JS CSS hook for the default
 * caret; a custom control owns its own markup and wires its `onClick` to the
 * `toggle`/`expand`/`collapse` it receives (call `stopPropagation` to avoid
 * also selecting the row).
 */
export type RenderExpandCollapse = (
  api: ExpandCollapseApi,
) => import('react').ReactNode;

export interface FetchContext<Meta = unknown> {
  node: BookNode<Meta>;
  path: string[];
  direction: ReadingDirection;
  signal: AbortSignal;
}

/**
 * Resolves a node's section content. Returns sanitized HTML `string` by default,
 * but may be parameterized with a generic `Content` payload (any object) for
 * consumers that render structured data via `renderContent`. The `string` path
 * is sanitized (see `sanitize`); object payloads are passed through untouched.
 */
export type FetchContent<Meta = unknown, Content = string> = (
  node: BookNode<Meta>,
  ctx: FetchContext<Meta>,
) => Content | Promise<Content>;

export type SanitizeOption = boolean | ((html: string) => string);

export type ContentStatus = 'loading' | 'loaded' | 'empty' | 'error';

export interface ContentState<Content = string> {
  status: ContentStatus;
  /** The resolved payload (sanitized HTML string by default, or any object). */
  content: Content;
}

export type RenderContent<Meta = unknown, Content = string> = (
  node: BookNode<Meta>,
  content: Content,
  state: ContentState<Content>,
) => import('react').ReactNode;

/**
 * The wrapper props the library would otherwise spread onto its default
 * `<article>` content-node element. A `renderContentNode` consumer **must**
 * spread these onto whatever element they choose so virtualization keeps
 * working: `ref` is the measurement ref the height map depends on, and the
 * `data-part`/`data-node-id`/`data-status` hooks keep the default skin + active
 * tracking intact.
 */
export interface ContentNodeWrapperProps {
  ref: (el: HTMLElement | null) => void;
  className: string;
  'data-part': 'content-node';
  'data-node-id': string;
  'data-status': ContentStatus;
  'aria-busy': true | undefined;
}

/**
 * The control surface handed to `renderContentNode`. `children` is the rendered
 * body (the same output `renderContent`/the default renderers produce for the
 * current `state.status`); `wrapperProps` must be spread onto your wrapper
 * element. Unlike `renderContent` (which replaces only the *inner* body), this
 * lets a consumer own the wrapper element itself — tag, classes, attrs,
 * handlers.
 */
export interface ContentNodeApi<Meta = unknown, Content = string> {
  node: BookNode<Meta>;
  state: ContentState<Content>;
  wrapperProps: ContentNodeWrapperProps;
  children: import('react').ReactNode;
}

export type RenderContentNode<Meta = unknown, Content = string> = (
  api: ContentNodeApi<Meta, Content>,
) => import('react').ReactNode;

export type RenderLoading<Meta = unknown> = (
  node: BookNode<Meta>,
) => import('react').ReactNode;

export type RenderEmpty<Meta = unknown> = (
  node: BookNode<Meta>,
) => import('react').ReactNode;

export type RenderError<Meta = unknown> = (
  node: BookNode<Meta>,
  error: unknown,
  retry: () => void,
) => import('react').ReactNode;

export type CacheGetter<Content> = (id: string) => Content | undefined;

export interface EvictionInput<Content> {
  entries: ReadonlyArray<CacheEntry<Content>>;
  totalSize: number;
  config: ResolvedCacheConfig<Content>;
}

export type EvictFn<Content> = (input: EvictionInput<Content>) => string[];

export interface CacheEntry<Content> {
  id: string;
  content: Content;
  size: number;
}

export interface CacheConfig<Content = string> {
  maxChars?: number;
  maxNodes?: number;
  sizeOf?: (content: Content) => number;
  evict?: EvictFn<Content>;
}

export interface ResolvedCacheConfig<Content = string> {
  maxChars: number;
  maxNodes: number;
  sizeOf: (content: Content) => number;
  evict?: EvictFn<Content>;
}

export interface BookReaderClassNames {
  root?: string | undefined;
  tree?: string | undefined;
  treeNode?: string | undefined;
  content?: string | undefined;
  contentNode?: string | undefined;
  treeToggle?: string | undefined;
  treeOverlay?: string | undefined;
}

/**
 * The control surface handed to `renderTreeToggle`. Lets a custom collapsed
 * trigger drive the floated tree overlay open/closed.
 */
export interface TreeToggleApi {
  /** Whether the tree overlay is currently open. */
  isOpen: boolean;
  /** Open the tree overlay (a new stacking context). */
  open: () => void;
  /** Close the tree overlay. */
  close: () => void;
  /** Toggle the tree overlay open/closed. */
  toggle: () => void;
  /** The configured `treeCollapseLabel`. */
  label: string;
}

export type RenderTreeToggle = (
  api: TreeToggleApi,
) => import('react').ReactNode;

/**
 * The control surface handed to `renderTreeOverlay`. `children` is the fully
 * wired TreePane (same selection/expansion state as the main tree); the custom
 * container owns its own size/position/stacking and calls `close()` to dismiss.
 */
export interface TreeOverlayApi {
  /** Close the overlay. */
  close: () => void;
  /** The wired tree to render inside your container. */
  children: import('react').ReactNode;
}

export type RenderTreeOverlay = (
  api: TreeOverlayApi,
) => import('react').ReactNode;

export interface BookReaderProps<Meta = unknown, Content = string> {
  tree?: BookNode<Meta> | BookNode<Meta>[] | undefined;
  fetchContent: FetchContent<Meta, Content>;

  getNextNode?: GetNextNode<Meta> | undefined;
  getPrevNode?: GetPrevNode<Meta> | undefined;

  location?: BookLocation | undefined;
  defaultLocation?: BookLocation | undefined;
  onLocationChange?: ((location: BookLocation) => void) | undefined;

  cache?: CacheConfig<Content> | undefined;

  prefetchCount?: number | undefined;

  treeSide?: 'left' | 'right' | undefined;
  treeWidth?: number | string | undefined;

  /**
   * Reading-surface floor. When the reader is too narrow to fit both the tree
   * and this minimum content width, the tree collapses first (reading width
   * wins). Accepts px (number) or any CSS length string ('28rem', '420px').
   * Default `360`.
   */
  contentMinWidth?: number | string | undefined;
  /**
   * Selects the tree-collapse mode (mutually exclusive). The collapsed UI (the
   * toggle button + popover) and every customization hook
   * (`renderTreeToggle`/`renderTreeOverlay`/`treeCollapseLabel`/`classNames`)
   * are identical across modes — only the *trigger* differs.
   *  - `'auto'` (default): collapse only when width can't fit tree + content min.
   *  - `'always'`: always collapsed (tree lives in the overlay) at any width.
   *  - `'never'`: never collapse (classic two-pane layout).
   *
   * Booleans are accepted for back-compat: `true` ⇒ `'always'`, `false` ⇒
   * `'never'`.
   */
  collapseTree?: 'auto' | 'always' | 'never' | boolean | undefined;
  /** Text for the default collapsed toggle button. Default `'Contents'`. */
  treeCollapseLabel?: string | undefined;
  /**
   * Minimum width of the default floated tree container (the popover the toggle
   * opens), so it never collapses to an unreadably narrow column on small
   * viewports. Accepts px (number) or any CSS length string. Default `240`.
   * Ignored when `renderTreeOverlay` supplies a custom container.
   */
  treeOverlayMinWidth?: number | string | undefined;
  /**
   * Minimum height of the default floated tree container, so a short tree (or a
   * cramped viewport) still opens to a usable panel. Accepts px (number) or any
   * CSS length string. Default `200`. Capped by the popover's `max-height: 70vh`.
   * Ignored when `renderTreeOverlay` supplies a custom container.
   */
  treeOverlayMinHeight?: number | string | undefined;
  /** Custom collapsed trigger, replacing the default button. */
  renderTreeToggle?: RenderTreeToggle | undefined;
  /**
   * Custom container for the floated tree when collapsed. Receives the wired
   * tree as `children` and a `close()`. Default renders the tree in a built-in
   * portal drawer (a new stacking context).
   */
  renderTreeOverlay?: RenderTreeOverlay | undefined;

  sanitize?: SanitizeOption | undefined;
  overscan?: number | undefined;
  estimateHeight?: number | undefined;

  className?: string | undefined;
  classNames?: BookReaderClassNames | undefined;

  renderTreeNode?: RenderTreeNode<Meta> | undefined;
  /** Replaces the hard-coded disclosure caret in each tree row. */
  renderExpandCollapse?: RenderExpandCollapse | undefined;
  renderContent?: RenderContent<Meta, Content> | undefined;
  /**
   * Owns the per-node content *wrapper* element (tag/classes/attrs). Receives
   * the rendered body as `children` and the props to spread as `wrapperProps`
   * (spread them, including `ref`, or virtualization breaks). `renderContent`
   * (inner body) and `renderContentNode` (wrapper) compose.
   */
  renderContentNode?: RenderContentNode<Meta, Content> | undefined;
  renderLoading?: RenderLoading<Meta> | undefined;
  renderError?: RenderError<Meta> | undefined;
  renderEmpty?: RenderEmpty<Meta> | undefined;

  'aria-label'?: string | undefined;
}
