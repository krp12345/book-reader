import type {
  RenderExpandCollapse,
  RenderTreeNode,
} from '../public';
import type { TreeStore } from '../core/treeStore';
import type { TreeState } from '../hooks/useTreeState';

export interface TreePaneProps<Meta = unknown> {
  store: TreeStore<Meta>;
  selectedId?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
  renderTreeNode?: RenderTreeNode<Meta> | undefined;
  renderExpandCollapse?: RenderExpandCollapse | undefined;
  className?: string | undefined;
  treeNodeClassName?: string | undefined;
  'aria-label'?: string | undefined;
}

export interface TreePaneViewProps<Meta = unknown> {
  store: TreeStore<Meta>;
  state: TreeState;
  renderTreeNode?: RenderTreeNode<Meta> | undefined;
  renderExpandCollapse?: RenderExpandCollapse | undefined;
  /** Retry a failed lazy child fetch (from the placeholder row's Retry button). */
  onRetryLazy?: ((id: string) => void) | undefined;
  className?: string | undefined;
  treeNodeClassName?: string | undefined;
  'aria-label'?: string | undefined;
}
