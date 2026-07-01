import type { BookNode, LazyStatus } from '../types';

export interface TreeStore<Meta = unknown> {
  getNode(id: string): BookNode<Meta> | undefined;
  getRootIds(): string[];
  getChildren(id: string): string[] | undefined;
  getParentId(id: string): string | undefined;
  getPath(id: string): string[];
  isExpandable(id: string): boolean;

  /** Whether the node is a `lazy` branch placeholder. */
  isLazy(id: string): boolean;
  /** The child-fetch status of a lazy node ('loaded' for non-lazy nodes). */
  getLazyStatus(id: string): LazyStatus;
  /** The last child-fetch error for a lazy node, if any. */
  getLazyError(id: string): unknown;
  /** Record a lazy node's fetch status (loading/error). */
  setLazyStatus(id: string, status: LazyStatus, error?: unknown): void;
  /** Insert a lazy node's resolved children and mark it loaded. */
  setChildren(id: string, children: BookNode<Meta>[]): void;
  /** Replace the entire tree (search / reset). Clears all lazy state. */
  replaceTree(tree: BookNode<Meta> | BookNode<Meta>[] | undefined): void;

  /** Subscribe to structural changes (for `useSyncExternalStore`). */
  subscribe(listener: () => void): () => void;
  /** A monotonically increasing version, bumped on every mutation. */
  getVersion(): number;
}

interface NodeRecord<Meta> {
  node: BookNode<Meta>;
  parentId: string | undefined;
  childIds: string[];
}

interface LazyRecord {
  status: LazyStatus;
  error: unknown;
}

export interface CreateTreeStoreOptions<Meta = unknown> {
  tree?: BookNode<Meta> | BookNode<Meta>[];
}

export function createTreeStore<Meta = unknown>(
  options: CreateTreeStoreOptions<Meta> = {},
): TreeStore<Meta> {
  const records = new Map<string, NodeRecord<Meta>>();
  const lazy = new Map<string, LazyRecord>();
  let rootIds: string[] = [];
  let version = 0;
  const listeners = new Set<() => void>();

  function notify(): void {
    version += 1;
    for (const listener of listeners) listener();
  }

  function index(node: BookNode<Meta>, parentId: string | undefined): void {
    const childIds = node.children?.map((child) => child.id) ?? [];
    records.set(node.id, { node, parentId, childIds });

    // A lazy node that already ships children is treated as pre-resolved.
    if (node.lazy === true) {
      lazy.set(node.id, {
        status: childIds.length > 0 ? 'loaded' : 'unloaded',
        error: undefined,
      });
    }

    if (node.children !== undefined) {
      for (const child of node.children) index(child, node.id);
    }
  }

  function build(tree: BookNode<Meta> | BookNode<Meta>[] | undefined): void {
    records.clear();
    lazy.clear();
    rootIds = [];
    const roots = tree ? (Array.isArray(tree) ? tree : [tree]) : [];
    for (const root of roots) {
      rootIds.push(root.id);
      index(root, undefined);
    }
  }

  build(options.tree);

  function lazyStatusOf(id: string): LazyStatus {
    const record = records.get(id);
    if (record?.node.lazy !== true) return 'loaded';
    return lazy.get(id)?.status ?? 'unloaded';
  }

  return {
    getNode(id) {
      return records.get(id)?.node;
    },

    getRootIds() {
      return [...rootIds];
    },

    getChildren(id) {
      const childIds = records.get(id)?.childIds;
      return childIds ? [...childIds] : undefined;
    },

    getParentId(id) {
      return records.get(id)?.parentId;
    },

    getPath(id) {
      const path: string[] = [];
      let current = records.get(id)?.parentId;
      while (current !== undefined) {
        path.unshift(current);
        current = records.get(current)?.parentId;
      }
      return path;
    },

    isExpandable(id) {
      const record = records.get(id);
      if (!record) return false;
      if (record.childIds.length > 0) return true;
      // A lazy node shows a caret until it has resolved to (possibly empty)
      // children, so the reader can open it to trigger the fetch.
      return record.node.lazy === true && lazyStatusOf(id) !== 'loaded';
    },

    isLazy(id) {
      return records.get(id)?.node.lazy === true;
    },

    getLazyStatus(id) {
      return lazyStatusOf(id);
    },

    getLazyError(id) {
      return lazy.get(id)?.error;
    },

    setLazyStatus(id, status, error) {
      const record = records.get(id);
      if (!record) return;
      lazy.set(id, { status, error });
      notify();
    },

    setChildren(id, children) {
      const record = records.get(id);
      if (!record) return;
      record.childIds = children.map((child) => child.id);
      for (const child of children) index(child, id);
      lazy.set(id, { status: 'loaded', error: undefined });
      notify();
    },

    replaceTree(tree) {
      build(tree);
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getVersion() {
      return version;
    },
  };
}
