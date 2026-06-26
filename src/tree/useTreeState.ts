/**
 * React state for the tree pane: which nodes are expanded, which is selected,
 * and the lazy-loading lifecycle for async children.
 *
 * The {@link TreeStore} is mutable (its `setChildren` writes into internal maps),
 * so React can't observe lazy loads on its own. This hook bumps a `version`
 * counter after each `setChildren`, which callers fold into their memo deps to
 * recompute the visible rows. In-flight loads are de-duplicated per node id.
 */
import { useCallback, useRef, useState } from 'react';
import type { TreeStore } from '../core/treeStore';
import type { LoadChildren } from '../types';

export interface UseTreeStateOptions<Meta = unknown> {
  store: TreeStore<Meta>;
  // `| undefined` (vs. plain optional) so the TreePane can forward its own
  // possibly-undefined props under `exactOptionalPropertyTypes`.
  loadChildren?: LoadChildren<Meta> | undefined;
  /** Controlled selected id. When provided, selection is driven by the parent. */
  selectedId?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
}

export interface TreeState {
  expanded: ReadonlySet<string>;
  loadingIds: ReadonlySet<string>;
  selectedId: string | undefined;
  /** Increments whenever lazily-loaded children are absorbed into the store. */
  version: number;
  toggle(id: string): void;
  expand(id: string): void;
  collapse(id: string): void;
  select(id: string): void;
}

export function useTreeState<Meta = unknown>(
  options: UseTreeStateOptions<Meta>,
): TreeState {
  const { store, loadChildren, selectedId: controlledSelectedId, onSelect } =
    options;

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [loadingIds, setLoadingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [version, setVersion] = useState(0);
  const [internalSelected, setInternalSelected] = useState<string | undefined>(
    undefined,
  );
  const inflight = useRef(new Map<string, Promise<void>>());

  const selectedId = controlledSelectedId ?? internalSelected;

  /** Kick off (or join) a lazy load for `id` if its children aren't known. */
  const ensureLoaded = useCallback(
    (id: string): void => {
      if (store.isLoaded(id) || !loadChildren) return;
      if (inflight.current.has(id)) return;
      const node = store.getNode(id);
      if (!node) return;

      const controller = new AbortController();
      setLoadingIds((prev) => new Set(prev).add(id));

      const promise = Promise.resolve(
        loadChildren(node, {
          node,
          path: store.getPath(id),
          signal: controller.signal,
        }),
      )
        .then((children) => {
          store.setChildren(id, children);
          setVersion((v) => v + 1);
        })
        .finally(() => {
          inflight.current.delete(id);
          setLoadingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        });

      inflight.current.set(id, promise);
    },
    [store, loadChildren],
  );

  const expand = useCallback(
    (id: string): void => {
      if (!store.isExpandable(id)) return;
      ensureLoaded(id);
      setExpanded((prev) => new Set(prev).add(id));
    },
    [store, ensureLoaded],
  );

  const collapse = useCallback((id: string): void => {
    setExpanded((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggle = useCallback(
    (id: string): void => {
      if (expanded.has(id)) collapse(id);
      else expand(id);
    },
    [expanded, collapse, expand],
  );

  const select = useCallback(
    (id: string): void => {
      if (controlledSelectedId === undefined) setInternalSelected(id);
      onSelect?.(id);
    },
    [controlledSelectedId, onSelect],
  );

  return {
    expanded,
    loadingIds,
    selectedId,
    version,
    toggle,
    expand,
    collapse,
    select,
  };
}
