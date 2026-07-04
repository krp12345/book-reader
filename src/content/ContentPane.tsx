import { useCallback, useEffect, useMemo, useRef, type JSX } from 'react';
import type { ContentCache } from '../core/cache';
import type { TreeStore } from '../core/treeStore';
import { createReadingOrder } from '../core/traversal';
import { withReadingOverrides } from '../core/scrollSync';
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
} from '../types';
import { ContentNode } from './ContentNode';
import { LazyContentPlaceholder } from './LazyContentPlaceholder';
import { prefetchNodeContent } from './prefetchNodeContent';
import { useVirtualList } from './useVirtualList';
import { useStoreVersion } from '../useStoreVersion';

export interface ScrollRequest {
  id: string;
  offset?: number | undefined;
  token: number;
}

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

export function ContentPane<Meta = unknown, Content = string>(
  props: ContentPaneProps<Meta, Content>,
): JSX.Element {
  const {
    store,
    fetchContent,
    sanitize,
    cache,
    overscan = 2,
    prefetchCount = 2,
    estimateHeight,
    getNextNode,
    getPrevNode,
    onActiveChange,
    ensureLazy,
    scrollRequest,
  } = props;

  // Recompute the reading order when lazy children load / the tree is replaced.
  const version = useStoreVersion(store);

  const fullSeq = useMemo(() => {
    const order = withReadingOverrides(store, createReadingOrder(store), {
      getNextNode,
      getPrevNode,
    });
    return order.getSequence();
  }, [store, getNextNode, getPrevNode, version]);

  const isLazyPending = useCallback(
    (id: string): boolean =>
      store.isLazy(id) && store.getLazyStatus(id) !== 'loaded',
    [store],
  );

  const ids = useMemo(
    () =>
      fullSeq.filter(
        (id) =>
          // An unresolved lazy branch renders a placeholder in reading order so
          // (a) the reader sees it loading and (b) scrolling to it triggers the
          // fetch; once loaded a pure-branch (hasContent:false) drops out again.
          isLazyPending(id) || store.getNode(id)?.hasContent !== false,
      ),
    [fullSeq, store, version, isLazyPending],
  );

  const contentIds = useMemo(() => new Set(ids), [ids]);
  const resolveContentId = useCallback(
    (id: string): string | undefined => {
      if (contentIds.has(id)) return id;
      const from = fullSeq.indexOf(id);
      if (from === -1) return undefined;
      for (let i = from + 1; i < fullSeq.length; i++) {
        const candidate = fullSeq[i];
        if (candidate !== undefined && contentIds.has(candidate))
          return candidate;
      }
      return undefined;
    },
    [contentIds, fullSeq],
  );

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

  const {
    scrollRef,
    items,
    paddingTop,
    paddingBottom,
    totalHeight,
    measureRef,
    activeId,
    activeOffset,
    scrollToId,
  } = useVirtualList({
    ids,
    overscan,
    prefetchCount,
    estimateHeight,
    cache,
    prefetch: cache !== undefined ? prefetch : undefined,
  });

  useEffect(() => {
    if (activeId !== undefined) onActiveChange?.(activeId, activeOffset);
  }, [activeId, activeOffset, onActiveChange]);

  // Scroll-trigger: when an unresolved lazy branch is in (or near) the window,
  // fetch its children. `ensureLazy` is idempotent / dedup'd, so re-running on
  // every window change is safe.
  useEffect(() => {
    if (ensureLazy === undefined) return;
    for (const { id } of items) {
      if (store.isLazy(id) && store.getLazyStatus(id) === 'unloaded') {
        ensureLazy(id);
      }
    }
  }, [items, store, ensureLazy, version]);

  const lastScrollToken = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (scrollRequest === undefined) return;
    if (scrollRequest.token === lastScrollToken.current) return;
    lastScrollToken.current = scrollRequest.token;
    const targetId = resolveContentId(scrollRequest.id);
    if (targetId !== undefined) scrollToId(targetId, scrollRequest.offset);
  }, [scrollRequest, scrollToId, resolveContentId]);

  // Book-level empty state: the whole (possibly search-replaced) tree has no
  // showable content node at all — an empty book, or a zero-result search. The
  // per-*section* empty state (`renderEmpty`) is unrelated: that is one node
  // whose fetched content came back empty.
  const noData = ids.length === 0;

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
