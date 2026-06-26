/**
 * Warm a node's content into the cache *before* it scrolls into view (§3.1
 * prefetch-ahead), so entering it is a synchronous cache hit with no loading
 * flash. Mirrors {@link useNodeContent}'s fetch+sanitize+cache pipeline but
 * touches no React state — it only populates the cache.
 *
 * No-ops when the node is already cached or already in flight (in-flight dedup),
 * so calling it every window change is cheap. Sync fetchers settle into the cache
 * immediately; async ones route through `cache.dedupe` so a real fetch and a
 * prefetch of the same node share one promise. Failures are swallowed — a prefetch
 * miss is harmless; the node re-fetches (and surfaces its error) when it mounts.
 */
import type { ContentCache } from '../core/cache';
import { resolveSanitizer } from './sanitize';
import type { BookNode, FetchContent, FetchContext, SanitizeOption } from '../types';

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
  // Skip pure-organizational nodes and anything already warm or loading.
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
    return; // a failed prefetch is harmless; the node will retry when it mounts
  }

  if (typeof result === 'string') {
    cache.set(node.id, apply(result));
  } else {
    const sanitized = Promise.resolve(result).then(apply);
    // dedupe caches on resolve; swallow rejection so it doesn't go unhandled.
    cache.dedupe(node.id, () => sanitized).catch(() => undefined);
  }
}
