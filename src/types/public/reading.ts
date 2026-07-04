import type { BookNode, ReadingDirection } from './node';

export interface ReadingOrderContext<Meta = unknown> {
  node: BookNode<Meta>;
  path: string[];
  direction: ReadingDirection;
}

export type GetNextNode<Meta = unknown> = (
  node: BookNode<Meta>,
  ctx: ReadingOrderContext<Meta>,
) => BookNode<Meta> | null;

export type GetPrevNode<Meta = unknown> = (
  node: BookNode<Meta>,
  ctx: ReadingOrderContext<Meta>,
) => BookNode<Meta> | null;

export interface BookLocation {
  nodeId: string;
  offset?: number | undefined;
  /**
   * Ancestor ids from **root → direct parent** (excluding `nodeId` itself) used
   * to deep-link into **unfetched** `lazy` branches: the reader resolves each
   * lazy ancestor in turn so the target node comes into existence, then scrolls
   * to it. Optional — when omitted the reader falls back to the `fetchPath` prop;
   * with neither, a location pointing inside an unresolved branch can't be
   * reached and is a no-op. Ignored when `nodeId` is already in the tree.
   */
  path?: string[] | undefined;
}
