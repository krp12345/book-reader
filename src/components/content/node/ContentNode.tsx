import type { JSX } from 'react';
import type { ContentNodeWrapperProps, ContentState } from '../../../types';
import { useNodeContent } from '../../../hooks/content/useNodeContent';
import { cx } from '../../../utils/common/cx';
import type { ContentNodeProps } from '../../../types/components';
import { ContentLoading } from './ContentLoading';
import { ContentEmpty } from './ContentEmpty';
import { ContentError } from './ContentError';

export type { ContentNodeProps } from '../../../types/components';

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
      body = renderLoading ? renderLoading(node) : <ContentLoading />;
      break;
    case 'error':
      body = renderError ? (
        renderError(node, error, retry)
      ) : (
        <ContentError error={error} retry={retry} />
      );
      break;
    case 'empty':
      body = renderEmpty ? renderEmpty(node) : <ContentEmpty />;
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
    className: cx('br-content-node', className),
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
