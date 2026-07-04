import type { TreeStore } from './treeStore';
import type { ReadingOrder, ResolveDeps } from '../types/core';

export type { ReadingOrder, ResolveDeps } from '../types/core';

/**
 * Makes `target` exist in the store, resolving `lazy` ancestors as needed, so a
 * deep-link into an unfetched branch can be scrolled to. Returns `true` once the
 * node is present (or already was), `false` if it can't be reached (no ancestry
 * available, an ancestor fetch failed, or the navigation was aborted).
 *
 * The path is `root → direct parent` (excluding `target`, matching
 * `store.getPath`). Ancestors are resolved **in order** — resolving a lazy
 * ancestor surfaces the next one — so a whole chain of nested lazy branches
 * comes into existence one fetch per level.
 */
export async function resolveToNode<Meta = unknown>(
  store: TreeStore<Meta>,
  target: string,
  deps: ResolveDeps,
): Promise<boolean> {
  if (store.getNode(target) !== undefined) return true;

  let path = deps.path;
  if (path === undefined && deps.fetchPath !== undefined) {
    path = await deps.fetchPath(target, deps.signal);
  }
  if (deps.signal.aborted) return false;
  if (path === undefined) return false;

  for (const ancestor of path) {
    if (deps.signal.aborted) return false;
    // An unknown ancestor means the path is inconsistent with the tree (or a
    // parent above it never resolved) — we can't fetch what we can't address.
    if (store.getNode(ancestor) === undefined) return false;
    if (store.isLazy(ancestor) && store.getLazyStatus(ancestor) !== 'loaded') {
      try {
        await deps.ensureAsync(ancestor);
      } catch {
        return false;
      }
      if (deps.signal.aborted) return false;
    }
  }

  return store.getNode(target) !== undefined;
}

/**
 * "First page" of a (possibly just-replaced) tree: descend the leftmost path
 * from the first root — resolving `lazy` branches along the way — until the
 * first node that actually carries content. Returns the id to navigate to
 * (falling back to the first root when nothing showable is reachable), or
 * `undefined` when the walk was aborted or the tree is empty.
 */
export async function findFirstShowable<Meta = unknown>(
  store: TreeStore<Meta>,
  deps: { ensureAsync: (id: string) => Promise<void>; signal: AbortSignal },
): Promise<string | undefined> {
  const { ensureAsync, signal } = deps;
  let id: string | undefined = store.getRootIds()[0];
  const seen = new Set<string>();
  while (id !== undefined && !seen.has(id)) {
    seen.add(id);
    if (signal.aborted) return undefined;
    const node = store.getNode(id);
    if (node === undefined) break;
    if (node.hasContent !== false) return id;
    // A pure organisational branch — descend into it, resolving lazily first.
    if (store.isLazy(id) && store.getLazyStatus(id) !== 'loaded') {
      try {
        await ensureAsync(id);
      } catch {
        break;
      }
      if (signal.aborted) return undefined;
    }
    id = store.getChildren(id)?.[0];
  }
  return store.getRootIds()[0];
}

/**
 * Resolve a scroll target to a node the reading surface actually renders: the
 * id itself when showable, otherwise the next showable node after it in the
 * reading sequence (so navigating to a resolved pure-branch lands on its first
 * content).
 */
export function resolveToShowable(
  seq: string[],
  showable: ReadonlySet<string>,
  id: string,
): string | undefined {
  if (showable.has(id)) return id;
  const from = seq.indexOf(id);
  if (from === -1) return undefined;
  for (let i = from + 1; i < seq.length; i++) {
    const candidate = seq[i];
    if (candidate !== undefined && showable.has(candidate)) return candidate;
  }
  return undefined;
}

export function createReadingOrder<Meta = unknown>(
  store: TreeStore<Meta>,
): ReadingOrder {
  function siblingsOf(id: string): string[] {
    const parentId = store.getParentId(id);
    if (parentId === undefined) return store.getRootIds();
    return store.getChildren(parentId) ?? [];
  }

  function nextSibling(id: string): string | undefined {
    const siblings = siblingsOf(id);
    const i = siblings.indexOf(id);
    return i === -1 ? undefined : siblings[i + 1];
  }

  function prevSibling(id: string): string | undefined {
    const siblings = siblingsOf(id);
    const i = siblings.indexOf(id);
    return i <= 0 ? undefined : siblings[i - 1];
  }

  function deepestLast(id: string): string {
    let current = id;
    for (;;) {
      const children = store.getChildren(current);
      if (children === undefined || children.length === 0) return current;
      const last = children[children.length - 1];
      if (last === undefined) return current;
      current = last;
    }
  }

  return {
    getNext(id) {
      if (store.getNode(id) === undefined) return undefined;
      const children = store.getChildren(id);
      if (children !== undefined && children.length > 0) return children[0];
      let current: string | undefined = id;
      while (current !== undefined) {
        const sibling = nextSibling(current);
        if (sibling !== undefined) return sibling;
        current = store.getParentId(current);
      }
      return undefined;
    },

    getPrev(id) {
      if (store.getNode(id) === undefined) return undefined;
      const sibling = prevSibling(id);
      if (sibling !== undefined) return deepestLast(sibling);
      return store.getParentId(id);
    },

    getFirst() {
      return store.getRootIds()[0];
    },

    getLast() {
      const roots = store.getRootIds();
      const lastRoot = roots[roots.length - 1];
      return lastRoot === undefined ? undefined : deepestLast(lastRoot);
    },

    getSequence() {
      const out: string[] = [];
      let id = this.getFirst();
      while (id !== undefined) {
        out.push(id);
        id = this.getNext(id);
      }
      return out;
    },
  };
}
