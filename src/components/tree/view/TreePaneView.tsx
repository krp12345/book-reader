import type { CSSProperties, JSX } from 'react';
import type { ExpandCollapseApi, TreeNodeState } from '../../../types';
import type { TreePaneViewProps } from '../../../types/components';
import { useTreePaneView } from '../../../hooks/tree/useTreePaneView';
import { cx } from '../../../utils/common/cx';
import { defaultTreeNode } from './defaultTreeNode';

export type { TreePaneViewProps } from '../../../types/components';

/**
 * The section tree. Purely presentational: row flattening and keyboard
 * navigation live in `hooks/tree/useTreePaneView.ts` — this component only renders
 * the rows.
 */
export function TreePaneView<Meta = unknown>(
  props: TreePaneViewProps<Meta>,
): JSX.Element {
  const {
    store,
    state,
    renderTreeNode,
    renderExpandCollapse,
    treeNodeClassName,
    onRetryLazy,
  } = props;
  const renderNode = renderTreeNode ?? defaultTreeNode;

  const { rows, activeId, registerRow, onKeyDown, onRowClick, onRowFocus } =
    useTreePaneView({ store, state });

  return (
    <div
      role="tree"
      className={cx('br-tree', props.className)}
      data-part="tree"
      aria-label={props['aria-label'] ?? 'Book sections'}
      onKeyDown={onKeyDown}
    >
      {rows.map((row) => {
        if (row.kind === 'lazy') {
          return (
            <div
              key={`${row.id}::lazy`}
              role="treeitem"
              aria-level={row.depth + 1}
              aria-disabled
              className="br-tree-node br-tree-node--lazy"
              data-part="tree-node-lazy"
              data-depth={row.depth}
              data-status={row.status}
              style={{ '--br-tree-depth': row.depth } as CSSProperties}
            >
              {row.status === 'loading' ? (
                <span className="br-tree-lazy__loading" data-part="tree-lazy-loading">
                  Loading…
                </span>
              ) : (
                <span className="br-tree-lazy__error" data-part="tree-lazy-error" role="alert">
                  Couldn’t load.
                  <button
                    type="button"
                    className="br-tree-lazy__retry"
                    data-part="tree-lazy-retry"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRetryLazy?.(row.id);
                    }}
                  >
                    Retry
                  </button>
                </span>
              )}
            </div>
          );
        }

        const node = store.getNode(row.id);
        if (!node) return null;

        const expandable = store.isExpandable(row.id);
        const expanded = state.expanded.has(row.id);
        const selected = state.selectedId === row.id;
        const nodeState: TreeNodeState = {
          depth: row.depth,
          expandable,
          expanded,
          selected,
        };

        return (
          <div
            key={row.id}
            ref={registerRow(row.id)}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-selected={selected}
            aria-expanded={expandable ? expanded : undefined}
            tabIndex={row.id === activeId ? 0 : -1}
            className={cx('br-tree-node', treeNodeClassName)}
            data-part="tree-node"
            data-depth={row.depth}
            data-selected={selected || undefined}
            // Depth is *data* (the skin turns it into indentation via
            // --reader-tree-indent); the bare component carries no inline indent.
            style={{ '--br-tree-depth': row.depth } as CSSProperties}
            onClick={() => onRowClick(row.id)}
            onFocus={() => onRowFocus(row.id)}
          >
            {renderExpandCollapse ? (
              renderExpandCollapse({
                expandable,
                expanded,
                depth: row.depth,
                toggle: () => state.toggle(row.id),
                expand: () => state.expand(row.id),
                collapse: () => state.collapse(row.id),
              } satisfies ExpandCollapseApi)
            ) : (
              <button
                type="button"
                className="br-tree-node__caret"
                data-part="tree-node-caret"
                data-expandable={expandable || undefined}
                aria-hidden="true"
                tabIndex={-1}
                onClick={(event) => {
                  event.stopPropagation();
                  state.toggle(row.id);
                }}
              >
                {expanded ? '▾' : '▸'}
              </button>
            )}
            {renderNode(node, nodeState)}
          </div>
        );
      })}
    </div>
  );
}
