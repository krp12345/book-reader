import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { TreeStore } from '../core/treeStore';
import { flattenVisible, type VisibleRow } from '../core/flatten';
import type { TreeState } from './useTreeState';
import { useStoreVersion } from './useStoreVersion';

export interface UseTreePaneViewOptions<Meta = unknown> {
  store: TreeStore<Meta>;
  state: TreeState;
}

export interface TreePaneViewState {
  /** The visible rows (real nodes + synthetic lazy status rows), in order. */
  rows: VisibleRow[];
  /** The row carrying `tabIndex=0` (roving focus). */
  activeId: string | undefined;
  /** Ref callback registering a row element for keyboard focus moves. */
  registerRow: (id: string) => (el: HTMLDivElement | null) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  /** Click: focus the row and select it. */
  onRowClick: (id: string) => void;
  /** Focus (e.g. tabbing in): track the row as the roving-focus target. */
  onRowFocus: (id: string) => void;
}

/**
 * All of `TreePaneView`'s behavior: flattening the visible rows (recomputed
 * when lazy children load / the tree is replaced) and the roving-focus
 * keyboard navigation. The component only renders rows.
 */
export function useTreePaneView<Meta = unknown>(
  options: UseTreePaneViewOptions<Meta>,
): TreePaneViewState {
  const { store, state } = options;

  // Recompute visible rows when lazy children load / the tree is replaced.
  const version = useStoreVersion(store);
  const rows = useMemo(
    () => flattenVisible(store, state.expanded),
    [store, state.expanded, version],
  );
  // Only real nodes are keyboard-navigable (lazy status rows are not focusable).
  const navRows = useMemo(() => rows.filter((r) => r.kind === 'node'), [rows]);

  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [focusId, setFocusId] = useState<string | undefined>(undefined);

  const activeId = navRows.some((r) => r.id === focusId)
    ? focusId
    : navRows[0]?.id;

  function moveTo(index: number): void {
    const target = navRows[index];
    if (!target) return;
    setFocusId(target.id);
    rowRefs.current.get(target.id)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const index = Math.max(
      0,
      navRows.findIndex((r) => r.id === activeId),
    );
    const current = navRows[index];
    if (!current) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveTo(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveTo(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        moveTo(0);
        break;
      case 'End':
        event.preventDefault();
        moveTo(navRows.length - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (store.isExpandable(current.id)) {
          if (state.expanded.has(current.id)) moveTo(index + 1);
          else state.expand(current.id);
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (store.isExpandable(current.id) && state.expanded.has(current.id)) {
          state.collapse(current.id);
        } else {
          const parentId = store.getParentId(current.id);
          if (parentId !== undefined) {
            moveTo(navRows.findIndex((r) => r.id === parentId));
          }
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        state.select(current.id);
        break;
      default:
        break;
    }
  }

  const registerRow =
    (id: string) =>
    (el: HTMLDivElement | null): void => {
      if (el) rowRefs.current.set(id, el);
      else rowRefs.current.delete(id);
    };

  const onRowClick = (id: string): void => {
    setFocusId(id);
    state.select(id);
  };

  return {
    rows,
    activeId,
    registerRow,
    onKeyDown,
    onRowClick,
    onRowFocus: setFocusId,
  };
}
