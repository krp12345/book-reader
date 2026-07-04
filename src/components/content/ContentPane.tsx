import type { JSX } from 'react';
import type { ContentCache } from '../../core/cache';
import type { TreeStore } from '../../core/treeStore';
import type {
  FetchContent,
  GetNextNode,
  GetPrevNode,
  RenderContent,
  RenderContentNode,
  RenderEmpty,
  RenderError,
  RenderLoading,
  RenderNoData,
  SanitizeOption,
  ScrollRequest,
} from '../../types';
import { useContentPane } from '../../hooks/useContentPane';
import { cx } from '../../utils/cx';
import { ContentNode } from './ContentNode';
import { LazyContentPlaceholder } from './LazyContentPlaceholder';

export type { ScrollRequest } from '../../types';

export interface ContentPaneProps<Meta = unknown, Content = string> {
  store: TreeStore<Meta>;
  fetchContent: FetchContent<Meta, Content>;
  sanitize?: SanitizeOption | undefined;
  cache?: ContentCache<Content> | undefined;
  overscan?: number | undefined;
  prefetchCount?: number | undefined;
  estimateHeight?: number | undefined;
  getNextNode?: GetNextNode<Meta> | undefined;
  getPrevNode?: GetPrevNode<Meta> | undefined;
  onActiveChange?: ((id: string, offset: number) => void) | undefined;
  /** Ensure a lazy node's children load when it enters the reading window. */
  ensureLazy?: ((id: string) => void) | undefined;
  scrollRequest?: ScrollRequest | undefined;
  renderContent?: RenderContent<Meta, Content> | undefined;
  renderContentNode?: RenderContentNode<Meta, Content> | undefined;
  renderLoading?: RenderLoading<Meta> | undefined;
  renderError?: RenderError<Meta> | undefined;
  renderEmpty?: RenderEmpty<Meta> | undefined;
  /** Book-level "no data / no results" panel (whole tree has nothing to show). */
  renderNoData?: RenderNoData | undefined;
  className?: string | undefined;
  contentNodeClassName?: string | undefined;
  'aria-label'?: string | undefined;
}

/**
 * The virtualized reading surface. Purely presentational: sequencing,
 * windowing, prefetch, scroll requests and lazy triggers live in
 * `hooks/useContentPane.ts` — this component only renders the window.
 */
export function ContentPane<Meta = unknown, Content = string>(
  props: ContentPaneProps<Meta, Content>,
): JSX.Element {
  const { store, fetchContent, sanitize, cache, ensureLazy } = props;

  const {
    scrollRef,
    items,
    paddingTop,
    paddingBottom,
    totalHeight,
    measureRef,
    isLazyPending,
    noData,
  } = useContentPane<Meta, Content>(props);

  return (
    <div
      ref={scrollRef}
      className={cx('br-content', props.className)}
      data-part="content"
      aria-label={props['aria-label'] ?? 'Reading'}
      style={{
        flex: '1 1 0',
        minWidth: 0,
        overflow: 'auto',
        height: '100%',
        position: 'relative',
        overflowAnchor: 'none',
        // Structural only: centre the no-data panel in the empty surface.
        ...(noData
          ? { display: 'flex', alignItems: 'center', justifyContent: 'center' }
          : {}),
      }}
    >
      {noData &&
        (props.renderNoData !== undefined ? (
          props.renderNoData()
        ) : (
          <p className="br-content-nodata" data-part="content-nodata">
            Nothing to show here.
          </p>
        ))}
      {}
      <div
        data-part="content-spacer-top"
        style={{ height: paddingTop }}
        aria-hidden
      />
      {items.map(({ id }) => {
        const node = store.getNode(id);
        if (!node) return null;
        if (isLazyPending(id)) {
          const status = store.getLazyStatus(id);
          return (
            <LazyContentPlaceholder
              key={id}
              measureRef={measureRef(id)}
              status={status === 'error' ? 'error' : 'loading'}
              error={store.getLazyError(id)}
              onRetry={ensureLazy ? () => ensureLazy(id) : undefined}
            />
          );
        }
        return (
          <ContentNode
            key={id}
            node={node}
            path={store.getPath(id)}
            fetchContent={fetchContent}
            sanitize={sanitize}
            cache={cache}
            measureRef={measureRef(id)}
            renderContent={props.renderContent}
            renderContentNode={props.renderContentNode}
            renderLoading={props.renderLoading}
            renderError={props.renderError}
            renderEmpty={props.renderEmpty}
            className={props.contentNodeClassName}
          />
        );
      })}
      {}
      <div
        data-part="content-spacer-bottom"
        style={{ height: paddingBottom }}
        aria-hidden
        data-total-height={totalHeight}
      />
    </div>
  );
}
