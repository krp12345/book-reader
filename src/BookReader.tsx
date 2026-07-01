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
import { TreeSearch } from './tree/TreeSearch';
import { TreeOverlay } from './tree/TreeOverlay';
import { useTreeState } from './tree/useTreeState';
import { useLazyChildren } from './useLazyChildren';
import { ContentPane, type ScrollRequest } from './content/ContentPane';
import { lengthToPx, useElementWidth } from './useReaderWidth';
import type {
  BookLocation,
  BookNode,
  BookReaderProps,
  SearchContext,
  TreeToggleApi,
} from './types';

export function BookReader<Meta = unknown, Content = string>(
  props: BookReaderProps<Meta, Content>,
): JSX.Element {
  const {
    tree,
    fetchContent,
    fetchChildren,
    showSearch = false,
    onSearch,
    onReset,
    searchPlaceholder,
    renderSearch,
    cache: cacheConfig,
    prefetchCount,
    getNextNode,
    getPrevNode,
    location,
    defaultLocation,
    onLocationChange,
    treeSide = 'left',
    treeWidth = 320,
    contentMinWidth = 360,
    collapseTree = 'auto',
    treeCollapseLabel = 'Contents',
    treeOverlayMinWidth = 240,
    treeOverlayMinHeight = 200,
    renderTreeToggle,
    renderTreeOverlay,
    sanitize,
    overscan,
    estimateHeight,
    className,
    classNames,
    renderTreeNode,
    renderExpandCollapse,
    renderContent,
    renderContentNode,
    renderLoading,
    renderError,
    renderEmpty,
  } = props;

  const store = useMemo(
    () => createTreeStore<Meta>(tree !== undefined ? { tree } : {}),
    [tree],
  );

  const cacheRef = useRef<ContentCache<Content>>();
  if (cacheRef.current === undefined) {
    cacheRef.current = createContentCache<Content>(cacheConfig);
  }
  const cache = cacheRef.current;

  // Lazy-tree orchestration: fetch `lazy` nodes' children on demand (driven by
  // tree expand below and by the reading surface scrolling to them).
  const { ensure: ensureLazy, ensureAsync } = useLazyChildren<Meta>(
    store,
    fetchChildren,
  );

  // Search/reset (tree replacement) state.
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<unknown>(undefined);
  const searchAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => searchAbortRef.current?.abort(), []);

  const controlled = location !== undefined;
  const [internalLocation, setInternalLocation] = useState<
    BookLocation | undefined
  >(defaultLocation);
  const active = controlled ? location : internalLocation;
  const activeId = active?.nodeId;

  const recentEmits = useRef<BookLocation[]>([]);
  const emit = useCallback(
    (loc: BookLocation) => {
      const trail = recentEmits.current;
      trail.push(loc);
      if (trail.length > 12) trail.shift();
      onLocationChange?.(loc);
    },
    [onLocationChange],
  );

  const tokenRef = useRef(0);
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest>();
  const requestScroll = useCallback((id: string, offset?: number) => {
    tokenRef.current += 1;
    setScrollRequest({ id, offset, token: tokenRef.current });
  }, []);

  // Responsive collapse: when the reader is too narrow to fit the tree *and*
  // the reading-surface floor, the tree collapses to a toggle that opens a
  // floated overlay (reading width wins). The overlay reuses the shared tree
  // state, so selection/expansion stay in sync with the inline tree.
  const [rootRef, rootWidth] = useElementWidth<HTMLDivElement>();
  // The floated tree overlay owns its open/closed state internally.
  const [overlayOpen, setOverlayOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const treeWidthPx = lengthToPx(treeWidth);
  const contentMinWidthPx = lengthToPx(contentMinWidth);
  const forceCollapsed = collapseTree === true || collapseTree === 'always';
  const forceExpanded = collapseTree === false || collapseTree === 'never';
  const collapsed =
    forceCollapsed ||
    (!forceExpanded &&
      rootWidth > 0 &&
      rootWidth - treeWidthPx < contentMinWidthPx);

  const openOverlay = useCallback(() => {
    returnFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    setOverlayOpen(true);
  }, [setOverlayOpen]);
  const closeOverlay = useCallback(
    () => setOverlayOpen(false),
    [setOverlayOpen],
  );

  // A widened reader stops being collapsed — don't leave a popover orphaned open.
  useEffect(() => {
    if (!collapsed && overlayOpen) setOverlayOpen(false);
  }, [collapsed, overlayOpen, setOverlayOpen]);

  // Assigned from treeState.expand below (treeState needs `goTo`, so the ref
  // breaks the cycle). Lets `goTo` open the tree without a forward reference.
  const expandRef = useRef<(id: string) => void>(() => {});

  const goTo = useCallback(
    (id: string): void => {
      if (!controlled) setInternalLocation({ nodeId: id });
      emit({ nodeId: id });
      requestScroll(id);
      // Navigating *onto* a branch opens its own children, so selecting a Part
      // reveals its sections. This is driven by explicit navigation (a tree
      // click), not the scroll-derived active node — so the top of the book is
      // never auto-dumped on load.
      if (store.isExpandable(id)) expandRef.current(id);
      // Selecting a section from the floated tree navigates and dismisses it.
      if (overlayOpen) setOverlayOpen(false);
    },
    [controlled, emit, requestScroll, store, overlayOpen, setOverlayOpen],
  );

  const treeState = useTreeState<Meta>({
    store,
    selectedId: activeId,
    onSelect: goTo,
    onExpand: ensureLazy,
  });

  const handleActiveChange = useCallback(
    (id: string, offset: number): void => {
      if (!controlled) setInternalLocation({ nodeId: id, offset });
      emit({ nodeId: id, offset });
    },
    [controlled, emit],
  );

  expandRef.current = treeState.expand;
  useEffect(() => {
    if (activeId === undefined) return;
    // Reveal the active node by opening its ancestors (deepest-first). The active
    // *branch's own* children are opened on explicit navigation in `goTo`, not
    // here, so a scroll-derived active change never auto-expands the tree.
    const path = store.getPath(activeId);
    for (let i = path.length - 1; i >= 0; i--) {
      const ancestorId = path[i];
      if (ancestorId !== undefined) expandRef.current(ancestorId);
    }
  }, [activeId, store]);

  useEffect(() => {
    if (location === undefined) return;
    const isEcho = recentEmits.current.some(
      (e) =>
        e.nodeId === location.nodeId &&
        (e.offset ?? 0) === (location.offset ?? 0),
    );
    if (isEcho) return;
    requestScroll(location.nodeId, location.offset);
  }, [location, requestScroll]);

  const startedAt = useRef(defaultLocation);
  useEffect(() => {
    if (controlled || startedAt.current === undefined) return;
    requestScroll(startedAt.current.nodeId, startedAt.current.offset);
  }, [controlled, requestScroll]);

  // After a search/reset replaces the tree, take the reader to "the first page":
  // descend the leftmost path (resolving lazy branches along the way) until the
  // first node that actually carries content, and navigate there.
  const gotoFirstShowable = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      let id: string | undefined = store.getRootIds()[0];
      const seen = new Set<string>();
      while (id !== undefined && !seen.has(id)) {
        seen.add(id);
        if (signal.aborted) return;
        const node = store.getNode(id);
        if (node === undefined) break;
        if (node.hasContent !== false) {
          goTo(id);
          return;
        }
        // A pure organisational branch — descend into it, resolving lazily first.
        if (store.isLazy(id) && store.getLazyStatus(id) !== 'loaded') {
          try {
            await ensureAsync(id);
          } catch {
            break;
          }
          if (signal.aborted) return;
        }
        id = store.getChildren(id)?.[0];
      }
      const first = store.getRootIds()[0];
      if (first !== undefined) goTo(first);
    },
    [store, goTo, ensureAsync],
  );

  const runReplace = useCallback(
    (produce: (ctx: SearchContext) => ReturnType<NonNullable<typeof onSearch>>) => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      const { signal } = controller;

      setSearching(true);
      setSearchError(undefined);

      void (async () => {
        try {
          const next = await produce({ signal });
          if (signal.aborted) return;
          // Clear the old tree and reading position, then resolve the first page.
          if (!controlled) setInternalLocation(undefined);
          store.replaceTree(next as BookNode<Meta> | BookNode<Meta>[]);
          await gotoFirstShowable(signal);
        } catch (error) {
          if (!signal.aborted) setSearchError(error);
        } finally {
          if (!signal.aborted) setSearching(false);
        }
      })();
    },
    [controlled, store, gotoFirstShowable],
  );

  const handleSearch = useCallback(
    (query: string) => {
      if (onSearch === undefined) return;
      runReplace((ctx) => onSearch(query, ctx));
    },
    [onSearch, runReplace],
  );

  const handleReset = useCallback(() => {
    if (onReset === undefined) return;
    runReplace((ctx) => onReset(ctx));
  }, [onReset, runReplace]);

  const searchVisible = showSearch && onSearch !== undefined;

  const width = typeof treeWidth === 'number' ? `${treeWidth}px` : treeWidth;
  const overlayMinWidth =
    typeof treeOverlayMinWidth === 'number'
      ? `${treeOverlayMinWidth}px`
      : treeOverlayMinWidth;
  const overlayMinHeight =
    typeof treeOverlayMinHeight === 'number'
      ? `${treeOverlayMinHeight}px`
      : treeOverlayMinHeight;

  // The wired tree — shared by the inline pane and the floated overlay so both
  // reflect the same selection/expansion state. The optional search box sits on
  // top; while a search/reset runs the old tree is replaced by a loading panel.
  const treeView = (
    <>
      {searchVisible && (
        <TreeSearch
          onSearch={handleSearch}
          onReset={onReset !== undefined ? handleReset : undefined}
          isSearching={searching}
          error={searchError}
          placeholder={searchPlaceholder}
          renderSearch={renderSearch}
          className={classNames?.search}
        />
      )}
      {searching ? (
        <p className="br-tree-loading" data-part="tree-loading">
          Loading…
        </p>
      ) : (
        <TreePaneView
          store={store}
          state={treeState}
          renderTreeNode={renderTreeNode}
          renderExpandCollapse={renderExpandCollapse}
          onRetryLazy={ensureLazy}
          treeNodeClassName={classNames?.treeNode}
        />
      )}
    </>
  );

  const toggleApi: TreeToggleApi = {
    isOpen: overlayOpen,
    open: openOverlay,
    close: closeOverlay,
    toggle: () => (overlayOpen ? closeOverlay() : openOverlay()),
    label: treeCollapseLabel,
  };

  return (
    <div
      ref={rootRef}
      className={['br-reader', className, classNames?.root]
        .filter(Boolean)
        .join(' ')}
      data-part="book-reader"
      aria-label={props['aria-label'] ?? 'Book reader'}
      style={{
        // Fill the height the consumer gives the reader (e.g. a sized wrapper),
        // so the content pane becomes a *bounded* scroll viewport — which is what
        // lets virtualization engage and the two panes scroll independently. With
        // an auto-height parent this resolves to auto (fine for tiny inline books).
        height: '100%',
        display: 'flex',
        // Collapsed → stack the toggle above the reading surface (a column);
        // otherwise the two panes sit side-by-side.
        flexDirection: collapsed
          ? 'column'
          : treeSide === 'right'
            ? 'row-reverse'
            : 'row',
      }}
    >
      {!collapsed && (
        <div
          className={['br-tree-pane', classNames?.tree]
            .filter(Boolean)
            .join(' ')}
          data-part="tree-pane"
          style={{ flex: `0 0 ${width}`, overflow: 'auto' }}
        >
          {treeView}
        </div>
      )}
      {/* Collapsed: the tree reduces to a toggle row stacked above the reading
          surface (it never overlaps the text), with the tree popover anchored
          beneath it. position:relative makes this bar the popover's anchor. */}
      {collapsed && (
        <div
          data-part="tree-toggle-bar"
          style={{
            flex: '0 0 auto',
            position: 'relative',
            display: 'flex',
            justifyContent: treeSide === 'right' ? 'flex-end' : 'flex-start',
          }}
        >
          {renderTreeToggle ? (
            renderTreeToggle(toggleApi)
          ) : (
            <button
              type="button"
              data-part="tree-toggle"
              className={['br-tree-toggle', classNames?.treeToggle]
                .filter(Boolean)
                .join(' ')}
              aria-haspopup="dialog"
              aria-expanded={overlayOpen}
              onClick={toggleApi.toggle}
            >
              {treeCollapseLabel}
            </button>
          )}
          {overlayOpen &&
            (renderTreeOverlay ? (
              renderTreeOverlay({ close: closeOverlay, children: treeView })
            ) : (
              <TreeOverlay
                onClose={closeOverlay}
                returnFocusTo={returnFocusRef.current}
                treeSide={treeSide}
                width={width}
                minWidth={overlayMinWidth}
                minHeight={overlayMinHeight}
                className={['br-tree-overlay', classNames?.treeOverlay]
                  .filter(Boolean)
                  .join(' ')}
              >
                {treeView}
              </TreeOverlay>
            ))}
        </div>
      )}
      <div
        className={['br-content-pane', classNames?.content]
          .filter(Boolean)
          .join(' ')}
        data-part="content-pane"
        style={{
          flex: '1 1 0',
          minWidth: 0,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* ContentPane owns the scroll surface (virtualization needs to read its
            own scrollTop/clientHeight); this wrapper only sizes it. While a
            search/reset runs, the old reading surface is replaced by a loading
            panel (the new tree's first page resolves before it remounts). */}
        {searching ? (
          <p
            className="br-content__loading"
            data-part="content-loading"
            style={{ margin: 'auto' }}
          >
            Loading…
          </p>
        ) : (
          <ContentPane
            store={store}
            fetchContent={fetchContent}
            cache={cache}
            sanitize={sanitize}
            overscan={overscan}
            prefetchCount={prefetchCount}
            estimateHeight={estimateHeight}
            getNextNode={getNextNode}
            getPrevNode={getPrevNode}
            onActiveChange={handleActiveChange}
            ensureLazy={ensureLazy}
            scrollRequest={scrollRequest}
            renderContent={renderContent}
            renderContentNode={renderContentNode}
            renderLoading={renderLoading}
            renderError={renderError}
            renderEmpty={renderEmpty}
            contentNodeClassName={classNames?.contentNode}
          />
        )}
      </div>
    </div>
  );
}
