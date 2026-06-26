/**
 * Default renderer for a tree row's inner content: the node title, plus a small
 * loading hint while its children are being fetched. The TreePane supplies the
 * row wrapper, indentation, and expand caret around this. Consumers override via
 * the `renderTreeNode` prop.
 */
import type { ReactNode } from 'react';
import type { BookNode, TreeNodeState } from '../types';

export function defaultTreeNode<Meta = unknown>(
  node: BookNode<Meta>,
  state: TreeNodeState,
): ReactNode {
  return (
    <span className="br-tree-node__label" data-part="tree-node-label">
      {node.title}
      {state.loading ? (
        <span
          className="br-tree-node__spinner"
          data-part="tree-node-spinner"
          aria-hidden="true"
        >
          …
        </span>
      ) : null}
    </span>
  );
}
