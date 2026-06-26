/**
 * One node's slot in the continuous reading surface.
 *
 * Owns the structural wrapper (and its stable `data-part`/`data-status` hooks)
 * and picks what to show for the current fetch state, delegating the visible
 * markup to the matching render-prop (with a shipped default for each):
 *   loading → `renderLoading` · error → `renderError(retry)` ·
 *   empty → `renderEmpty` · loaded → `renderContent`.
 *
 * Defaults keep accessibility intact (`aria-busy` while loading, an alert +
 * retry button on error) so custom renderers can't accidentally drop it.
 */
import type { JSX } from 'react';
import type { ContentCache } from '../core/cache';
import type {
  BookNode,
  ContentState,
  FetchContent,
  ReadingDirection,
  RenderContent,
  RenderEmpty,
  RenderError,
  RenderLoading,
  SanitizeOption,
} from '../types';
import { useNodeContent } from './useNodeContent';

export interface ContentNodeProps<Meta = unknown> {
  node: BookNode<Meta>;
  path: string[];
  fetchContent: FetchContent<Meta>;
  direction?: ReadingDirection | undefined;
  sanitize?: SanitizeOption | undefined;
  /** Shared content cache (sanitized HTML keyed by node id). */
  cache?: ContentCache<string> | undefined;
  renderContent?: RenderContent<Meta> | undefined;
  renderLoading?: RenderLoading<Meta> | undefined;
  renderError?: RenderError<Meta> | undefined;
  renderEmpty?: RenderEmpty<Meta> | undefined;
  className?: string | undefined;
}

function DefaultLoading(): JSX.Element {
  return (
    <p className="br-content__loading" data-part="content-loading">
      Loading…
    </p>
  );
}

function DefaultEmpty(): JSX.Element {
  return (
    <p className="br-content__empty" data-part="content-empty">
      No content.
    </p>
  );
}

function DefaultError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}): JSX.Element {
  return (
    <div className="br-content__error" data-part="content-error" role="alert">
      <span>Couldn’t load this section.</span>
      <button
        type="button"
        className="br-content__retry"
        data-part="content-retry"
        onClick={retry}
      >
        Retry
      </button>
    </div>
  );
}

export function ContentNode<Meta = unknown>(
  props: ContentNodeProps<Meta>,
): JSX.Element {
  const {
    node,
    path,
    fetchContent,
    direction,
    sanitize,
    cache,
    renderContent,
    renderLoading,
    renderError,
    renderEmpty,
    className,
  } = props;

  const { status, html, error, retry } = useNodeContent({
    node,
    path,
    fetchContent,
    direction,
    sanitize,
    cache,
  });

  let body: import('react').ReactNode;
  switch (status) {
    case 'loading':
      body = renderLoading ? renderLoading(node) : <DefaultLoading />;
      break;
    case 'error':
      body = renderError ? (
        renderError(node, error, retry)
      ) : (
        <DefaultError error={error} retry={retry} />
      );
      break;
    case 'empty':
      body = renderEmpty ? renderEmpty(node) : <DefaultEmpty />;
      break;
    case 'loaded': {
      const state: ContentState = { status, html };
      body = renderContent ? (
        renderContent(node, html, state)
      ) : (
        <div
          className="br-content__html"
          data-part="content-html"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
      break;
    }
  }

  return (
    <article
      className={['br-content-node', className].filter(Boolean).join(' ')}
      data-part="content-node"
      data-node-id={node.id}
      data-status={status}
      aria-busy={status === 'loading' || undefined}
    >
      {body}
    </article>
  );
}
