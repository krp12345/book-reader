/**
 * Drives one node's content fetch lifecycle: loading → loaded / empty / error.
 *
 * Handles both fetcher shapes from §2.2:
 * - **sync** (`fetchContent` returns a string) settles immediately, with no
 *   loading flash;
 * - **async** (returns a Promise) shows `loading`, then settles or fails.
 *
 * Each fetch gets a fresh `AbortController`; switching nodes or retrying aborts
 * the previous one and ignores its late result, so a slow fetch can never clobber
 * a newer node's content. Sanitization runs here (toggle/override via `sanitize`)
 * before the HTML is exposed for render.
 *
 * When a {@link ContentCache} is supplied (M4) the hook reads through it: a
 * re-entered node whose sanitized HTML is still cached settles **synchronously**
 * (no loading flash, no re-fetch), and concurrent loads of the same node are
 * de-duplicated via `cache.dedupe`. The cache stores already-sanitized HTML.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ContentCache } from '../core/cache';
import type {
  BookNode,
  ContentStatus,
  FetchContext,
  FetchContent,
  ReadingDirection,
  SanitizeOption,
} from '../types';
import { resolveSanitizer } from './sanitize';

export interface UseNodeContentOptions<Meta = unknown> {
  node: BookNode<Meta>;
  /** Ancestor ids from root → parent, forwarded to the fetch context. */
  path: string[];
  fetchContent: FetchContent<Meta>;
  direction?: ReadingDirection | undefined;
  sanitize?: SanitizeOption | undefined;
  /** Shared content cache (sanitized HTML keyed by node id). */
  cache?: ContentCache<string> | undefined;
}

export interface NodeContent {
  status: ContentStatus;
  /** Sanitized HTML once `loaded`; an empty string otherwise. */
  html: string;
  /** The rejection reason when `status === 'error'`; otherwise undefined. */
  error: unknown;
  /** Re-run the fetch (e.g. from an error fallback). */
  retry: () => void;
}

interface InternalState {
  status: ContentStatus;
  html: string;
  error: unknown;
}

const LOADING: InternalState = { status: 'loading', html: '', error: undefined };

export function useNodeContent<Meta = unknown>(
  options: UseNodeContentOptions<Meta>,
): NodeContent {
  const { node, path, fetchContent, direction, sanitize, cache } = options;
  const [state, setState] = useState<InternalState>(LOADING);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const apply = resolveSanitizer(sanitize);

    // Settle from already-sanitized HTML (cache hit / dedup result).
    const settleHtml = (html: string): void => {
      if (!active) return;
      setState({
        status: html.trim() === '' ? 'empty' : 'loaded',
        html,
        error: undefined,
      });
    };

    const fail = (error: unknown): void => {
      if (!active || controller.signal.aborted) return;
      setState({ status: 'error', html: '', error });
    };

    // 1. Synchronous cache hit → settle without a loading flash or a re-fetch.
    //    On a retry (`attempt > 0`) skip the cache so the consumer can re-fetch.
    if (cache !== undefined && attempt === 0) {
      const cached = cache.get(node.id);
      if (cached !== undefined) {
        settleHtml(cached);
        return () => {
          active = false;
        };
      }
    }

    const ctx: FetchContext<Meta> = {
      node,
      path,
      direction: direction ?? 'forward',
      signal: controller.signal,
    };

    // 2. Already in flight (another consumer of the same node) → reuse it,
    //    never firing a second fetch.
    const inFlight = cache?.getInFlight(node.id);
    if (inFlight !== undefined) {
      setState((prev) => (prev.status === 'loading' ? prev : LOADING));
      inFlight.then(settleHtml, fail);
      return () => {
        active = false;
        controller.abort();
      };
    }

    // 3. Fresh fetch. Resolve sync-vs-async before committing so the sync path
    //    can settle flash-free.
    let result: string | Promise<string>;
    try {
      result = fetchContent(node, ctx);
    } catch (error) {
      fail(error);
      return () => {
        active = false;
        controller.abort();
      };
    }

    if (typeof result === 'string') {
      const html = apply(result);
      cache?.set(node.id, html);
      settleHtml(html); // sync path: settle without a loading flash
    } else {
      setState((prev) => (prev.status === 'loading' ? prev : LOADING));
      const sanitized = Promise.resolve(result).then(apply);
      // De-dup + cache via the store when present; otherwise just await it.
      const shared = cache
        ? cache.dedupe(node.id, () => sanitized)
        : sanitized;
      shared.then(settleHtml, fail);
    }

    return () => {
      active = false;
      controller.abort();
    };
    // `path` is derived from `node` and changes identity every render, so it is
    // intentionally excluded from deps; re-fetch keys on the node and `attempt`.
  }, [node, fetchContent, direction, sanitize, attempt, cache]);

  return { ...state, retry };
}
