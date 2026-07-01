/**
 * book-reader demo — a single app with an example switcher.
 *
 * Each tab is a focused, self-contained scenario:
 *   1. Quickstart  — a small inline (sync) book, the minimal usage.
 *   2. Branch      — branch nodes that carry their own content.
 *   3. Lazy & search — `lazy` branches fetched on demand (`fetchChildren`) by
 *                    expand *or* scroll; search/reset replace the whole tree; a
 *                    live fetch-inspector sidecar; default + custom search box.
 *   4. Styling     — the three styling tiers + a controlled `location`.
 *   5. Responsive  — width-driven tree collapse into a floated overlay.
 *   6. Object      — a generic (non-string) structured content payload.
 *   7. Render hooks— custom expand/collapse caret + custom content-node wrapper.
 *   8. Selection   — `renderContentNode` captures the user's text selection and
 *                    sends it out over a decoupled channel; an outside button
 *                    reads it back (some sections are deliberately unselectable).
 *
 * Book data is generated with faker (see `data.ts`) — realistic prose, but
 * deterministic. Section *bodies* still load lazily via `fetchContent`.
 */
import {
  StrictMode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BookReader, VERSION } from '../src/index';
import type {
  BookLocation,
  BookNode,
  BookReaderClassNames,
  BookReaderProps,
  ContentNodeWrapperProps,
  ContentStatus,
  RenderContent,
  RenderContentNode,
  RenderEmpty,
  RenderError,
  RenderExpandCollapse,
  RenderLoading,
  RenderSearch,
  RenderTreeNode,
  RenderTreeOverlay,
  RenderTreeToggle,
} from '../src/index';
import {
  makeBranchContentBook,
  makeFetchContent,
  makeLargeBook,
  makeLazyBook,
  makeLazyFetchChildren,
  makeLazyFetchContent,
  makeLazyReset,
  makeLazySearch,
  makeObjectFetchContent,
  makeSelectionBook,
  makeSyncBook,
  type RichSection,
  type SelectionMeta,
} from './data';
import { fetchBus, type FetchEvent } from './fetchBus';
import {
  selectionBus,
  type SelMenu,
  type StagedSelection,
} from './selectionBus';
import { applyHighlights, pointOffset } from './highlight';
// The default skin (tier 1). A consumer writes zero CSS and imports just this.
import '../src/styles/book-reader.css';
// Demo-only styles: the themed (token-override) and fully-custom skins + chrome.
import './demo.css';

// Books are deterministic — generate each once.
const syncBook = makeSyncBook();
const largeBook = makeLargeBook();
const branchBook = makeBranchContentBook();
const selectionBook = makeSelectionBook();
const lazyBook = makeLazyBook();

// Lazy example: content + children fetchers, and search/reset tree producers.
const fetchLazyContent = makeLazyFetchContent();
const fetchLazyChildren = makeLazyFetchChildren();
const lazySearch = makeLazySearch();
const lazyReset = makeLazyReset();
const fetchSelection = makeFetchContent<SelectionMeta>({ delayMs: 120 });

// Per-example fetchers (see data.ts). States stages slow + failing + empty nodes.
const fetchSync = makeFetchContent();
const fetchBranch = makeFetchContent({ delayMs: 200 });
const fetchStyling = makeFetchContent({ delayMs: 150 });
const fetchObject = makeObjectFetchContent(200);

// --- Tier 2 + 3: a fully bespoke skin that owns its markup -------------------
const customClassNames: BookReaderClassNames = {
  root: 'cs-root',
  tree: 'cs-tree',
  treeNode: 'cs-row',
  content: 'cs-content',
  contentNode: 'cs-node',
};
const renderTreeNode: RenderTreeNode = (node, state) => (
  <span className="cs-label">
    {state.expandable ? (state.expanded ? '📂' : '📁') : '📄'} {node.title}
  </span>
);
const renderContent: RenderContent = (_node, html) => (
  <div className="cs-body" dangerouslySetInnerHTML={{ __html: html }} />
);
const renderLoading: RenderLoading = () => <div className="cs-loading">▌ loading…</div>;
const renderError: RenderError = (_node, _error, retry) => (
  <div className="cs-error">
    ✗ fetch failed
    <button type="button" onClick={retry}>
      retry
    </button>
  </div>
);
const renderEmpty: RenderEmpty = () => <div className="cs-empty">— no content —</div>;

