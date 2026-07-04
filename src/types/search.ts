import type { BookNode } from './node';

/** Context passed to `onSearch` / `onReset`. Carries an abort signal. */
export interface SearchContext {
  signal: AbortSignal;
}

/**
 * Runs a search. Receives the typed query and returns a **whole new tree** (same
 * shape as the `tree` prop) that *replaces* the current book; the reader resets
 * to the first page. May be async. Lazy nodes in the result are supported.
 */
export type SearchFn<Meta = unknown> = (
  query: string,
  ctx: SearchContext,
) => BookNode<Meta> | BookNode<Meta>[] | Promise<BookNode<Meta> | BookNode<Meta>[]>;

/**
 * Produces the tree to restore when the user resets the search (typically the
 * original book). Same return contract as `SearchFn`.
 */
export type ResetFn<Meta = unknown> = (
  ctx: SearchContext,
) => BookNode<Meta> | BookNode<Meta>[] | Promise<BookNode<Meta> | BookNode<Meta>[]>;

/**
 * The control surface handed to `renderSearch`. A custom search box drives the
 * query and triggers search/reset; the library owns the tree-replacement,
 * loading and first-page resolution. There are no result lists — search replaces
 * the whole tree.
 */
export interface SearchApi {
  /** The current query text. */
  query: string;
  /** Update the query text. */
  setQuery(query: string): void;
  /** Run `onSearch` with the current query. */
  submit(): void;
  /** Run `onReset` to restore the tree. */
  reset(): void;
  /** Whether a search/reset is currently running. */
  isSearching: boolean;
  /** The last search/reset error, if any. */
  error: unknown;
  /** Whether a reset is available (an `onReset` is configured). */
  canReset: boolean;
}

export type RenderSearch = (api: SearchApi) => import('react').ReactNode;
