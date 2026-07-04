import type { TreeStore } from './treeStore';

export type VisibleRow =
  | { kind: 'node'; id: string; depth: number }
  // A synthetic row shown beneath an expanded lazy branch while its children
  // are loading or after the fetch failed. `id` is the owning lazy node's id.
  | { kind: 'lazy'; id: string; depth: number; status: 'loading' | 'error' };

export function flattenVisible<Meta = unknown>(
  store: TreeStore<Meta>,
  expanded: ReadonlySet<string>,
): VisibleRow[] {
  const rows: VisibleRow[] = [];

  function walk(id: string, depth: number): void {
    rows.push({ kind: 'node', id, depth });
    if (!expanded.has(id)) return;

    if (store.isLazy(id)) {
      const status = store.getLazyStatus(id);
      if (status === 'loading' || status === 'unloaded') {
        rows.push({ kind: 'lazy', id, depth: depth + 1, status: 'loading' });
        return;
      }
      if (status === 'error') {
        rows.push({ kind: 'lazy', id, depth: depth + 1, status: 'error' });
        return;
      }
    }

    const children = store.getChildren(id);
    if (children === undefined) return;
    for (const childId of children) walk(childId, depth + 1);
  }

  for (const rootId of store.getRootIds()) walk(rootId, 0);
  return rows;
}
