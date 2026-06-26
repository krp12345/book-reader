/**
 * Normalized, id-indexed tree store.
 *
 * Holds the book structure flattened into lookup maps so the rest of the core
 * (traversal, scroll-sync, virtualization) can ask cheap questions — "who is the
 * parent of X?", "is X expandable?" — without walking a nested object. Supports
 * both sync trees (given whole) and lazy trees (children arrive via
 * `setChildren`).
 *
 * Pure: no React. See CONVENTIONS.md.
 */
import type { BookNode } from '../types';

export interface TreeStore<Meta = unknown> {
  /** The node record, or undefined if unknown. */
  getNode(id: string): BookNode<Meta> | undefined;
  /** Top-level node ids, in order. */
  getRootIds(): string[];
  /**
   * Ordered child ids, or `undefined` when the node's children are not yet
   * loaded (lazy + expandable). A loaded leaf returns `[]`.
   */
  getChildren(id: string): string[] | undefined;
  /** Parent id, or undefined for a root / unknown node. */
  getParentId(id: string): string | undefined;
  /** Ancestor ids from root → parent (excludes `id` itself). */
  getPath(id: string): string[];
  /** True once this node's children are known (even if empty). */
  isLoaded(id: string): boolean;
  /** True if the node can have children (loaded non-empty, or lazy hasChildren). */
  isExpandable(id: string): boolean;
  /** Absorb lazily-loaded children for a parent and index them. */
  setChildren(parentId: string, children: BookNode<Meta>[]): void;
}

interface NodeRecord<Meta> {
  node: BookNode<Meta>;
  parentId: string | undefined;
  /** Ordered child ids, or undefined when not yet loaded. */
  childIds: string[] | undefined;
}

export interface CreateTreeStoreOptions<Meta = unknown> {
  /** A single root, a forest of roots, or omitted for a fully-lazy tree. */
  tree?: BookNode<Meta> | BookNode<Meta>[];
}

export function createTreeStore<Meta = unknown>(
  options: CreateTreeStoreOptions<Meta> = {},
): TreeStore<Meta> {
  const records = new Map<string, NodeRecord<Meta>>();
  const rootIds: string[] = [];

  /** Index a node under `parentId`, recursing into any present children. */
  function index(node: BookNode<Meta>, parentId: string | undefined): void {
    let childIds: string[] | undefined;
    if (node.children !== undefined) {
      // Children given up front → loaded.
      childIds = node.children.map((child) => child.id);
    } else if (node.hasChildren === true) {
      // Lazy + expandable but not yet loaded.
      childIds = undefined;
    } else {
      // Neither children nor hasChildren ⇒ a leaf: loaded, empty.
      childIds = [];
    }

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
      return childIds ? [...childIds] : childIds;
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

    isLoaded(id) {
      return records.get(id)?.childIds !== undefined;
    },

    isExpandable(id) {
      const record = records.get(id);
      if (!record) return false;
      if (record.childIds !== undefined) return record.childIds.length > 0;
      return record.node.hasChildren === true;
    },

    setChildren(parentId, children) {
      const record = records.get(parentId);
      if (!record) return;
      record.childIds = children.map((child) => child.id);
      for (const child of children) {
        index(child, parentId);
      }
    },
  };
}
