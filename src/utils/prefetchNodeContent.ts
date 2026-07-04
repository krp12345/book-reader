import type { ContentCache } from '../core/cache';
import { resolveContentSanitizer } from './sanitize';
import { isThenable } from './thenable';
import type {
  BookNode,
  FetchContent,
  FetchContext,
  SanitizeOption,
} from '../types';

export interface PrefetchOptions<Meta = unknown, Content = string> {
  node: BookNode<Meta>;
  path: string[];
  fetchContent: FetchContent<Meta, Content>;
  sanitize?: SanitizeOption | undefined;
  cache: ContentCache<Content>;
}

export function prefetchNodeContent<Meta = unknown, Content = string>(
  options: PrefetchOptions<Meta, Content>,
): void {
  const { node, path, fetchContent, sanitize, cache } = options;
  if (node.hasContent === false) return;
  if (cache.has(node.id) || cache.getInFlight(node.id) !== undefined) return;

  const sanitizeContent = resolveContentSanitizer(sanitize);

  const ctx: FetchContext<Meta> = {
    node,
    path,
    direction: 'forward',
    signal: new AbortController().signal,
  };

  let result: Content | Promise<Content>;
  try {
    result = fetchContent(node, ctx);
  } catch {
    return;
  }

  if (isThenable(result)) {
    const settled = Promise.resolve(result).then(sanitizeContent);
    cache.dedupe(node.id, () => settled).catch(() => undefined);
  } else {
    cache.set(node.id, sanitizeContent(result));
  }
}
