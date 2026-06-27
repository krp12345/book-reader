export interface BookNode<Meta = unknown> {
  id: string;
  title: string;
  children?: BookNode<Meta>[];
  hasChildren?: boolean;
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

export interface LoadChildrenContext<Meta = unknown> {
  node: BookNode<Meta>;
  path: string[];
  signal: AbortSignal;
}

export type LoadChildren<Meta = unknown> = (
  node: BookNode<Meta>,
  ctx: LoadChildrenContext<Meta>,
) => Promise<BookNode<Meta>[]>;

export interface TreeNodeState {
  depth: number;
  expandable: boolean;
  expanded: boolean;
  selected: boolean;
  loading: boolean;
}

export type RenderTreeNode<Meta = unknown> = (
  node: BookNode<Meta>,
  state: TreeNodeState,
) => import('react').ReactNode;

export interface FetchContext<Meta = unknown> {
  node: BookNode<Meta>;
  path: string[];
  direction: ReadingDirection;
  signal: AbortSignal;
}

export type FetchContent<Meta = unknown> = (
  node: BookNode<Meta>,
  ctx: FetchContext<Meta>,
) => string | Promise<string>;

export type SanitizeOption = boolean | ((html: string) => string);

export type ContentStatus = 'loading' | 'loaded' | 'empty' | 'error';

export interface ContentState {
  status: ContentStatus;
  html: string;
}

export type RenderContent<Meta = unknown> = (
  node: BookNode<Meta>,
  html: string,
  state: ContentState,
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
}

export interface BookReaderProps<Meta = unknown> {
  tree?: BookNode<Meta> | BookNode<Meta>[] | undefined;
  loadChildren?: LoadChildren<Meta> | undefined;
  fetchContent: FetchContent<Meta>;

  getNextNode?: GetNextNode<Meta> | undefined;
  getPrevNode?: GetPrevNode<Meta> | undefined;

  location?: BookLocation | undefined;
  defaultLocation?: BookLocation | undefined;
  onLocationChange?: ((location: BookLocation) => void) | undefined;

  cache?: CacheConfig<string> | undefined;

  prefetchCount?: number | undefined;

  treeSide?: 'left' | 'right' | undefined;
  treeWidth?: number | string | undefined;
  sanitize?: SanitizeOption | undefined;
  overscan?: number | undefined;
  estimateHeight?: number | undefined;

  className?: string | undefined;
  classNames?: BookReaderClassNames | undefined;

  renderTreeNode?: RenderTreeNode<Meta> | undefined;
  renderContent?: RenderContent<Meta> | undefined;
  renderLoading?: RenderLoading<Meta> | undefined;
  renderError?: RenderError<Meta> | undefined;
  renderEmpty?: RenderEmpty<Meta> | undefined;

  'aria-label'?: string | undefined;
}
