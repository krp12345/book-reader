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

/** An imperative request to scroll a node to the top; `token` retriggers it. */
export interface ScrollRequest {
  id: string;
  offset?: number | undefined;
  token: number;
}

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
  /** Override the forward reading order (auto-advance "next node"). */
  getNextNode?: GetNextNode<Meta> | undefined;
  /** Override the backward reading order. */
  getPrevNode?: GetPrevNode<Meta> | undefined;
  /** Notified when the node at the top of the viewport changes (scroll → tree sync). */
  onActiveChange?: ((id: string, offset: number) => void) | undefined;
  /** Asked to load a lazy subtree so reading can continue past the loaded frontier. */
  onNeedNode?: ((id: string) => void) | undefined;
  /** Imperative scroll-to-node request (tree click / controlled location). */
  scrollRequest?: ScrollRequest | undefined;
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
    getNextNode,
    getPrevNode,
    onActiveChange,
    onNeedNode,
    scrollRequest,
  } = props;

  // Reading order reflects the store's *current* knowledge (override-aware) and
  // recomputes when lazy children land (signalled via `version`). `fullSeq`
  // includes organisational branches; `ids` (rendered) drops the no-content ones.
  const fullSeq = useMemo(() => {
    const order = withReadingOverrides(store, createReadingOrder(store), {
      getNextNode,
      getPrevNode,
    });
    return order.getSequence();
    // version drives recompute; the store mutates in place.
  }, [store, version, getNextNode, getPrevNode]);

  const ids = useMemo(
    () => fullSeq.filter((id) => store.getNode(id)?.hasContent !== false),
    [fullSeq, store],
  );

  // A clicked tree node may be an *organisational* branch (`hasContent: false`,
  // e.g. a Part/Chapter) that isn't in the rendered `ids` — scrolling to it would
  // be a silent no-op. Resolve such an id to the nearest content node in reading
  // order: its first content-bearing descendant, else the next content node at or
  // after it (descendants are contiguous after their parent in DFS order, so a
  // forward scan over `fullSeq` finds exactly that).
  const contentIds = useMemo(() => new Set(ids), [ids]);
  const resolveContentId = useCallback(
    (id: string): string | undefined => {
      if (contentIds.has(id)) return id;
      const from = fullSeq.indexOf(id);
      if (from === -1) return undefined;
      for (let i = from + 1; i < fullSeq.length; i++) {
        const candidate = fullSeq[i];
        if (candidate !== undefined && contentIds.has(candidate)) return candidate;
      }
      return undefined;
    },
    [contentIds, fullSeq],
  );

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

  // Scroll → tree sync: report the node at the top of the viewport.
  useEffect(() => {
    if (activeId !== undefined) onActiveChange?.(activeId, activeOffset);
  }, [activeId, activeOffset, onActiveChange]);

  // Auto-advance: when the reader nears the bottom (or the active node is itself a
  // not-yet-loaded subtree), ask the owner to fetch the next lazy subtree so the
  // reading order can grow. `load` de-dupes, so re-firing while in flight is safe.
  useEffect(() => {
    if (onNeedNode === undefined) return;
    const candidate = nextNodeToLoad(store, fullSeq, activeId);
    if (candidate !== undefined && (atBottom || candidate === activeId)) {
      onNeedNode(candidate);
    }
  }, [onNeedNode, store, fullSeq, activeId, atBottom]);

  // Imperative scroll-to (tree click / controlled location); `token` retriggers.
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
        // We do our own anchor correction (height map + correctScrollTop); the
        // browser's native scroll anchoring would compensate for the *same*
        // above-the-fold height change a second time → a double-correction jump.
        // Disable it so our correction is the single source of truth (and because
        // Safari has no overflow-anchor, the manual path must work everywhere).
        overflowAnchor: 'none',
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