// --- M9: generic (object) content payload ------------------------------------
// `fetchContent` returns a structured `RichSection`; this consumer-owned
// `renderContent` is fully typed against it. No HTML string, no sanitize, no
// dangerouslySetInnerHTML — the reader just stores + windows the object and
// hands it back here to render.
const renderObjectContent: RenderContent<unknown, RichSection> = (_node, section) => (
  <div className="obj-section">
    <header className="obj-head">
      <h2>{section.heading}</h2>
      <p className="obj-meta">
        <span className="obj-time">⏱ {section.readingTime} min read</span>
        {section.tags.map((t) => (
          <span key={t} className="obj-tag">
            {t}
          </span>
        ))}
      </p>
    </header>
    {section.callout && <aside className="obj-callout">{section.callout}</aside>}
    {section.paragraphs.map((p, i) => (
      <p key={i} className="obj-para">
        {p}
      </p>
    ))}
  </div>
);

// --- Responsive tree-collapse demo: custom toggle + custom overlay -----------
const respRenderTreeToggle: RenderTreeToggle = ({ isOpen, toggle, label }) => (
  <button
    type="button"
    className="resp-toggle"
    aria-haspopup="dialog"
    aria-expanded={isOpen}
    onClick={toggle}
  >
    ☰ {label}
  </button>
);
const respRenderTreeOverlay: RenderTreeOverlay = ({ close, children }) => (
  <div className="resp-overlay-backdrop" onClick={close}>
    <div
      className="resp-overlay-card"
      role="dialog"
      aria-modal="true"
      aria-label="Book sections"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="resp-overlay-head">
        <strong>Jump to a section</strong>
        <button type="button" onClick={close} aria-label="Close">
          ✕
        </button>
      </header>
      <div className="resp-overlay-body">{children}</div>
    </div>
  </div>
);

// --- M9: render hooks (custom caret + custom content-node wrapper) -----------
// `renderExpandCollapse` replaces *only* the disclosure control; the library
// keeps the row wrapper, aria-expanded, and keyboard nav. A +/− button here,
// with a dot for leaves. (stopPropagation so it doesn't also select the row.)
const renderPlusMinus: RenderExpandCollapse = ({
  expandable,
  expanded,
  toggle,
}) =>
  expandable ? (
    <button
      type="button"
      className="rh-caret"
      aria-hidden="true"
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
    >
      {expanded ? '−' : '+'}
    </button>
  ) : (
    <span className="rh-caret rh-caret--leaf" aria-hidden="true">
      •
    </span>
  );

// `renderContentNode` owns the *wrapper* element. Spread `wrapperProps` (incl.
// the measurement `ref` virtualization needs) onto your own tag, then decorate
// around the rendered `children`. Here: a <section> with a status badge.
const renderSectionWrapper: RenderContentNode<unknown, string> = ({
  state,
  wrapperProps,
  children,
}) => (
  <section {...wrapperProps}>
    <div className="rh-node-badge" aria-hidden="true">
      {state.status}
    </div>
    {children}
  </section>
);

// --- Example 7: text selection → staging channel -----------------------------
// A few sections are deliberately *not* selectable, decided purely from the node
// id (the trailing section number). In practice locked sections are rare, so we
// make them stand out by *highlighting* the text rather than just dimming it.
// This proves a per-node policy lives entirely in the consumer's
// `renderContentNode`.
function isSelectable(nodeId: string): boolean {
  const match = /\.s(\d+)$/.exec(nodeId);
  const n = match ? Number(match[1]) : 0;
  return n % 8 !== 0; // ~1 in 8 sections is locked (rare, on purpose)
}

