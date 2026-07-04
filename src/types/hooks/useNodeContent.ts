import type {
  BookNode,
  ContentStatus,
  FetchContent,
  ReadingDirection,
  SanitizeOption,
} from '../public';
import type { ContentCache } from '../core/cache';

export interface UseNodeContentOptions<Meta = unknown, Content = string> {
  node: BookNode<Meta>;
  path: string[];
  fetchContent: FetchContent<Meta, Content>;
  direction?: ReadingDirection | undefined;
  sanitize?: SanitizeOption | undefined;
  cache?: ContentCache<Content> | undefined;
}

export interface NodeContent<Content = string> {
  status: ContentStatus;
  /** The resolved payload; `undefined` while loading / empty / errored. */
  content: Content | undefined;
  error: unknown;
  retry: () => void;
}

export interface InternalState<Content> {
  status: ContentStatus;
  content: Content | undefined;
  error: unknown;
}
