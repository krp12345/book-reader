/**
 * book-reader demo — a single app with an example switcher.
 *
 * Each tab is a focused, self-contained scenario:
 *   1. Quickstart  — a small inline (sync) book, the minimal usage.
 *   2. Branch      — branch nodes that carry their own content.
 *   3. Lazy tree   — a huge book whose subtrees load on demand (`loadChildren`).
 *   4. Styling     — the three styling tiers + a controlled `location`.
 *   5. Responsive  — width-driven tree collapse into a floated overlay.
 *   6. Object      — a generic (non-string) structured content payload.
 *
 * Book data is generated with faker (see `data.ts`) — realistic prose, but
 * deterministic and lazily materialised so a 1,000-section book stays cheap.
 */
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookReader, VERSION } from '../src/index';
import type {
  BookLocation,
  BookReaderClassNames,
  BookReaderProps,
  RenderContent,
  RenderEmpty,
  RenderError,
  RenderLoading,
  RenderTreeNode,
  RenderTreeOverlay,
  RenderTreeToggle,
} from '../src/index';
import {
  loadChildren,
  makeBranchContentBook,
  makeFetchContent,
  makeLargeBook,
  makeLazyBook,
  makeObjectFetchContent,
  makeSyncBook,
  type RichSection,
} from './data';
// The default skin (tier 1). A consumer writes zero CSS and imports just this.
import '../src/styles/book-reader.css';
// Demo-only styles: the themed (token-override) and fully-custom skins + chrome.
import './demo.css';

// Books are deterministic — generate each once.
const syncBook = makeSyncBook();
const largeBook = makeLargeBook();
const lazyBook = makeLazyBook();
const branchBook = makeBranchContentBook();

// Per-example fetchers (see data.ts). States stages slow + failing + empty nodes.
const fetchSync = makeFetchContent();
const fetchBranch = makeFetchContent({ delayMs: 200 });
const fetchLazy = makeFetchContent({ delayMs: 300 });
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
  | 'object';
const EXAMPLES: { id: ExampleId; label: string; blurb: string }[] = [
  {
    id: 'quickstart',
    label: '1 · Quickstart',
    blurb:
      'A small inline book passed via `tree`, with a synchronous `fetchContent`. ' +
      'The simplest possible usage — no loading states, no lazy tree.',
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
    label: '3 · Lazy tree',
    blurb:
      'A vast book with no children up front: `loadChildren` fetches each subtree ' +
      'on expand (watch the spinner). The whole tree is never in memory at once.',
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
            loadChildren={loadChildren}
            fetchContent={fetchLazy}
            treeWidth={300}
            onLocationChange={setLocation}
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
    }
  }, [example, skin, location, respMode]);

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

      <p className="demo-readout" aria-live="polite">
        Reading position:{' '}
        <code>
          {location
            ? `${location.nodeId} (+${Math.round(location.offset ?? 0)}px)`
            : '—'}
        </code>
      </p>

      <div
        className="reader-frame"
        style={
          example === 'responsive' ? { maxWidth: `${frameWidth}px` } : undefined
        }
      >
        {reader}
      </div>
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