// The per-node content component. It owns the wrapper element (spreads
// `wrapperProps`, incl. the measurement `ref`) and:
//   - on **right-click (context menu)**, decides the action set from state: over
//     an already-staged highlight → offer *Unstage*; over a fresh selection →
//     offer *Stage* / *Deselect*. It captures the selection's character range +
//     text + the node's id/title/`meta` (proof `renderContentNode` gets full node
//     metadata) and opens the menu via `selectionBus`.
//   - on every (re)mount and whenever this node's staged set changes, re-paints
//     persistent highlights via `applyHighlights`. This is what makes staged
//     highlights survive virtualization: when a section scrolls out its DOM is
//     destroyed, and when it scrolls back this effect restores the marks from
//     the durable `selectionBus` ranges.
function SelectableContentNode({
  node,
  wrapperProps,
  status,
  children,
}: {
  node: BookNode<SelectionMeta>;
  wrapperProps: ContentNodeWrapperProps;
  status: ContentStatus;
  children: ReactNode;
}): JSX.Element {
  const selectable = isSelectable(node.id);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [ranges, setRanges] = useState(() => selectionBus.rangesFor(node.id));

  // Keep this node's highlight ranges in sync with the staged set.
  useEffect(
    () =>
      selectionBus.subscribe(() => setRanges(selectionBus.rangesFor(node.id))),
    [node.id],
  );

  // Re-paint after the body is in the DOM — on mount/remount (status), and on
  // any change to this node's ranges (stage/unstage).
  useLayoutEffect(() => {
    if (bodyRef.current) applyHighlights(bodyRef.current, ranges);
  }, [ranges, status]);

  return (
    <article
      {...wrapperProps}
      className={`${wrapperProps.className ?? ''} sel-node${selectable ? '' : ' sel-node--locked'}`}
      onContextMenu={
        selectable
          ? (e) => {
              // 1) Right-click *on* a staged highlight → offer Unstage.
              const mark = (e.target as HTMLElement).closest?.(
                'mark[data-sel-highlight]',
              );
              const stagedId = mark?.getAttribute('data-sel-id') ?? undefined;
              if (stagedId !== undefined) {
                e.preventDefault();
                selectionBus.openMenu({
                  kind: 'staged',
                  x: e.clientX,
                  y: e.clientY,
                  stagedId,
                });
                return;
              }
              // 2) Right-click over a fresh selection → offer Stage / Deselect.
              const sel = window.getSelection();
              const body = bodyRef.current;
              if (!sel || sel.isCollapsed || !body) return;
              const text = sel.toString().trim();
              const range = sel.getRangeAt(0);
              if (
                !text ||
                !body.contains(range.startContainer) ||
                !body.contains(range.endContainer)
              )
                return;
              const start = pointOffset(body, range.startContainer, range.startOffset);
              const end = pointOffset(body, range.endContainer, range.endOffset);
              if (end <= start) return;
              e.preventDefault();
              selectionBus.openMenu({
                kind: 'fresh',
                x: e.clientX,
                y: e.clientY,
                selection: {
                  nodeId: node.id,
                  nodeTitle: node.title,
                  category: node.meta?.category ?? '—',
                  text,
                  start,
                  end,
                },
              });
            }
          : undefined
      }
    >
      <div className="sel-node-badge" aria-hidden="true">
        {selectable
          ? '✏️ selectable — drag to highlight, then Stage'
          : '🔒 not selectable'}
      </div>
      <div className="sel-body" ref={bodyRef}>
        {children}
      </div>
    </article>
  );
}

const renderSelectableNode: RenderContentNode<SelectionMeta, string> = ({
  node,
  state,
  wrapperProps,
  children,
}) => (
  <SelectableContentNode node={node} wrapperProps={wrapperProps} status={state.status}>
    {children}
  </SelectableContentNode>
);

