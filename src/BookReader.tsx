/**
 * Top-level component: the two-pane book reader, and the coordinator that makes
 * the panes move together (M6).
 *
 * Both panes read from one shared {@link createTreeStore} and *one* shared
 * {@link useTreeState} — lifting the tree state here is what lets reading drive
 * the tree and the tree drive reading:
 * - scrolling the {@link ContentPane} reports the node at the top of the viewport;
 *   that node is highlighted in the tree and its ancestors auto-expand (deepest
 *   level first), and it's surfaced as `location`/`onLocationChange`;
 * - approaching the bottom auto-loads the next lazy subtree so reading continues
 *   without a manual "next";
 * - clicking a tree node scrolls the reading surface to it.
 *
 * The bounded content cache (M4) and virtualization/stable-scroll (M5) layer
 * underneath unchanged.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react';
import { createContentCache, type ContentCache } from './core/cache';
import { createTreeStore } from './core/treeStore';
import { TreePaneView } from './tree/TreePane';
import { useTreeState } from './tree/useTreeState';
import { ContentPane, type ScrollRequest } from './content/ContentPane';
import type { BookLocation, BookReaderProps } from './types';

export function BookReader<Meta = unknown>(
  props: BookReaderProps<Meta>,
): JSX.Element {
  const {
    tree,
    loadChildren,
    fetchContent,
    cache: cacheConfig,
    prefetchCount,
    getNextNode,
    getPrevNode,
    location,
    defaultLocation,
    onLocationChange,
    treeSide = 'left',
    treeWidth = 320,
    sanitize,
    overscan,
    estimateHeight,
    className,
    classNames,
    renderTreeNode,
    renderContent,
    renderLoading,
    renderError,
    renderEmpty,
  } = props;

  // `tree` is the only structural input; rebuild the store only when it changes.
  const store = useMemo(
    () => createTreeStore<Meta>(tree !== undefined ? { tree } : {}),
    [tree],
  );

  // One cache per reader instance, shared across all content nodes. Config is
  // captured at mount (a fresh `cache={{…}}` literal each render must not wipe
  // the cache); a `useRef` keeps the instance stable for the component's life.
  const cacheRef = useRef<ContentCache<string>>();
  if (cacheRef.current === undefined) {
    cacheRef.current = createContentCache(cacheConfig);
  }
  const cache = cacheRef.current;

  // Reading position: the active node id (+ offset into it). Controlled when
  // `location` is provided, else internal (seeded from `defaultLocation`).
  const controlled = location !== undefined;
  const [internalLocation, setInternalLocation] = useState<
    BookLocation | undefined
  >(defaultLocation);
  const active = controlled ? location : internalLocation;
  const activeId = active?.nodeId;

  // What we last told the consumer, so a controlled `location` that's merely the
  // echo of our own scroll doesn't bounce the view back.
  const lastEmitted = useRef<BookLocation | undefined>(undefined);
  const emit = useCallback(
    (loc: BookLocation) => {
      lastEmitted.current = loc;
      onLocationChange?.(loc);
    },
    [onLocationChange],
  );

  // Imperative scroll-to-node request fed to the content pane (token retriggers).
  const tokenRef = useRef(0);
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest>();
  const requestScroll = useCallback((id: string, offset?: number) => {
    tokenRef.current += 1;
    setScrollRequest({ id, offset, token: tokenRef.current });
  }, []);

  // Navigate to a node (tree click / keyboard select): move the position and
  // scroll the reading surface to it.
  const goTo = useCallback(
    (id: string): void => {
      if (!controlled) setInternalLocation({ nodeId: id });
      emit({ nodeId: id });
      requestScroll(id);
    },
    [controlled, emit, requestScroll],
  );

  // Shared tree state: highlight follows the active node; clicks/keys select.
  const treeState = useTreeState<Meta>({
    store,
    loadChildren,
    selectedId: activeId,
    onSelect: goTo,
  });

  // Scroll → tree sync: the content pane reports the node at the viewport top.
  const handleActiveChange = useCallback(
    (id: string, offset: number): void => {
      if (!controlled) setInternalLocation({ nodeId: id, offset });
      emit({ nodeId: id, offset });
    },
    [controlled, emit],
  );

  // Auto-advance asks us to load the next lazy subtree (de-duped in the hook).
  const handleNeedNode = useCallback(
    (id: string): void => treeState.load(id),
    [treeState],
  );

  // Auto-expand the active reading path (deepest level first). Runs only when the
  // active node changes — not on every render — so it never fights a manual
  // collapse the reader makes while staying put. `expand` is read via a ref to
  // keep it out of the dependency list.
  const expandRef = useRef(treeState.expand);
  expandRef.current = treeState.expand;
  useEffect(() => {
    if (activeId === undefined) return;
    const path = store.getPath(activeId); // root → parent
    for (let i = path.length - 1; i >= 0; i--) {
      const ancestorId = path[i];
      if (ancestorId !== undefined) expandRef.current(ancestorId);
    }
  }, [activeId, store]);

  // Controlled `location` change (not an echo of our own scroll) → scroll to it.
  useEffect(() => {
    if (location === undefined) return;
    const e = lastEmitted.current;
    if (
      e !== undefined &&
      e.nodeId === location.nodeId &&
      (e.offset ?? 0) === (location.offset ?? 0)
    ) {
      return;
    }
    requestScroll(location.nodeId, location.offset);
  }, [location, requestScroll]);

  // Uncontrolled: honour `defaultLocation` once on mount.
  const startedAt = useRef(defaultLocation);
  useEffect(() => {
    if (controlled || startedAt.current === undefined) return;
    requestScroll(startedAt.current.nodeId, startedAt.current.offset);
    // Mount-only: a one-shot initial scroll honouring `defaultLocation`.
  }, [controlled, requestScroll]);

  const width = typeof treeWidth === 'number' ? `${treeWidth}px` : treeWidth;

  return (
    <div
      className={['br-reader', className, classNames?.root]
        .filter(Boolean)
        .join(' ')}
      data-part="book-reader"
      aria-label={props['aria-label'] ?? 'Book reader'}
      style={{
        display: 'flex',
        flexDirection: treeSide === 'right' ? 'row-reverse' : 'row',
      }}
    >
      <div
        className={['br-tree-pane', classNames?.tree].filter(Boolean).join(' ')}
        data-part="tree-pane"
        style={{ flex: `0 0 ${width}`, overflow: 'auto' }}
      >
        <TreePaneView
          store={store}
          state={treeState}
          renderTreeNode={renderTreeNode}
          treeNodeClassName={classNames?.treeNode}
        />
      </div>
      <div
        className={['br-content-pane', classNames?.content]
          .filter(Boolean)
          .join(' ')}
        data-part="content-pane"
        style={{ flex: '1 1 0', minWidth: 0, display: 'flex', overflow: 'hidden' }}
      >
        {/* ContentPane owns the scroll surface (virtualization needs to read its
            own scrollTop/clientHeight); this wrapper only sizes it. */}
        <ContentPane
          store={store}
          version={treeState.version}
          fetchContent={fetchContent}
          cache={cache}
          sanitize={sanitize}
          overscan={overscan}
          prefetchCount={prefetchCount}
          estimateHeight={estimateHeight}
          getNextNode={getNextNode}
          getPrevNode={getPrevNode}
          onActiveChange={handleActiveChange}
          onNeedNode={handleNeedNode}
          scrollRequest={scrollRequest}
          renderContent={renderContent}
          renderLoading={renderLoading}
          renderError={renderError}
          renderEmpty={renderEmpty}
          contentNodeClassName={classNames?.contentNode}
        />
      </div>
    </div>
  );
}
