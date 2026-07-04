import { useCallback, useState } from 'react';
import type { TreeState, UseTreeStateOptions } from '../../types/hooks';

export type { TreeState, UseTreeStateOptions } from '../../types/hooks';

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
