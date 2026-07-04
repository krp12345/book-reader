import type { BookNode } from './node';
import type { BookLocation, GetNextNode, GetPrevNode } from './reading';
import type { FetchChildren, FetchContent, FetchPath } from './fetching';
import type { ResetFn, RenderSearch, SearchFn } from './search';
import type {
  RenderExpandCollapse,
  RenderTreeNode,
  RenderTreeOverlay,
  RenderTreeToggle,
} from './tree';
import type {
  RenderContent,
  RenderContentNode,
  RenderEmpty,
  RenderError,
  RenderLoading,
  RenderNoData,
  SanitizeOption,
} from './content';
import type { CacheConfig } from './cache';

export interface BookReaderClassNames {
  root?: string | undefined;
  tree?: string | undefined;
  treeNode?: string | undefined;
  content?: string | undefined;
  contentNode?: string | undefined;
  treeToggle?: string | undefined;
  treeOverlay?: string | undefined;
  search?: string | undefined;
}

export interface BookReaderProps<Meta = unknown, Content = string> {
  tree?: BookNode<Meta> | BookNode<Meta>[] | undefined;
  fetchContent: FetchContent<Meta, Content>;

  /**
   * Resolves the children of `lazy` nodes on demand (tree expand or scroll).
   * Required only if the tree contains `lazy` nodes; a lazy node opened with no
   * `fetchChildren` configured shows an error state.
   */
  fetchChildren?: FetchChildren<Meta> | undefined;

  /**
   * Resolves the ancestor path of a deep-link target that lives inside an
   * unfetched `lazy` branch (see {@link FetchPath}). Enables `location` /
   * `defaultLocation` to point at sections not yet loaded into the tree. Only
   * needed alongside `lazy` nodes; a per-location `BookLocation.path` takes
   * precedence over this prop.
   */
  fetchPath?: FetchPath | undefined;

  /** Show the tree search box (top of the tree pane). Default `false`. */
  showSearch?: boolean | undefined;
  /**
   * Runs when the user submits the search box (Enter / Search button). Returns a
   * whole new tree that replaces the book; the reader resets to the first page.
   */
  onSearch?: SearchFn<Meta> | undefined;
  /**
   * Runs when the user clicks Reset. Returns the tree to restore (typically the
   * original book). When omitted, the Reset control is hidden.
   */
  onReset?: ResetFn<Meta> | undefined;
  /** Placeholder text for the default search input. Default `'Search…'`. */
  searchPlaceholder?: string | undefined;
  /** Replaces the default search box UI (input + Search/Reset buttons). */
  renderSearch?: RenderSearch | undefined;

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
  /**
   * Replaces the built-in book-level "no data / no results" panel (see
   * {@link RenderNoData}). The default is a simple styled message
   * ("Nothing to show here.") with `data-part="content-nodata"` skin hooks.
   */
  renderNoData?: RenderNoData | undefined;

  'aria-label'?: string | undefined;
}
