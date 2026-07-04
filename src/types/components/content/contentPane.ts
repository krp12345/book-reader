import type {
  FetchContent,
  GetNextNode,
  GetPrevNode,
  RenderContent,
  RenderContentNode,
  RenderEmpty,
  RenderError,
  RenderLoading,
  RenderNoData,
  SanitizeOption,
  ScrollRequest,
} from '../../public';
import type { ContentCache } from '../../core/content/cache';
import type { TreeStore } from '../../core/tree/treeStore';

export interface ContentPaneProps<Meta = unknown, Content = string> {
  store: TreeStore<Meta>;
  fetchContent: FetchContent<Meta, Content>;
  sanitize?: SanitizeOption | undefined;
  cache?: ContentCache<Content> | undefined;
  overscan?: number | undefined;
  prefetchCount?: number | undefined;
  estimateHeight?: number | undefined;
  getNextNode?: GetNextNode<Meta> | undefined;
  getPrevNode?: GetPrevNode<Meta> | undefined;
  onActiveChange?: ((id: string, offset: number) => void) | undefined;
  /** Ensure a lazy node's children load when it enters the reading window. */
  ensureLazy?: ((id: string) => void) | undefined;
  scrollRequest?: ScrollRequest | undefined;
  renderContent?: RenderContent<Meta, Content> | undefined;
  renderContentNode?: RenderContentNode<Meta, Content> | undefined;
  renderLoading?: RenderLoading<Meta> | undefined;
  renderError?: RenderError<Meta> | undefined;
  renderEmpty?: RenderEmpty<Meta> | undefined;
  /** Book-level "no data / no results" panel (whole tree has nothing to show). */
  renderNoData?: RenderNoData | undefined;
  className?: string | undefined;
  contentNodeClassName?: string | undefined;
  'aria-label'?: string | undefined;
}
