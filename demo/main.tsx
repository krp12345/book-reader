import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BookReader, VERSION } from '../src/index';
import type { BookNode, FetchContent, LoadChildren } from '../src/types';

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

function App() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: '1.5rem' }}>
      <h1>book-reader demo</h1>
      <p style={{ color: '#666' }}>
        Library version {VERSION}. M3 — section tree (left) + continuous content
        (right). Chapter 2 loads slowly; Chapter 3 fails (Retry to recover).
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
          tree={[syncBook, lazyBook]}
          loadChildren={loadChildren}
          fetchContent={fetchContent}
          treeWidth={280}
        />
      </div>
      <p style={{ color: '#999', fontSize: '0.8rem', marginTop: '1rem' }}>
        Lazy-tree expansion (the &ldquo;{lazyBook.title}&rdquo; pattern) drives the
        left pane; cross-pane scroll⟷tree sync arrives in M6.
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
