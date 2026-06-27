import type { TreeStore } from './treeStore';

export interface ReadingOrder {
  getNext(id: string): string | undefined;
  getPrev(id: string): string | undefined;
  getFirst(): string | undefined;
  getLast(): string | undefined;
  getSequence(): string[];
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
