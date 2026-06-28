import { useCallback, useEffect, useMemo, useRef, type JSX } from 'react';
import type { ContentCache } from '../core/cache';
import type { TreeStore } from '../core/treeStore';
import { createReadingOrder } from '../core/traversal';
import { nextNodeToLoad, withReadingOverrides } from '../core/scrollSync';
import type {
  FetchContent,
  GetNextNode,
  GetPrevNode,
  RenderContent,
  RenderEmpty,
  RenderError,
  RenderLoading,
  SanitizeOption,
} from '../types';
import { ContentNode } from './ContentNode';
import { prefetchNodeContent } from './prefetchNodeContent';
import { useVirtualList } from './useVirtualList';

export interface ScrollRequest {
  id: string;
  offset?: number | undefined;
  token: number;
}

export interface ContentPaneProps<Meta = unknown, Content = string> {
  store: TreeStore<Meta>;
  fetchContent: FetchContent<Meta, Content>;
  version?: number | undefined;
  sanitize?: SanitizeOption | undefined;
  cache?: ContentCache<Content> | undefined;
  overscan?: number | undefined;
  prefetchCount?: number | undefined;
  estimateHeight?: number | undefined;
  getNextNode?: GetNextNode<Meta> | undefined;
  getPrevNode?: GetPrevNode<Meta> | undefined;
  onActiveChange?: ((id: string, offset: number) => void) | undefined;
  onNeedNode?: ((id: string) => void) | undefined;
  scrollRequest?: ScrollRequest | undefined;
  renderContent?: RenderContent<Meta, Content> | undefined;
  renderLoading?: RenderLoading<Meta> | undefined;
  renderError?: RenderError<Meta> | undefined;
  renderEmpty?: RenderEmpty<Meta> | undefined;
  className?: string | undefined;
  contentNodeClassName?: string | undefined;
  'aria-label'?: string | undefined;
}

export function ContentPane<Meta = unknown, Content = string>(
  props: ContentPaneProps<Meta, Content>,
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
    getNextNode,
    getPrevNode,
    onActiveChange,
    onNeedNode,
    scrollRequest,
  } = props;

  const fullSeq = useMemo(() => {
    const order = withReadingOverrides(store, createReadingOrder(store), {
      getNextNode,
      getPrevNode,
    });
    return order.getSequence();
  }, [store, version, getNextNode, getPrevNode]);

  const ids = useMemo(
    () => fullSeq.filter((id) => store.getNode(id)?.hasContent !== false),
    [fullSeq, store],
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
    atBottom,
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

  useEffect(() => {
    if (onNeedNode === undefined) return;
    const candidate = nextNodeToLoad(store, fullSeq, activeId);
    if (candidate !== undefined && (atBottom || candidate === activeId)) {
      onNeedNode(candidate);
    }
  }, [onNeedNode, store, fullSeq, activeId, atBottom]);

  const lastScrollToken = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (scrollRequest === undefined) return;
    if (scrollRequest.token === lastScrollToken.current) return;
    lastScrollToken.current = scrollRequest.token;
    const targetId = resolveContentId(scrollRequest.id);
    if (targetId !== undefined) scrollToId(targetId, scrollRequest.offset);
  }, [scrollRequest, scrollToId, resolveContentId]);

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
      }}
    >
      {}
      <div
        data-part="content-spacer-top"
        style={{ height: paddingTop }}
        aria-hidden
      />
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
