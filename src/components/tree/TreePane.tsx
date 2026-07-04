import type { JSX } from 'react';
import type { TreePaneProps } from '../../types/components';
import { useTreeState } from '../../hooks/tree/useTreeState';
import { TreePaneView } from './view/TreePaneView';

export type {
  TreePaneProps,
  TreePaneViewProps,
} from '../../types/components';
export { TreePaneView } from './view/TreePaneView';

/** Standalone tree pane: owns its own `useTreeState` and renders the view. */
export function TreePane<Meta = unknown>(
  props: TreePaneProps<Meta>,
): JSX.Element {
  const { store, selectedId, onSelect, renderTreeNode } = props;
  const state = useTreeState({ store, selectedId, onSelect });
  return (
    <TreePaneView
      store={store}
      state={state}
      renderTreeNode={renderTreeNode}
      renderExpandCollapse={props.renderExpandCollapse}
      className={props.className}
      treeNodeClassName={props.treeNodeClassName}
      aria-label={props['aria-label']}
    />
  );
}
