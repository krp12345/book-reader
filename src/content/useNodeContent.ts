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

interface InternalState<Content> {
  status: ContentStatus;
  content: Content | undefined;
  error: unknown;
}

const LOADING: InternalState<never> = {
  status: 'loading',
  content: undefined,
  error: undefined,
};

const isThenable = <T>(value: T | Promise<T>): value is Promise<T> =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { then?: unknown }).then === 'function';

/** A string payload is "empty" when blank; a nullish payload is always empty. */
const isEmptyContent = (content: unknown): boolean =>
  content == null ||
  (typeof content === 'string' && content.trim() === '');

export function useNodeContent<Meta = unknown, Content = string>(
  options: UseNodeContentOptions<Meta, Content>,
): NodeContent<Content> {
  const { node, path, fetchContent, direction, sanitize, cache } = options;
  const [state, setState] = useState<InternalState<Content>>(LOADING);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const applyHtml = resolveSanitizer(sanitize);
    // Sanitization is a string-only concern; object payloads pass through.
    const sanitizeContent = (content: Content): Content =>
      typeof content === 'string' ? (applyHtml(content) as Content) : content;

    const settle = (content: Content): void => {
      if (!active) return;
      setState({
        status: isEmptyContent(content) ? 'empty' : 'loaded',
        content,
        error: undefined,
      });
    };

    const fail = (error: unknown): void => {
      if (!active || controller.signal.aborted) return;
      setState({ status: 'error', content: undefined, error });
    };

    if (cache !== undefined && attempt === 0) {
      const cached = cache.get(node.id);
      if (cached !== undefined) {
        settle(cached);
        return () => {
          active = false;
        };
      }
    }

    const produce = (
      signal: AbortSignal,
    ): Content | Promise<Content> => {
      const ctx: FetchContext<Meta> = {
        node,
        path,
        direction: direction ?? 'forward',
        signal,
      };
      const result = fetchContent(node, ctx);
      return isThenable(result)
        ? Promise.resolve(result).then(sanitizeContent)
        : sanitizeContent(result);
    };

    if (cache !== undefined) {
      const { value, error, promise, release } = cache.load(node.id, produce);
      if (error !== undefined) {
        fail(error);
      } else if (value !== undefined) {
        settle(value);
      } else {
        setState((prev) => (prev.status === 'loading' ? prev : LOADING));
        promise.then(settle, fail);
      }
      return () => {
        active = false;
        release();
      };
    }

    let result: Content | Promise<Content>;
    try {
      result = produce(controller.signal);
    } catch (error) {
      fail(error);
      return () => {
        active = false;
        controller.abort();
      };
    }

    if (isThenable(result)) {
      setState((prev) => (prev.status === 'loading' ? prev : LOADING));
      result.then(settle, fail);
    } else {
      settle(result);
    }

    return () => {
      active = false;
      controller.abort();
    };
  }, [node, fetchContent, direction, sanitize, attempt, cache]);

  return { ...state, retry };
}
