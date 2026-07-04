import type { BookNode, FetchContent, SanitizeOption } from '../../public';
import type { ContentCache } from '../../core/content/cache';

export interface PrefetchOptions<Meta = unknown, Content = string> {
  node: BookNode<Meta>;
  path: string[];
  fetchContent: FetchContent<Meta, Content>;
  sanitize?: SanitizeOption | undefined;
  cache: ContentCache<Content>;
}
