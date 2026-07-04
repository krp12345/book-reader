import type { ReactNode } from 'react';
import type { BookNode, TreeNodeState } from '../../../types';

export function defaultTreeNode<Meta = unknown>(
  node: BookNode<Meta>,
  _state: TreeNodeState,
): ReactNode {
  return (
    <span className="br-tree-node__label" data-part="tree-node-label">
      {node.title}
    </span>
  );
}
