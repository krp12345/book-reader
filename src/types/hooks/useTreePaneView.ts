import type { KeyboardEvent } from 'react';
import type { VisibleRow } from '../../core/tree/flatten';
import type { TreeStore } from '../core/treeStore';
import type { TreeState } from './useTreeState';

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
