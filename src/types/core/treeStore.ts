import type { BookNode, LazyStatus } from '../public';

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

export interface NodeRecord<Meta> {
  node: BookNode<Meta>;
  parentId: string | undefined;
  childIds: string[];
}

export interface LazyRecord {
  status: LazyStatus;
  error: unknown;
}

export interface CreateTreeStoreOptions<Meta = unknown> {
  tree?: BookNode<Meta> | BookNode<Meta>[];
}
