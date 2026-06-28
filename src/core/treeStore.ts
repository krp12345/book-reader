import type { BookNode } from '../types';

export interface TreeStore<Meta = unknown> {
  getNode(id: string): BookNode<Meta> | undefined;
  getRootIds(): string[];
  getChildren(id: string): string[] | undefined;
  getParentId(id: string): string | undefined;
  getPath(id: string): string[];
  isExpandable(id: string): boolean;
}

interface NodeRecord<Meta> {
  node: BookNode<Meta>;
  parentId: string | undefined;
  childIds: string[];
}

export interface CreateTreeStoreOptions<Meta = unknown> {
  tree?: BookNode<Meta> | BookNode<Meta>[];
}

export function createTreeStore<Meta = unknown>(
  options: CreateTreeStoreOptions<Meta> = {},
): TreeStore<Meta> {
  const records = new Map<string, NodeRecord<Meta>>();
  const rootIds: string[] = [];

  function index(node: BookNode<Meta>, parentId: string | undefined): void {
    const childIds = node.children?.map((child) => child.id) ?? [];

    records.set(node.id, { node, parentId, childIds });

    if (node.children !== undefined) {
      for (const child of node.children) {
        index(child, node.id);
      }
    }
  }

  const roots = options.tree
    ? Array.isArray(options.tree)
      ? options.tree
      : [options.tree]
    : [];
  for (const root of roots) {
    rootIds.push(root.id);
    index(root, undefined);
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
      return record.childIds.length > 0;
    },
  };
}
