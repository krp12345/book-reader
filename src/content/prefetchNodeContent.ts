import type { ContentCache } from '../core/cache';
import { resolveSanitizer } from './sanitize';
import type {
  BookNode,
  FetchContent,
  FetchContext,
  SanitizeOption,
} from '../types';

export interface PrefetchOptions<Meta = unknown> {
  node: BookNode<Meta>;
  path: string[];
  fetchContent: FetchContent<Meta>;
  sanitize?: SanitizeOption | undefined;
  cache: ContentCache<string>;
}

export function prefetchNodeContent<Meta = unknown>(
  options: PrefetchOptions<Meta>,
): void {
  const { node, path, fetchContent, sanitize, cache } = options;
  if (node.hasContent === false) return;
  if (cache.has(node.id) || cache.getInFlight(node.id) !== undefined) return;

  const apply = resolveSanitizer(sanitize);
  const ctx: FetchContext<Meta> = {
    node,
    path,
    direction: 'forward',
    signal: new AbortController().signal,
  };

  let result: string | Promise<string>;
  try {
    result = fetchContent(node, ctx);
  } catch {
    return;
  }

  if (typeof result === 'string') {
    cache.set(node.id, apply(result));
  } else {
    const sanitized = Promise.resolve(result).then(apply);
    cache.dedupe(node.id, () => sanitized).catch(() => undefined);
  }
}
