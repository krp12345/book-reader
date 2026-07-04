import type { BookNode, ReadingDirection } from './node';

export interface FetchContext<Meta = unknown> {
  node: BookNode<Meta>;
  path: string[];
  direction: ReadingDirection;
  signal: AbortSignal;
}

/**
 * Resolves a node's section content. Returns sanitized HTML `string` by default,
 * but may be parameterized with a generic `Content` payload (any object) for
 * consumers that render structured data via `renderContent`. The `string` path
 * is sanitized (see `sanitize`); object payloads are passed through untouched.
 */
export type FetchContent<Meta = unknown, Content = string> = (
  node: BookNode<Meta>,
  ctx: FetchContext<Meta>,
) => Content | Promise<Content>;

/**
 * Resolves the **immediate children** of a `lazy` node. The library calls this
 * once per node when the node is first opened (tree expand) or scrolled to, wraps
 * it in loading/error/retry, and never refetches once resolved. Returned children
 * may themselves be `lazy` (one level per call, lazy to arbitrary depth).
 */
export type FetchChildren<Meta = unknown> = (
  node: BookNode<Meta>,
  ctx: FetchContext<Meta>,
) => BookNode<Meta>[] | Promise<BookNode<Meta>[]>;

/**
 * Resolves the **ancestor path** (root → direct parent, excluding the target
 * itself) of a node that may live inside an **unfetched** `lazy` branch. Lets a
 * `location`/`defaultLocation` deep-link to a section not yet present in the
 * tree: the reader walks the returned path, resolving each lazy ancestor, until
 * the target exists, then scrolls to it. Return `undefined` when the target's
 * ancestry can't be determined. May be async; receives an abort `signal` that
 * fires if the navigation is superseded. Only consulted when `BookLocation.path`
 * is not supplied and the target isn't already in the tree.
 */
export type FetchPath = (
  nodeId: string,
  signal: AbortSignal,
) => string[] | undefined | Promise<string[] | undefined>;
