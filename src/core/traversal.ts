/**
 * Depth-first (pre-order) reading order over a {@link TreeStore}.
 *
 * The book is read parent-before-children, children left-to-right — the same
 * order a person turns the pages. `getNext`/`getPrev` are the primitives the
 * content pane and scroll-sync use to walk the book; `getFirst`/`getLast` give
 * the endpoints.
 *
 * This is a *view* over the store's current knowledge, not a snapshot: lazy
 * children that haven't loaded yet are simply not descended into. An unloaded
 * expandable node therefore reads like a leaf until its children arrive (via
 * `store.setChildren`), after which the same queries descend correctly.
 *
 * Pure: no React. See CONVENTIONS.md.
 */
import type { TreeStore } from './treeStore';

export interface ReadingOrder {
  /** The next node id in reading order, or undefined past the last node. */
  getNext(id: string): string | undefined;
  /** The previous node id in reading order, or undefined before the first. */
  getPrev(id: string): string | undefined;
  /** The first node to read (first root), or undefined for an empty book. */
  getFirst(): string | undefined;
  /** The last node to read (deepest last descendant), or undefined if empty. */
  getLast(): string | undefined;
  /**
   * All node ids in forward reading order over the currently-loaded tree.
   * Unloaded lazy subtrees are not descended into (their children appear only
   * once {@link TreeStore.setChildren} has run). The content pane uses this to
   * lay the book out top-to-bottom.
   */
  getSequence(): string[];
}

export function createReadingOrder<Meta = unknown>(
  store: TreeStore<Meta>,
): ReadingOrder {
  /** Ordered sibling ids of `id` (root list for a root). Empty if unknown. */
  function siblingsOf(id: string): string[] {
    const parentId = store.getParentId(id);
    if (parentId === undefined) return store.getRootIds();
    return store.getChildren(parentId) ?? [];
  }

  /** The sibling immediately after `id`, or undefined if it's the last. */
  function nextSibling(id: string): string | undefined {
    const siblings = siblingsOf(id);
    const i = siblings.indexOf(id);
    return i === -1 ? undefined : siblings[i + 1];
  }

  /** The sibling immediately before `id`, or undefined if it's the first. */
  function prevSibling(id: string): string | undefined {
    const siblings = siblingsOf(id);
    const i = siblings.indexOf(id);
    return i <= 0 ? undefined : siblings[i - 1];
  }

  /** Walk down last children to the deepest last descendant of `id`. */
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
      // Descend into a loaded, non-empty subtree first.
      const children = store.getChildren(id);
      if (children !== undefined && children.length > 0) return children[0];
      // Otherwise the next sibling; climbing ancestors when subtrees are spent.
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
      // Before a node comes its previous sibling's deepest last descendant...
      const sibling = prevSibling(id);
      if (sibling !== undefined) return deepestLast(sibling);
      // ...or the parent, when there is no previous sibling.
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
