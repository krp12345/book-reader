import { useCallback, useEffect, useState } from 'react';
import type { FetchContext } from '../types';
import type {
  InternalState,
  NodeContent,
  UseNodeContentOptions,
} from '../types/hooks';
import { resolveContentSanitizer } from '../utils/sanitize';
import { isThenable } from '../utils/thenable';
import { isEmptyContent } from '../utils/content';

export type { NodeContent, UseNodeContentOptions } from '../types/hooks';

const LOADING: InternalState<never> = {
  status: 'loading',
  content: undefined,
  error: undefined,
};

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
    const sanitizeContent = resolveContentSanitizer(sanitize);

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
