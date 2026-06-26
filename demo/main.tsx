import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookReader, VERSION } from '../src/index';
import type {
  BookLocation,
  BookNode,
  BookReaderClassNames,
  BookReaderProps,
  FetchContent,
  LoadChildren,
  RenderContent,
  RenderEmpty,
  RenderError,
  RenderLoading,
  RenderTreeNode,
} from '../src/types';
// The default skin (tier-0). A consumer writes zero CSS and imports just this.
import '../src/styles/book-reader.css';
// Demo-only styles: the themed (token-override) and fully-custom skins.
import './demo.css';

// --- A small, fully in-memory (sync) book -----------------------------------
const syncBook: BookNode = {
  id: 'b1',
  title: 'A Tiny Book',
  children: [
    {
      id: 'p1',
      title: 'Part I — Beginnings',
      hasContent: false, // a pure organizational branch
      children: [
        { id: 'c1', title: 'Chapter 1' },
        { id: 'c2', title: 'Chapter 2' },
      ],
    },
    {
      id: 'p2',
      title: 'Part II — Middles',
      hasContent: false,
      children: [{ id: 'c3', title: 'Chapter 3' }],
    },
  ],
};

// --- A large sync book: exercises virtualization (only ~viewport is mounted) -
const bigBook: BookNode = {
  id: 'big',
  title: 'A Huge Sync Book (5,000 sections)',
  children: Array.from({ length: 5000 }, (_, i) => ({
    id: `big.${i}`,
    title: `Section ${i + 1}`,
  })),
};

// --- A lazily-loaded book: children arrive on expand ------------------------
const lazyBook: BookNode = { id: 'huge', title: 'A Huge Lazy Book', hasChildren: true };

const loadChildren: LoadChildren = async (node) => {
  // Simulate a network round-trip, then synthesize three child sections.
  await new Promise((r) => setTimeout(r, 400));
  return [0, 1, 2].map((i) => ({
    id: `${node.id}.${i}`,
    title: `${node.title} → §${i + 1}`,
    hasChildren: node.id.split('.').length < 3, // a few levels deep
  }));
};

// Content fetcher: sync for the sync book's leaves; a slow async section shows
// the loading state; one id deliberately fails to exercise the error fallback.
const fetchContent: FetchContent = async (node, ctx) => {
  if (node.id === 'c3') throw new Error('simulated fetch failure');
  if (node.id === 'c2') {
    await new Promise((r) => setTimeout(r, 700)); // shows the loading state
  }
  void ctx.signal;
  return `<h3>${node.title}</h3><p>Body text for <em>${node.title}</em>. ` +
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>';
};

type Skin = 'default' | 'themed' | 'custom';

const SKINS: { id: Skin; label: string; blurb: string }[] = [
  { id: 'default', label: 'Default', blurb: 'Zero CSS — just import the stylesheet.' },
  {
    id: 'themed',
    label: 'Themed',
    blurb: 'Tier 1 — override --reader-* tokens only (a sepia skin).',
  },
  {
    id: 'custom',
    label: 'Fully custom',
    blurb: 'Tiers 2 + 3 — per-slot classNames, data-part hooks, and render-props.',
  },
];

// --- Tier 3 render-props: a fully bespoke look that owns the markup ----------
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

function readerProps(skin: Skin): Partial<BookReaderProps> {
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

function App() {
  const [location, setLocation] = useState<BookLocation | undefined>(undefined);
  const [skin, setSkin] = useState<Skin>('default');
  const active = SKINS.find((s) => s.id === skin)!;

  return (
    <main style={{ fontFamily: 'system-ui', padding: '1.5rem' }}>
      <h1>book-reader demo</h1>
      <p style={{ color: '#666' }}>
        Library version {VERSION}. M7 — the styling system. Three tiers of
        progressive override (REQUIREMENTS §2.5): the default skin out of the box,
        a themed skin via <code>--reader-*</code> token overrides only, and a
        fully-custom skin via per-slot <code>classNames</code> /{' '}
        <code>data-part</code> hooks plus render-props. Chapter 2 loads slowly;
        Chapter 3 fails (Retry to recover).
      </p>

      <div className="skin-tabs" role="group" aria-label="Styling tier">
        {SKINS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === skin}
            onClick={() => setSkin(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p style={{ color: '#444', fontSize: '0.85rem' }}>{active.blurb}</p>

      <p style={{ color: '#444', fontSize: '0.85rem' }} aria-live="polite">
        Reading position:{' '}
        <code>
          {location
            ? `${location.nodeId} (+${Math.round(location.offset ?? 0)}px)`
            : '—'}
        </code>
      </p>
      <div
        style={{
          height: 480,
          border: '1px solid #ddd',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <BookReader
          // `key` forces a clean remount per skin so the demo always starts at
          // the top — not a requirement of the library, just tidy for the demo.
          key={skin}
          tree={[syncBook, bigBook, lazyBook]}
          loadChildren={loadChildren}
          fetchContent={fetchContent}
          treeWidth={280}
          onLocationChange={setLocation}
          {...readerProps(skin)}
        />
      </div>
      <p style={{ color: '#999', fontSize: '0.8rem', marginTop: '1rem' }}>
        Switching tiers restyles the same component — same data, virtualization
        (M5), and cross-pane scroll sync (M6) underneath. The default and themed
        tiers add <em>zero</em> markup; the custom tier swaps in its own
        renderers. Reading-position readout is fed by <code>onLocationChange</code>.
      </p>
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