// --- Lazy & search: the on-screen fetch inspector ----------------------------
// A sidecar panel that renders every fetchContent / fetchChildren / search /
// reset call live off `fetchBus` — so you can *see* the lazy loading and the
// tree-replacement happening without opening devtools. Pure demo glue.
function FetchInspector(): JSX.Element {
  const [events, setEvents] = useState<FetchEvent[]>([]);
  useEffect(() => fetchBus.subscribe(setEvents), []);

  const counts = useMemo(() => {
    const c = { content: 0, children: 0, search: 0, reset: 0 };
    for (const e of events) if (e.phase === 'ok') c[e.kind] += 1;
    return c;
  }, [events]);

  return (
    <aside className="fetch-inspector" aria-label="Fetch activity">
      <header className="fi-head">
        <strong>Fetch activity</strong>
        <button type="button" className="fi-clear" onClick={() => fetchBus.clear()}>
          Clear
        </button>
      </header>
      <div className="fi-counts">
        <span className="fi-count" data-kind="content">
          content <b>{counts.content}</b>
        </span>
        <span className="fi-count" data-kind="children">
          children <b>{counts.children}</b>
        </span>
        <span className="fi-count" data-kind="search">
          search <b>{counts.search}</b>
        </span>
        <span className="fi-count" data-kind="reset">
          reset <b>{counts.reset}</b>
        </span>
      </div>
      <ol className="fi-log">
        {events.length === 0 && (
          <li className="fi-empty">
            No fetches yet. Expand a branch, scroll, or run a search.
          </li>
        )}
        {events.map((e) => (
          <li key={e.seq} className={`fi-row fi-${e.phase}`}>
            <span className="fi-kind" data-kind={e.kind}>
              {e.kind}
            </span>
            <code className="fi-label" title={e.label}>
              {e.label}
            </code>
            <span className="fi-phase">
              {e.phase}
              {e.ms !== undefined ? ` · ${e.ms}ms` : ''}
              {e.detail ? ` · ${e.detail}` : ''}
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

// Advanced: a fully custom search box (the `renderSearch` prop). The library
// still owns the tree-replacement + first-page resolution; this only owns the
// control UI. No result list — search *replaces* the tree.
const renderCustomSearch: RenderSearch = ({
  query,
  setQuery,
  submit,
  reset,
  isSearching,
  canReset,
}) => (
  <div className="cs-search" data-searching={isSearching || undefined}>
    <span className="cs-search-icon" aria-hidden="true">
      🔎
    </span>
    <input
      className="cs-search-input"
      value={query}
      placeholder="custom search box…"
      aria-label="Search the book"
      disabled={isSearching}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submit();
      }}
    />
    <button type="button" className="cs-search-go" onClick={submit} disabled={isSearching}>
      {isSearching ? '…' : 'Go'}
    </button>
    {canReset && (
      <button
        type="button"
        className="cs-search-reset"
        onClick={reset}
        disabled={isSearching}
        aria-label="Reset search"
      >
        ↺
      </button>
    )}
  </div>
);

type RespMode = 'default' | 'custom-toggle' | 'custom-overlay' | 'forced';
const RESP_MODES: { id: RespMode; label: string; blurb: string }[] = [
  {
    id: 'default',
    label: 'Default',
    blurb:
      'Width-driven (`collapseTree:"auto"`). Drag the width below under the floor ' +
      '(tree 300 + contentMinWidth 420): the tree becomes a built-in “Contents” ' +
      'button that opens the default portal drawer.',
  },
  {
    id: 'custom-toggle',
    label: 'Custom toggle',
    blurb:
      '`renderTreeToggle` supplies a bespoke trigger (☰) in place of the default ' +
      'button; it still opens the default drawer overlay.',
  },
  {
    id: 'custom-overlay',
    label: 'Custom overlay',
    blurb:
      '`renderTreeOverlay` supplies a bespoke container — here a centered modal ' +
      'card — that owns its own size/position. The same wired tree renders inside.',
  },
  {
    id: 'forced',
    label: 'Always collapsed',
    blurb:
      '`collapseTree="always"` keeps the tree collapsed at any width — handy for a ' +
      'compact, content-first layout. (Named modes: `"auto"` | `"always"` | ' +
      '`"never"`; booleans still accepted.)',
  },
];

type ExampleId =
  | 'quickstart'
  | 'branch'
  | 'lazy'
  | 'styling'
  | 'responsive'
  | 'object'
  | 'render-hooks'
  | 'selection';
const EXAMPLES: { id: ExampleId; label: string; blurb: string }[] = [
  {
    id: 'quickstart',
    label: '1 · Quickstart',
    blurb:
      'A small inline book passed via `tree`, with a synchronous `fetchContent`. ' +
      'The simplest possible usage — no loading states.',
  },
  {
    id: 'branch',
    label: '2 · Branch content',
    blurb:
      'Branch nodes carry their own content (no `hasContent: false`). Clicking a ' +
      'Part — a non-leaf — loads and shows that Part’s own intro text and makes ' +
      'the Part the active (highlighted) node, not one of its chapters.',
  },
  {
    id: 'lazy',
    label: '3 · Lazy & search',
    blurb:
      'Branches marked `lazy` load their children on demand — by expanding them ' +
      'in the tree *or* by scrolling the reading surface to them (`fetchChildren`). ' +
      'The search box **replaces the whole tree** (`onSearch`/`onReset` return a ' +
      'fresh book) and the reader seamlessly resolves down to the first page — ' +
      'fetching lazy branches along the way. The panel on the right shows every ' +
      'fetch live. Toggle a fully custom search box (`renderSearch`).',
  },
  {
    id: 'styling',
    label: '4 · Styling & location',
    blurb:
      'A large (virtualized) book across all three styling tiers, with a controlled ' +
      '`location`: the readout follows scrolling, and “Jump” drives the reader.',
  },
  {
    id: 'responsive',
    label: '5 · Responsive tree',
    blurb:
      'Reading width wins: when the reader is too narrow to fit the tree *and* the ' +
      'content floor (`contentMinWidth`), the tree collapses to a toggle that opens ' +
      'a floated overlay. Drag the width slider, and try the toggle/overlay modes.',
  },
  {
    id: 'object',
    label: '6 · Object content',
    blurb:
      '`fetchContent` returns a *structured object* (a typed `RichSection`), not an ' +
      'HTML string. A consumer-owned `renderContent(node, section)` renders it — ' +
      'fully typed, no sanitize, no `dangerouslySetInnerHTML`. The cache, ' +
      'virtualization and no-flicker scroll-back all work the same on objects.',
  },
  {
    id: 'render-hooks',
    label: '7 · Render hooks',
    blurb:
      '`renderExpandCollapse` swaps the disclosure caret for a +/− control ' +
      '(library keeps row a11y + keyboard nav); `renderContentNode` owns the ' +
      'content-node *wrapper* element (here a <section> with a status badge) — ' +
      'spread `wrapperProps` (incl. the measurement `ref`) and decorate around ' +
      '`children`.',
  },
  {
    id: 'selection',
    label: '8 · Text selection',
    blurb:
      '`renderContentNode` lets the user select text anywhere and **Stage** it ' +
      'onto a standalone channel — the reader has no idea anyone is listening. ' +
      'Staged text keeps a yellow highlight that **survives scrolling out of view ' +
      'and back** (re-painted from stored character ranges after virtualization ' +
      'remounts the section). Each selection tracks the node’s id, title and ' +
      '`meta` (proof `renderContentNode` gets full node metadata). Stage from many ' +
      'sections, unstage any; a few sections are locked (`user-select:none`, shown ' +
      'highlighted). The button below lives *outside* <BookReader> and dumps every ' +
      'staged selection.',
  },
];

type Skin = 'default' | 'themed' | 'custom';
function skinProps(skin: Skin): Partial<BookReaderProps> {
  switch (skin) {
    case 'themed':
      return { className: 'skin-sepia' };
    case 'custom':
      return {
        classNames: customClassNames,
        renderTreeNode,
        renderContent,
        renderLoading,
        renderError,
        renderEmpty,
      };
    default:
      return {};
  }
}

function App(): JSX.Element {
  const [example, setExample] = useState<ExampleId>('quickstart');
  const [skin, setSkin] = useState<Skin>('default');
  const [location, setLocation] = useState<BookLocation | undefined>(undefined);
  const [frameWidth, setFrameWidth] = useState(640);
  const [respMode, setRespMode] = useState<RespMode>('default');
  const [searchMode, setSearchMode] = useState<'default' | 'custom'>('default');

  // Example 7: the staged set (durable) + the transient right-click context menu,
  // both read off `selectionBus`. `revealed` is the outside button proving the
  // full staged content came across.
  const [staged, setStaged] = useState<StagedSelection[]>([]);
  const [menu, setMenu] = useState<SelMenu | null>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => selectionBus.subscribe(setStaged), []);
  useEffect(() => selectionBus.subscribeMenu(setMenu), []);
  // Dismiss the context menu on a bare click elsewhere, on Escape, or on any
  // scroll (incl. the reader's internal scroll, hence capture). The menu itself
  // stops mousedown propagation so clicking its buttons doesn't dismiss it first.
  useEffect(() => {
    const close = (): void => selectionBus.closeMenu();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') selectionBus.closeMenu();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', close, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const active = EXAMPLES.find((e) => e.id === example)!;

  // Build the BookReader props for the selected example.
  const reader = useMemo(() => {
    switch (example) {
      case 'quickstart':
        return (
          <BookReader
            tree={syncBook}
            fetchContent={fetchSync}
            treeWidth={300}
            onLocationChange={setLocation}
          />
        );
      case 'branch':
        return (
          <BookReader
            tree={branchBook}
            fetchContent={fetchBranch}
            treeWidth={300}
            onLocationChange={setLocation}
          />
        );
      case 'lazy':
        return (
          <BookReader
            tree={lazyBook}
            fetchContent={fetchLazyContent}
            fetchChildren={fetchLazyChildren}
            showSearch
            onSearch={lazySearch}
            onReset={lazyReset}
            searchPlaceholder="Search the atlas…"
            treeWidth={300}
            onLocationChange={setLocation}
            {...(searchMode === 'custom'
              ? { renderSearch: renderCustomSearch }
              : {})}
          />
        );
      case 'styling':
        return (
          <BookReader
            key={skin}
            tree={largeBook}
            fetchContent={fetchStyling}
            treeWidth={300}
            location={location}
            onLocationChange={setLocation}
            {...skinProps(skin)}
          />
        );
      case 'responsive': {
        const respProps: Partial<BookReaderProps> =
          respMode === 'custom-toggle'
            ? { renderTreeToggle: respRenderTreeToggle }
            : respMode === 'custom-overlay'
              ? { renderTreeOverlay: respRenderTreeOverlay }
              : respMode === 'forced'
                ? { collapseTree: 'always' }
                : {};
        return (
          <BookReader
            tree={largeBook}
            fetchContent={fetchStyling}
            treeWidth={300}
            contentMinWidth={420}
            treeCollapseLabel="Contents"
            onLocationChange={setLocation}
            {...respProps}
          />
        );
      }
      case 'object':
        return (
          <BookReader<unknown, RichSection>
            tree={largeBook}
            fetchContent={fetchObject}
            renderContent={renderObjectContent}
            treeWidth={300}
            onLocationChange={setLocation}
          />
        );
      case 'render-hooks':
        return (
          <BookReader
            tree={largeBook}
            fetchContent={fetchStyling}
            treeWidth={300}
            renderExpandCollapse={renderPlusMinus}
            renderContentNode={renderSectionWrapper}
            onLocationChange={setLocation}
          />
        );
      case 'selection':
        return (
          <BookReader<SelectionMeta, string>
            tree={selectionBook}
            fetchContent={fetchSelection}
            treeWidth={300}
            renderContentNode={renderSelectableNode}
            onLocationChange={setLocation}
          />
        );
    }
  }, [example, skin, location, respMode, searchMode]);

  return (
    <main className="demo-page">
      <h1>book-reader demo</h1>
      <p className="demo-sub">
        Library v{VERSION}. Pick an example; each one is a focused scenario.
      </p>

      <div className="example-tabs" role="tablist" aria-label="Examples">
        {EXAMPLES.map((e) => (
          <button
            key={e.id}
            type="button"
            role="tab"
            aria-selected={e.id === example}
            onClick={() => {
              setExample(e.id);
              setLocation(undefined);
            }}
          >
            {e.label}
          </button>
        ))}
      </div>

      <p className="demo-blurb">{active.blurb}</p>

      {example === 'lazy' && (
        <div className="example-controls">
          <span className="skin-toggle" role="group" aria-label="Search box">
            {(['default', 'custom'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={m === searchMode}
                onClick={() => setSearchMode(m)}
              >
                {m === 'default' ? 'Default search box' : 'Custom renderSearch'}
              </button>
            ))}
          </span>
        </div>
      )}

      {example === 'styling' && (
        <div className="example-controls">
          <span className="skin-toggle" role="group" aria-label="Styling tier">
            {(['default', 'themed', 'custom'] as Skin[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={s === skin}
                onClick={() => setSkin(s)}
              >
                {s}
              </button>
            ))}
          </span>
          <button
            type="button"
            className="jump-btn"
            onClick={() => setLocation({ nodeId: 'l.p5.c5.s10' })}
          >
            Jump to §6.6.11
          </button>
        </div>
      )}

      {example === 'responsive' && (
        <div className="example-controls resp-controls">
          <span className="skin-toggle" role="group" aria-label="Collapse mode">
            {RESP_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={m.id === respMode}
                onClick={() => setRespMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </span>
          <label className="resp-width">
            Frame width: <code>{frameWidth}px</code>
            <input
              type="range"
              min={320}
              max={900}
              step={10}
              value={frameWidth}
              onChange={(e) => setFrameWidth(Number(e.target.value))}
            />
          </label>
        </div>
      )}

      {example === 'responsive' && (
        <p className="demo-blurb resp-mode-blurb">
          {RESP_MODES.find((m) => m.id === respMode)!.blurb}
        </p>
      )}

      {example === 'selection' && (
        <div className="sel-panel">
          <div className="example-controls">
            <button
              type="button"
              className="sel-reveal-btn"
              onClick={() => setRevealed(true)}
              disabled={staged.length === 0}
            >
              ▸ Show all staged content ({staged.length})
            </button>
            {staged.length > 0 && (
              <button
                type="button"
                className="sel-clear-btn"
                onClick={() => {
                  selectionBus.clear();
                  setRevealed(false);
                }}
              >
                Clear all
              </button>
            )}
          </div>

          <div className="sel-staged" aria-live="polite">
            {staged.length === 0 ? (
              <p className="sel-proof-empty">
                Select text in a <strong>✏️ selectable</strong> section, then{' '}
                <strong>right-click</strong> → <strong>Stage</strong> (or{' '}
                <strong>Deselect</strong> a stray selection). Right-click a staged
                (yellow) highlight to <strong>Unstage</strong> it. The highlighted{' '}
                <strong>🔒</strong> sections can’t be selected.
              </p>
            ) : (
              <ul className="sel-chips">
                {staged.map((s) => (
                  <li key={s.id} className="sel-chip">
                    <span className="sel-chip-cat">{s.category}</span>
                    <span className="sel-chip-text" title={s.text}>
                      “{s.text.length > 50 ? `${s.text.slice(0, 50)}…` : s.text}”
                    </span>
                    <button
                      type="button"
                      className="sel-chip-x"
                      aria-label={`Unstage selection from ${s.nodeId}`}
                      onClick={() => selectionBus.unstage(s.id)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {revealed && staged.length > 0 && (
            <div className="sel-proof">
              <p className="sel-proof-head">
                ✅ {staged.length} selection{staged.length === 1 ? '' : 's'}{' '}
                communicated out of the reader:
              </p>
              <ol className="sel-proof-list">
                {staged.map((s) => (
                  <li key={s.id}>
                    <blockquote className="sel-proof-text">“{s.text}”</blockquote>
                    <span className="sel-proof-meta">
                      from <strong>{s.nodeTitle}</strong> · id <code>{s.nodeId}</code>{' '}
                      · meta.category <code>{s.category}</code> · chars {s.start}–
                      {s.end} · {new Date(s.at).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {example === 'selection' && menu && (
        <div
          className="sel-menu"
          role="menu"
          style={{ left: `${menu.x}px`, top: `${menu.y}px` }}
          // Keep the live selection + the menu alive: don't let our own mousedown
          // bubble to the document "close on click elsewhere" handler.
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {menu.kind === 'fresh' ? (
            <>
              <button
                type="button"
                role="menuitem"
                className="sel-menu-item"
                onClick={() => {
                  selectionBus.stage(menu.selection);
                  window.getSelection()?.removeAllRanges();
                }}
              >
                ➕ Stage
              </button>
              <button
                type="button"
                role="menuitem"
                className="sel-menu-item"
                onClick={() => {
                  window.getSelection()?.removeAllRanges();
                  selectionBus.closeMenu();
                }}
              >
                ✖ Deselect
              </button>
            </>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="sel-menu-item"
              onClick={() => selectionBus.unstage(menu.stagedId)}
            >
              ➖ Unstage
            </button>
          )}
        </div>
      )}

      <p className="demo-readout" aria-live="polite">
        Reading position:{' '}
        <code>
          {location
            ? `${location.nodeId} (+${Math.round(location.offset ?? 0)}px)`
            : '—'}
        </code>
      </p>

      {example === 'lazy' ? (
        <div className="lazy-stage">
          <div className="reader-frame">{reader}</div>
          <FetchInspector />
        </div>
      ) : (
        <div
          className="reader-frame"
          style={
            example === 'responsive'
              ? { maxWidth: `${frameWidth}px` }
              : undefined
          }
        >
          {reader}
        </div>
      )}
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
