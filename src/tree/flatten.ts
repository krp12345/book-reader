import type { TreeStore } from '../core/treeStore';

export interface VisibleRow {
  id: string;
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
    const children = store.getChildren(id);
    if (children === undefined) return;
    for (const childId of children) walk(childId, depth + 1);
  }

  for (const rootId of store.getRootIds()) walk(rootId, 0);
  return rows;
}
