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
  path: string[];
  fetchContent: FetchContent<Meta>;
  direction?: ReadingDirection | undefined;
  sanitize?: SanitizeOption | undefined;
  cache?: ContentCache<string> | undefined;
}

export interface NodeContent {
  status: ContentStatus;
  html: string;
  error: unknown;
  retry: () => void;
}

interface InternalState {
  status: ContentStatus;
  html: string;
  error: unknown;
}

const LOADING: InternalState = {
  status: 'loading',
  html: '',
  error: undefined,
};

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

    if (cache !== undefined && attempt === 0) {
      const cached = cache.get(node.id);
      if (cached !== undefined) {
        settleHtml(cached);
        return () => {
          active = false;
        };
      }
    }

    if (cache !== undefined) {
      const { value, error, promise, release } = cache.load(
        node.id,
        (signal) => {
          const ctx: FetchContext<Meta> = {
            node,
            path,
            direction: direction ?? 'forward',
            signal,
          };
          const result = fetchContent(node, ctx);
          return typeof result === 'string'
            ? apply(result)
            : Promise.resolve(result).then(apply);
        },
      );
      if (error !== undefined) {
        fail(error);
      } else if (value !== undefined) {
        settleHtml(value);
      } else {
        setState((prev) => (prev.status === 'loading' ? prev : LOADING));
        promise.then(settleHtml, fail);
      }
      return () => {
        active = false;
        release();
      };
    }

    const ctx: FetchContext<Meta> = {
      node,
      path,
      direction: direction ?? 'forward',
      signal: controller.signal,
    };
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
      settleHtml(apply(result));
    } else {
      setState((prev) => (prev.status === 'loading' ? prev : LOADING));
      Promise.resolve(result).then(apply).then(settleHtml, fail);
    }

    return () => {
      active = false;
      controller.abort();
    };
  }, [node, fetchContent, direction, sanitize, attempt, cache]);

  return { ...state, retry };
}
