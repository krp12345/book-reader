import { useCallback, useRef, useState } from 'react';
import type { TreeStore } from '../core/treeStore';
import type { LoadChildren } from '../types';

export interface UseTreeStateOptions<Meta = unknown> {
  store: TreeStore<Meta>;
  loadChildren?: LoadChildren<Meta> | undefined;
  selectedId?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
}

export interface TreeState {
  expanded: ReadonlySet<string>;
  loadingIds: ReadonlySet<string>;
  selectedId: string | undefined;
  version: number;
  toggle(id: string): void;
  expand(id: string): void;
  collapse(id: string): void;
  select(id: string): void;
  load(id: string): void;
}

export function useTreeState<Meta = unknown>(
  options: UseTreeStateOptions<Meta>,
): TreeState {
  const {
    store,
    loadChildren,
    selectedId: controlledSelectedId,
    onSelect,
  } = options;

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [loadingIds, setLoadingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [version, setVersion] = useState(0);
  const [internalSelected, setInternalSelected] = useState<string | undefined>(
    undefined,
  );
  const inflight = useRef(new Map<string, Promise<void>>());

  const selectedId = controlledSelectedId ?? internalSelected;

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
    load: ensureLoaded,
  };
}
