import { useCallback, useState } from 'react';
import type { TreeStore } from '../core/treeStore';

export interface UseTreeStateOptions<Meta = unknown> {
  store: TreeStore<Meta>;
  selectedId?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
  /** Called when a node is expanded — used to trigger lazy child fetches. */
  onExpand?: ((id: string) => void) | undefined;
}

export interface TreeState {
  expanded: ReadonlySet<string>;
  selectedId: string | undefined;
  toggle(id: string): void;
  expand(id: string): void;
  collapse(id: string): void;
  select(id: string): void;
}

export function useTreeState<Meta = unknown>(
  options: UseTreeStateOptions<Meta>,
): TreeState {
  const {
    store,
    selectedId: controlledSelectedId,
    onSelect,
    onExpand,
  } = options;

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [internalSelected, setInternalSelected] = useState<string | undefined>(
    undefined,
  );

  const selectedId = controlledSelectedId ?? internalSelected;

  const expand = useCallback(
    (id: string): void => {
      if (!store.isExpandable(id)) return;
      // Opening a lazy branch is one of the two triggers that loads its children.
      onExpand?.(id);
      setExpanded((prev) => new Set(prev).add(id));
    },
    [store, onExpand],
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
    selectedId,
    toggle,
    expand,
    collapse,
    select,
  };
}
