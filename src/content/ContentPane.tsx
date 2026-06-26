/**
 * Right pane: the continuous, *virtualized* reading surface.
 *
 * Lays the book out top-to-bottom in depth-first reading order
 * (see {@link createReadingOrder}), but only mounts the nodes in the viewport +
 * overscan window ({@link useVirtualList}); the off-screen scroll height is held
 * by spacer divs above and below. Each mounted {@link ContentNode} fetches its
 * own body and reports its measured height back, so the height map sharpens as
 * the reader scrolls and anchor correction keeps the view from jumping.
 *
 * The hook also drives the cache's pinned window (mounted + prefetch-ahead) and
 * warms the next `prefetchCount` nodes, so scroll-back over read content and
 * about-to-enter nodes are synchronous cache hits (no flicker, no re-fetch).
 * Pass a bumping `version` to recompute the sequence after lazy children load.
 */
import { useCallback, useMemo, type JSX } from 'react';
import type { ContentCache } from '../core/cache';
import type { TreeStore } from '../core/treeStore';
import { createReadingOrder } from '../core/traversal';
import type {
  FetchContent,
  RenderContent,
  RenderEmpty,
  RenderError,
  RenderLoading,
  SanitizeOption,
} from '../types';
import { ContentNode } from './ContentNode';
import { prefetchNodeContent } from './prefetchNodeContent';
import { useVirtualList } from './useVirtualList';

export interface ContentPaneProps<Meta = unknown> {
  /** The indexed tree whose nodes are read in order. */
  store: TreeStore<Meta>;
  fetchContent: FetchContent<Meta>;
  /** Bump to recompute the rendered sequence after lazy children load. */
  version?: number | undefined;
  sanitize?: SanitizeOption | undefined;
  /** Shared content cache (sanitized HTML keyed by node id). */
  cache?: ContentCache<string> | undefined;
  /** Extra nodes mounted on each side of the viewport. Default `2`. */
  overscan?: number | undefined;
  /** Nodes past the window kept pinned + warmed ahead of view. Default `2`. */
  prefetchCount?: number | undefined;
  /** Height (px) assumed for not-yet-measured nodes. */
  estimateHeight?: number | undefined;
  renderContent?: RenderContent<Meta> | undefined;
  renderLoading?: RenderLoading<Meta> | undefined;
  renderError?: RenderError<Meta> | undefined;
  renderEmpty?: RenderEmpty<Meta> | undefined;
  className?: string | undefined;
  /** Applied to each content node wrapper. */
  contentNodeClassName?: string | undefined;
  'aria-label'?: string | undefined;
}

export function ContentPane<Meta = unknown>(
  props: ContentPaneProps<Meta>,
): JSX.Element {
  const {
    store,
    version,
    fetchContent,
    sanitize,
    cache,
    overscan = 2,
    prefetchCount = 2,
    estimateHeight,
  } = props;

  // Reading order reflects the store's *current* knowledge; recompute when lazy
  // children land (signalled via `version`).
  const ids = useMemo(() => {
    const order = createReadingOrder(store);
    return order
      .getSequence()
      .filter((id) => store.getNode(id)?.hasContent !== false);
  }, [store, version]);

  // Warm a node's content into the cache ahead of view (no-op without a cache).
  const prefetch = useCallback(
    (id: string) => {
      const node = store.getNode(id);
      if (node === undefined || cache === undefined) return;
      prefetchNodeContent({
        node,
        path: store.getPath(id),
        fetchContent,
        sanitize,
        cache,
      });
    },
    [store, cache, fetchContent, sanitize],
  );

  const { scrollRef, items, paddingTop, paddingBottom, totalHeight, measureRef } =
    useVirtualList({
      ids,
      overscan,
      prefetchCount,
      estimateHeight,
      cache,
      prefetch: cache !== undefined ? prefetch : undefined,
    });

  return (
    <div
      ref={scrollRef}
      className={['br-content', props.className].filter(Boolean).join(' ')}
      data-part="content"
      aria-label={props['aria-label'] ?? 'Reading'}
      style={{
        flex: '1 1 0',
        minWidth: 0,
        overflow: 'auto',
        height: '100%',
        position: 'relative',
      }}
    >
      {/* Spacer holding the collapsed scroll height of nodes above the window. */}
      <div data-part="content-spacer-top" style={{ height: paddingTop }} aria-hidden />
      {items.map(({ id }) => {
        const node = store.getNode(id);
        if (!node) return null;
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
            renderLoading={props.renderLoading}
            renderError={props.renderError}
            renderEmpty={props.renderEmpty}
            className={props.contentNodeClassName}
          />
        );
      })}
      {/* Spacer holding the collapsed scroll height of nodes below the window. */}
      <div
        data-part="content-spacer-bottom"
        style={{ height: paddingBottom }}
        aria-hidden
        data-total-height={totalHeight}
      />
    </div>
  );
}
