import { useCallback, useEffect, useRef } from 'react';
import type { TreeStore } from '../core/treeStore';
import type { FetchChildren, FetchContext } from '../types';

export interface UseLazyChildren {
  /** Fire-and-forget: ensure a lazy node's children are loaded (dedup + retry). */
  ensure: (id: string) => void;
  /** Awaitable variant — resolves once the node's children are available. */
  ensureAsync: (id: string) => Promise<void>;
}

const MISSING_FETCHER = new Error(
  '<BookReader>: a node is marked `lazy` but no `fetchChildren` prop was provided.',
);

/**
 * Orchestrates on-demand fetching of `lazy` nodes' children. Owns the *how/when*
 * around the consumer's `fetchChildren`: dedupes concurrent triggers into one
 * fetch, drives the store's loading/error status, inserts resolved children, and
 * aborts in-flight fetches on unmount. The store stays the single source of
 * truth so both the tree pane and the reading surface reflect the same state.
 */
export function useLazyChildren<Meta = unknown>(
  store: TreeStore<Meta>,
  fetchChildren: FetchChildren<Meta> | undefined,
): UseLazyChildren {
  const promises = useRef(new Map<string, Promise<void>>());
  const controllers = useRef(new Map<string, AbortController>());

  // Abort everything still in flight when the reader unmounts.
  useEffect(() => {
    const live = controllers.current;
    return () => {
      for (const controller of live.values()) controller.abort();
      live.clear();
      promises.current.clear();
    };
  }, []);

  const ensureAsync = useCallback(
    (id: string): Promise<void> => {
      if (!store.isLazy(id) || store.getLazyStatus(id) === 'loaded') {
        return Promise.resolve();
      }
      const existing = promises.current.get(id);
      if (existing !== undefined) return existing;

      const node = store.getNode(id);
      if (node === undefined) return Promise.resolve();
      if (fetchChildren === undefined) {
        store.setLazyStatus(id, 'error', MISSING_FETCHER);
        return Promise.reject(MISSING_FETCHER);
      }

      const controller = new AbortController();
      controllers.current.set(id, controller);
      store.setLazyStatus(id, 'loading');

      const ctx: FetchContext<Meta> = {
        node,
        path: store.getPath(id),
        direction: 'forward',
        signal: controller.signal,
      };

      // An aborted fetch must leave the node re-triggerable: reset it to
      // 'unloaded' (not left stuck 'loading' with no in-flight promise, which the
      // scroll trigger — it only fires for 'unloaded' — would never pick up again;
      // this is what makes the scroll trigger survive a StrictMode double-mount).
      // Skip the reset if a newer fetch has since taken over this node.
      const resetIfAbandoned = (): void => {
        if (controllers.current.get(id) === undefined) {
          store.setLazyStatus(id, 'unloaded');
        }
      };

      const promise = Promise.resolve(fetchChildren(node, ctx))
        .then((children) => {
          if (controller.signal.aborted) {
            resetIfAbandoned();
            return;
          }
          store.setChildren(id, children ?? []);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) {
            resetIfAbandoned();
            return;
          }
          store.setLazyStatus(id, 'error', error);
          throw error;
        })
        .finally(() => {
          promises.current.delete(id);
          controllers.current.delete(id);
        });

      promises.current.set(id, promise);
      return promise;
    },
    [store, fetchChildren],
  );

  const ensure = useCallback(
    (id: string): void => {
      void ensureAsync(id).catch(() => {
        // Errors surface through the store's lazy status; swallow the rejection
        // so a fire-and-forget trigger never becomes an unhandled rejection.
      });
    },
    [ensureAsync],
  );

  return { ensure, ensureAsync };
}
