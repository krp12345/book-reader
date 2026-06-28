import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import type { TreeStore } from '../core/treeStore';
import type {
  ExpandCollapseApi,
  LoadChildren,
  RenderExpandCollapse,
  RenderTreeNode,
  TreeNodeState,
} from '../types';
import { flattenVisible } from './flatten';
import { useTreeState, type TreeState } from './useTreeState';
import { defaultTreeNode } from './defaultTreeNode';

export interface TreePaneProps<Meta = unknown> {
  store: TreeStore<Meta>;
  loadChildren?: LoadChildren<Meta> | undefined;
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
  className?: string | undefined;
  treeNodeClassName?: string | undefined;
  'aria-label'?: string | undefined;
}

export function TreePane<Meta = unknown>(
  props: TreePaneProps<Meta>,
): JSX.Element {
  const { store, loadChildren, selectedId, onSelect, renderTreeNode } = props;
  const state = useTreeState({ store, loadChildren, selectedId, onSelect });
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

export function TreePaneView<Meta = unknown>(
  props: TreePaneViewProps<Meta>,
): JSX.Element {
  const { store, state, renderTreeNode, renderExpandCollapse, treeNodeClassName } =
    props;
  const renderNode = renderTreeNode ?? defaultTreeNode;

  const rows = useMemo(
    () => flattenVisible(store, state.expanded),
    [store, state.expanded, state.version],
  );

  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [focusId, setFocusId] = useState<string | undefined>(undefined);

  const activeId = rows.some((r) => r.id === focusId) ? focusId : rows[0]?.id;

  function moveTo(index: number): void {
    const target = rows[index];
    if (!target) return;
    setFocusId(target.id);
    rowRefs.current.get(target.id)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const index = Math.max(
      0,
      rows.findIndex((r) => r.id === activeId),
    );
    const current = rows[index];
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
        moveTo(rows.length - 1);
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
            moveTo(rows.findIndex((r) => r.id === parentId));
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

  return (
    <div
      role="tree"
      className={['br-tree', props.className].filter(Boolean).join(' ')}
      data-part="tree"
      aria-label={props['aria-label'] ?? 'Book sections'}
      onKeyDown={onKeyDown}
    >
      {rows.map((row) => {
        const node = store.getNode(row.id);
        if (!node) return null;

        const expandable = store.isExpandable(row.id);
        const expanded = state.expanded.has(row.id);
        const selected = state.selectedId === row.id;
        const loading = state.loadingIds.has(row.id);
        const nodeState: TreeNodeState = {
          depth: row.depth,
          expandable,
          expanded,
          selected,
          loading,
        };

        return (
          <div
            key={row.id}
            ref={(el) => {
              if (el) rowRefs.current.set(row.id, el);
              else rowRefs.current.delete(row.id);
            }}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-selected={selected}
            aria-expanded={expandable ? expanded : undefined}
            tabIndex={row.id === activeId ? 0 : -1}
            className={['br-tree-node', treeNodeClassName]
              .filter(Boolean)
              .join(' ')}
            data-part="tree-node"
            data-depth={row.depth}
            data-selected={selected || undefined}
            // Depth is *data* (the skin turns it into indentation via
            // --reader-tree-indent); the bare component carries no inline indent.
            style={{ '--br-tree-depth': row.depth } as CSSProperties}
            onClick={() => {
              setFocusId(row.id);
              state.select(row.id);
            }}
            onFocus={() => setFocusId(row.id)}
          >
            {renderExpandCollapse ? (
              renderExpandCollapse({
                expandable,
                expanded,
                loading,
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
