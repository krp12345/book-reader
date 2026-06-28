import type { JSX } from 'react';
import type { ContentCache } from '../core/cache';
import type {
  BookNode,
  ContentNodeWrapperProps,
  ContentState,
  FetchContent,
  ReadingDirection,
  RenderContent,
  RenderContentNode,
  RenderEmpty,
  RenderError,
  RenderLoading,
  SanitizeOption,
} from '../types';
import { useNodeContent } from './useNodeContent';

export interface ContentNodeProps<Meta = unknown, Content = string> {
  node: BookNode<Meta>;
  path: string[];
  fetchContent: FetchContent<Meta, Content>;
  direction?: ReadingDirection | undefined;
  sanitize?: SanitizeOption | undefined;
  cache?: ContentCache<Content> | undefined;
  renderContent?: RenderContent<Meta, Content> | undefined;
  renderContentNode?: RenderContentNode<Meta, Content> | undefined;
  renderLoading?: RenderLoading<Meta> | undefined;
  renderError?: RenderError<Meta> | undefined;
  renderEmpty?: RenderEmpty<Meta> | undefined;
  className?: string | undefined;
  measureRef?: ((el: HTMLElement | null) => void) | undefined;
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

export function ContentNode<Meta = unknown, Content = string>(
  props: ContentNodeProps<Meta, Content>,
): JSX.Element {
  const {
    node,
    path,
    fetchContent,
    direction,
    sanitize,
    cache,
    renderContent,
    renderContentNode,
    renderLoading,
    renderError,
    renderEmpty,
    className,
    measureRef,
  } = props;

  const { status, content, error, retry } = useNodeContent<Meta, Content>({
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
      const loaded = content as Content;
      const state: ContentState<Content> = { status, content: loaded };
      if (renderContent) {
        body = renderContent(node, loaded, state);
      } else if (typeof loaded === 'string') {
        // Default renderer is the sanitized-HTML path; object payloads require
        // a custom `renderContent` (there is no safe default for them).
        body = (
          <div
            className="br-content__html"
            data-part="content-html"
            dangerouslySetInnerHTML={{ __html: loaded }}
          />
        );
      } else {
        body = null;
      }
      break;
    }
  }

  const wrapperProps: ContentNodeWrapperProps = {
    ref: measureRef ?? (() => {}),
    className: ['br-content-node', className].filter(Boolean).join(' '),
    'data-part': 'content-node',
    'data-node-id': node.id,
    'data-status': status,
    'aria-busy': status === 'loading' || undefined,
  };

  if (renderContentNode) {
    const state: ContentState<Content> = { status, content: content as Content };
    return <>{renderContentNode({ node, state, wrapperProps, children: body })}</>;
  }

  return (
    <article {...wrapperProps}>{body}</article>
  );
}
