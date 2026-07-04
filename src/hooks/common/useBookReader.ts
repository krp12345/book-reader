import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createContentCache, type ContentCache } from '../../core/content/cache';
import { createTreeStore } from '../../core/tree/treeStore';
import { findFirstShowable, resolveToNode } from '../../core/tree/traversal';
import { useTreeState } from '../tree/useTreeState';
import { useLazyChildren } from '../tree/useLazyChildren';
import { useElementWidth } from './useElementWidth';
import { toCssLength } from '../../utils/common/length';
import { shouldCollapseTree } from '../../utils/tree/collapse';
import type {
  BookLocation,
  BookNode,
  BookReaderProps,
  ScrollRequest,
  SearchContext,
  TreeToggleApi,
} from '../../types';
import type { BookReaderState } from '../../types/hooks';

export type { BookReaderState } from '../../types/hooks';

/**
 * All of `<BookReader>`'s behavior: store + cache ownership, lazy-children
 * orchestration, controlled/uncontrolled `location` with echo-guarded emits,
 * abortable deep-link navigation, search/reset tree replacement (with
 * first-page resolution), responsive tree collapse, and the overlay's
 * open/close state. The component itself only renders.
 */
export function useBookReader<Meta = unknown, Content = string>(
  props: BookReaderProps<Meta, Content>,
): BookReaderState<Meta, Content> {
  const {
    tree,
    fetchChildren,
    fetchPath,
    showSearch = false,
    onSearch,
    onReset,
    cache: cacheConfig,
    location,
    defaultLocation,
    onLocationChange,
    treeWidth = 320,
    contentMinWidth = 360,
    collapseTree = 'auto',
    treeCollapseLabel = 'Contents',
    treeOverlayMinWidth = 240,
    treeOverlayMinHeight = 200,
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

  // Abortable navigation: scroll to a node, first resolving any unfetched `lazy`
  // branch that hides it (deep-link support). A node already in the tree — e.g. a
  // tree click, or plain in-book navigation — scrolls synchronously; only a real
  // deep-link into an unresolved branch goes async, walking `path`/`fetchPath`
  // ancestry via `resolveToNode`. A superseding navigation aborts the in-flight
  // resolve so a stale target can't yank the view after the user moved on.
  const navAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => navAbortRef.current?.abort(), []);
  const requestScrollResolved = useCallback(
    (id: string, offset?: number, path?: string[]) => {
      navAbortRef.current?.abort();
      if (store.getNode(id) !== undefined) {
        requestScroll(id, offset);
        return;
      }
      const controller = new AbortController();
      navAbortRef.current = controller;
      void (async () => {
        const ok = await resolveToNode(store, id, {
          ensureAsync,
          fetchPath,
          path,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (ok) requestScroll(id, offset);
      })();
    },
    [store, ensureAsync, fetchPath, requestScroll],
  );

  // Responsive collapse: when the reader is too narrow to fit the tree *and*
  // the reading-surface floor, the tree collapses to a toggle that opens a
  // floated overlay (reading width wins). The overlay reuses the shared tree
  // state, so selection/expansion stay in sync with the inline tree.
  const [rootRef, rootWidth] = useElementWidth<HTMLDivElement>();
  // The floated tree overlay owns its open/closed state internally.
  const [overlayOpen, setOverlayOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const collapsed = shouldCollapseTree({
    collapseTree,
    rootWidth,
    treeWidth,
    contentMinWidth,
  });

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
      requestScrollResolved(id);
      // Navigating *onto* a branch opens its own children, so selecting a Part
      // reveals its sections. This is driven by explicit navigation (a tree
      // click), not the scroll-derived active node — so the top of the book is
      // never auto-dumped on load.
      if (store.isExpandable(id)) expandRef.current(id);
      // Selecting a section from the floated tree navigates and dismisses it.
      if (overlayOpen) setOverlayOpen(false);
    },
    [controlled, emit, requestScrollResolved, store, overlayOpen, setOverlayOpen],
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
    requestScrollResolved(location.nodeId, location.offset, location.path);
  }, [location, requestScrollResolved]);

  const startedAt = useRef(defaultLocation);
  useEffect(() => {
    if (controlled || startedAt.current === undefined) return;
    requestScrollResolved(
      startedAt.current.nodeId,
      startedAt.current.offset,
      startedAt.current.path,
    );
  }, [controlled, requestScrollResolved]);

  // After a search/reset replaces the tree, take the reader to "the first page"
  // (the walk itself — leftmost descent with lazy resolution — lives in
  // `core/traversal.findFirstShowable`).
  const gotoFirstShowable = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      const target = await findFirstShowable(store, { ensureAsync, signal });
      if (!signal.aborted && target !== undefined) goTo(target);
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

  const toggleApi: TreeToggleApi = {
    isOpen: overlayOpen,
    open: openOverlay,
    close: closeOverlay,
    toggle: () => (overlayOpen ? closeOverlay() : openOverlay()),
    label: treeCollapseLabel,
  };

  return {
    store,
    cache,
    treeState,
    ensureLazy,
    searching,
    searchError,
    handleSearch,
    handleReset,
    searchVisible: showSearch && onSearch !== undefined,
    scrollRequest,
    handleActiveChange,
    rootRef,
    collapsed,
    overlayOpen,
    closeOverlay,
    toggleApi,
    returnFocusEl: returnFocusRef.current,
    width: toCssLength(treeWidth),
    overlayMinWidth: toCssLength(treeOverlayMinWidth),
    overlayMinHeight: toCssLength(treeOverlayMinHeight),
  };
}
