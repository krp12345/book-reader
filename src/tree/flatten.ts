/**
 * Flatten the tree into the ordered list of *currently visible* rows — roots
 * plus the descendants of expanded, loaded nodes — each tagged with its depth.
 *
 * This is the bridge between the nested {@link TreeStore} and a flat render list:
 * the TreePane renders this array (and, later, virtualizes it), and keyboard
 * navigation is just index movement over it. Pure so it stays unit-testable and
 * React-free. See CONVENTIONS.md.
 */
import type { TreeStore } from '../core/treeStore';

export interface VisibleRow {
  /** Node id for this row. */
  id: string;
  /** Nesting depth; roots are 0. Drives indentation and `aria-level`. */
  depth: number;
}

export function flattenVisible<Meta = unknown>(
  store: TreeStore<Meta>,
  expanded: ReadonlySet<string>,
): VisibleRow[] {
  const rows: VisibleRow[] = [];

  function walk(id: string, depth: number): void {
    rows.push({ id, depth });
    if (!expanded.has(id)) return;
    // `undefined` ⇒ children not loaded yet: there is nothing to show.
    const children = store.getChildren(id);
    if (children === undefined) return;
    for (const childId of children) walk(childId, depth + 1);
  }

  for (const rootId of store.getRootIds()) walk(rootId, 0);
  return rows;
}
