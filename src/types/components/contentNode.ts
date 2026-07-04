import type {
  BookNode,
  FetchContent,
  ReadingDirection,
  RenderContent,
  RenderContentNode,
  RenderEmpty,
  RenderError,
  RenderLoading,
  SanitizeOption,
} from '../public';
import type { ContentCache } from '../core/cache';

export interface ContentNodeProps<Meta = unknown, Content = string> {
  node: BookNode<Meta>;
  path: string[];
  fetchContent: FetchContent<Meta, Content>;
  direction?: ReadingDirection | undefined;
  sanitize?: SanitizeOption | undefined;
  cache?: ContentCache<Content> | undefined;
  renderContent?: RenderContent<Meta, Content> | undefined;
  renderContentNode?: RenderContentNode<Meta, Content> | undefined;
  renderLoading?: RenderLoading<Meta> | undefined;
  renderError?: RenderError<Meta> | undefined;
  renderEmpty?: RenderEmpty<Meta> | undefined;
  className?: string | undefined;
  measureRef?: ((el: HTMLElement | null) => void) | undefined;
}
