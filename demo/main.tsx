/**
 * book-reader demo — a single app with an example switcher.
 *
 * Each tab is a focused, self-contained scenario:
 *   1. Quickstart  — a small inline (sync) book, the minimal usage.
 *   2. Lazy tree   — a huge book whose subtrees load on demand (`loadChildren`).
 *   3. States      — fetchContent loading / error+retry / empty states.
 *   4. Styling     — the three styling tiers + a controlled `location`, over a
 *                    large (virtualized) book.
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
} from '../src/index';
import {
  loadChildren,
  makeFetchContent,
  makeLargeBook,
  makeLazyBook,
  makeSyncBook,
} from './data';
// The default skin (tier 1). A consumer writes zero CSS and imports just this.
import '../src/styles/book-reader.css';
// Demo-only styles: the themed (token-override) and fully-custom skins + chrome.
import './demo.css';

// Books are deterministic — generate each once.
const syncBook = makeSyncBook();
const largeBook = makeLargeBook();
const lazyBook = makeLazyBook();

// Per-example fetchers (see data.ts). States stages slow + failing + empty nodes.
const fetchSync = makeFetchContent();
const fetchLazy = makeFetchContent({ delayMs: 300 });
const fetchStyling = makeFetchContent({ delayMs: 150 });
const FAIL_ID = 's.p0.c1';
const EMPTY_ID = 's.p1.c0';
const fetchStates = makeFetchContent({
  delayMs: 700,
  failFirstFor: new Set([FAIL_ID]),
  emptyFor: new Set([EMPTY_ID]),
});

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

type ExampleId = 'quickstart' | 'lazy' | 'states' | 'styling';
const EXAMPLES: { id: ExampleId; label: string; blurb: string }[] = [
  {
    id: 'quickstart',
    label: '1 · Quickstart',
    blurb:
      'A small inline book passed via `tree`, with a synchronous `fetchContent`. ' +
      'The simplest possible usage — no loading states, no lazy tree.',
  },
  {
    id: 'lazy',
    label: '2 · Lazy tree',
    blurb:
      'A vast book with no children up front: `loadChildren` fetches each subtree ' +
      'on expand (watch the spinner). The whole tree is never in memory at once.',
  },
  {
    id: 'states',
    label: '3 · Loading / error / empty',
    blurb:
      'Every section loads slowly (you see the loading state). One chapter fails ' +
      'on first load — press Retry to recover. One chapter resolves to no content.',
  },
  {
    id: 'styling',
    label: '4 · Styling & location',
    blurb:
      'A large (virtualized) book across all three styling tiers, with a controlled ' +
      '`location`: the readout follows scrolling, and “Jump” drives the reader.',
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
      case 'states':
        return (
          <BookReader
            tree={syncBook}
            fetchContent={fetchStates}
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
    }
  }, [example, skin, location]);

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

      <p className="demo-readout" aria-live="polite">
        Reading position:{' '}
        <code>
          {location
            ? `${location.nodeId} (+${Math.round(location.offset ?? 0)}px)`
            : '—'}
        </code>
      </p>

      <div className="reader-frame">{reader}</div>
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
