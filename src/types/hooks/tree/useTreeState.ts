import type { TreeStore } from '../../core/tree/treeStore';

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
