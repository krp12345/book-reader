import type { BookNode } from './node';

export type SanitizeOption = boolean | ((html: string) => string);

export type ContentStatus = 'loading' | 'loaded' | 'empty' | 'error';

export interface ContentState<Content = string> {
  status: ContentStatus;
  /** The resolved payload (sanitized HTML string by default, or any object). */
  content: Content;
}

export type RenderContent<Meta = unknown, Content = string> = (
  node: BookNode<Meta>,
  content: Content,
  state: ContentState<Content>,
) => import('react').ReactNode;

/**
 * The wrapper props the library would otherwise spread onto its default
 * `<article>` content-node element. A `renderContentNode` consumer **must**
 * spread these onto whatever element they choose so virtualization keeps
 * working: `ref` is the measurement ref the height map depends on, and the
 * `data-part`/`data-node-id`/`data-status` hooks keep the default skin + active
 * tracking intact.
 */
export interface ContentNodeWrapperProps {
  ref: (el: HTMLElement | null) => void;
  className: string;
  'data-part': 'content-node';
  'data-node-id': string;
  'data-status': ContentStatus;
  'aria-busy': true | undefined;
}

/**
 * The control surface handed to `renderContentNode`. `children` is the rendered
 * body (the same output `renderContent`/the default renderers produce for the
 * current `state.status`); `wrapperProps` must be spread onto your wrapper
 * element. Unlike `renderContent` (which replaces only the *inner* body), this
 * lets a consumer own the wrapper element itself — tag, classes, attrs,
 * handlers.
 */
export interface ContentNodeApi<Meta = unknown, Content = string> {
  node: BookNode<Meta>;
  state: ContentState<Content>;
  wrapperProps: ContentNodeWrapperProps;
  children: import('react').ReactNode;
}

export type RenderContentNode<Meta = unknown, Content = string> = (
  api: ContentNodeApi<Meta, Content>,
) => import('react').ReactNode;

export type RenderLoading<Meta = unknown> = (
  node: BookNode<Meta>,
) => import('react').ReactNode;

export type RenderEmpty<Meta = unknown> = (
  node: BookNode<Meta>,
) => import('react').ReactNode;

/**
 * Replaces the **book-level** "no data / no results" template — shown when the
 * whole (possibly search-replaced) tree has no showable content nodes at all
 * (an empty book, or a search that matched nothing). Distinct from the
 * per-*section* `renderEmpty`, which handles one node whose fetched content is
 * empty.
 */
export type RenderNoData = () => import('react').ReactNode;

export type RenderError<Meta = unknown> = (
  node: BookNode<Meta>,
  error: unknown,
  retry: () => void,
) => import('react').ReactNode;

/**
 * A tokened "scroll the reading surface to this node" request. The token makes
 * each request unique so re-requesting the same node still scrolls.
 */
export interface ScrollRequest {
  id: string;
  offset?: number | undefined;
  token: number;
}
