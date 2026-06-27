# book-reader

A configurable **React 18** component for reading deeply-nested books: a section
tree on one side and a virtualized, continuous reading surface on the other.
It scales from tiny inline books to huge, lazily-loaded ones — content is
fetched on demand, cached, and the scroll view stays stable (no flicker) as you
read.

- **One component to use:** `<BookReader>`. Everything else exported is an
  advanced building block you can ignore for normal use.
- **Auto-caching + virtualization** are built in — scrolling back over read
  content is a synchronous cache hit; only the visible window is mounted.
- **Sanitized HTML** content by default, with full styling/render overrides.

---

## Install

React and React DOM are **peer dependencies** (v18) — they are not bundled.

```bash
pnpm add book-reader react react-dom
# or: npm install book-reader react react-dom
```

Optionally import the default stylesheet (opt-in, tree-shake-safe — the component
works without it, but ships only functional layout until you do):

```ts
import 'book-reader/styles.css';
```

---

## Quickstart

Provide a `tree` (your sections) and a `fetchContent` function (resolves a
node's HTML body). That's the minimum.

> **Give the reader a sized container.** `<BookReader>` fills its parent
> (`height: 100%`). If the parent has no height, the reading pane can't
> virtualize or scroll. Wrap it in something with a real height.

```tsx
import { BookReader } from 'book-reader';
import type { BookNode } from 'book-reader';
import 'book-reader/styles.css';

const tree: BookNode = {
  id: 'root',
  title: 'My Book',
  children: [
    { id: 'ch1', title: 'Chapter 1' },
    {
      id: 'ch2',
      title: 'Chapter 2',
      children: [
        { id: 'ch2-1', title: 'Section 2.1' },
        { id: 'ch2-2', title: 'Section 2.2' },
      ],
    },
  ],
};

const content: Record<string, string> = {
  ch1: '<p>Once upon a time…</p>',
  'ch2-1': '<p>The story continues.</p>',
  'ch2-2': '<p>And concludes.</p>',
};

export function Reader() {
  return (
    <div style={{ height: '80vh' }}>
      <BookReader
        tree={tree}
        fetchContent={(node) => content[node.id] ?? ''}
      />
    </div>
  );
}
```

`tree` accepts a single root, an array of roots (a forest), or can be omitted
entirely for a fully-lazy book (see below).

---

## Core concepts

### The tree (`BookNode`)

```ts
interface BookNode<Meta = unknown> {
  id: string;            // stable, unique — keys the store, cache & height map
  title: string;         // shown in the section tree
  children?: BookNode[]; // present ⇒ already-known children
  hasChildren?: boolean; // lazy: expandable before children are loaded
  hasContent?: boolean;  // default true; false ⇒ pure organizational branch
  meta?: Meta;           // arbitrary, typed data you attach to a node
}
```

- A node with `children` is fully known.
- A node with `hasChildren: true` but **no** `children` is "expandable, not yet
  loaded" — its children come from `loadChildren` on expand.
- A node with neither is a **leaf**.

### Fetching content (`fetchContent`)

Required. Resolves a node's readable body as an HTML string. May be sync or
async, and receives a context with the ancestor `path`, reading `direction`, and
an `AbortSignal` (the fetch is aborted if the node is evicted/unmounted):

```tsx
<BookReader
  tree={tree}
  fetchContent={async (node, { signal }) => {
    const res = await fetch(`/api/section/${node.id}`, { signal });
    return res.text(); // HTML string
  }}
/>
```

Returned HTML is **sanitized** by default (allowlist). To opt out or customize:

```tsx
<BookReader sanitize={false} ... />           // trust your own HTML
<BookReader sanitize={(html) => clean(html)} ... /> // custom sanitizer
```

---

## Lazy trees (huge books)

For books too large to hold in memory, omit `children` on expandable nodes
(mark them `hasChildren: true`) and supply `loadChildren`. Subtrees are fetched
on demand when the user expands them — or automatically as the reader scrolls
toward an unloaded subtree.

```tsx
<BookReader
  tree={{ id: 'root', title: 'Encyclopedia', hasChildren: true }}
  loadChildren={async (node, { path, signal }) => {
    const res = await fetch(`/api/children/${node.id}`, { signal });
    return res.json(); // BookNode[]
  }}
  fetchContent={fetchContent}
/>
```

You can even omit `tree` entirely and let `loadChildren` build the whole book
from the root down.

---

## Loading / error / empty states

Each node's content goes through `loading → loaded | empty | error`. Sensible
defaults ship; override any of them with render props:

```tsx
<BookReader
  tree={tree}
  fetchContent={fetchContent}
  renderLoading={(node) => <p>Loading {node.title}…</p>}
  renderEmpty={(node) => <p>No content.</p>}
  renderError={(node, error, retry) => (
    <div>
      Failed to load. <button onClick={retry}>Retry</button>
    </div>
  )}
  renderContent={(node, html) => (
    <article dangerouslySetInnerHTML={{ __html: html }} />
  )}
/>
```

`retry` re-runs the failed fetch. `renderContent` receives the already-sanitized
HTML.

---

## Reading position (`location`)

The reader tracks an active node (the section under the reading line) plus a
scroll `offset` into it. Use it **uncontrolled** (just observe) or **controlled**
(drive the reader). You own any persistence.

```tsx
// Uncontrolled — observe position, e.g. to save it:
<BookReader
  tree={tree}
  fetchContent={fetchContent}
  defaultLocation={{ nodeId: 'ch2-1' }}
  onLocationChange={(loc) => save(loc)}
/>

// Controlled — your state drives the reader (jump to a section):
const [loc, setLoc] = useState<BookLocation | undefined>(undefined);
<BookReader
  tree={tree}
  fetchContent={fetchContent}
  location={loc}
  onLocationChange={setLoc}
/>
// …elsewhere: setLoc({ nodeId: 'ch2-2' })  // jumps the reader there
```

```ts
interface BookLocation {
  nodeId: string;        // active node
  offset?: number;       // px scrolled past its top (omit ⇒ align to top)
}
```

### Custom reading order

By default the reader advances in depth-first (pre-order) sequence. Override it
with `getNextNode` / `getPrevNode` if your book reads in a different order:

```tsx
<BookReader
  getNextNode={(node, { path, direction }) => nextInMyOrder(node) ?? null}
  getPrevNode={(node, ctx) => prevInMyOrder(node) ?? null}
  ...
/>
```

Return `null` for "end/start of book". Returned nodes must already be in the
tree.

---

## Styling

Three tiers, from least to most invasive (use the lowest that gets the job
done):

**1. Override CSS variables.** Import the default skin, then redefine any
`--reader-*` token on the root. Presentation only (font, colors, surfaces,
spacing, tree indent, radius, focus ring) — layout stays intact.

```css
@import 'book-reader/styles.css';

[data-part='book-reader'] {
  --reader-font: Georgia, serif;
  --reader-accent: #6b4eff;
  --reader-tree-indent: 1.25rem;
}
```

**2. Target `data-part` hooks or per-slot `classNames`.** Stable hooks exist on
every slot (`book-reader`, `tree`, `tree-node`, `content`, `content-node`), and
you can also pass class names directly:

```tsx
<BookReader
  className="my-reader"
  classNames={{
    root: 'my-root',
    tree: 'my-tree',
    treeNode: 'my-row',
    content: 'my-content',
    contentNode: 'my-node',
  }}
  ...
/>
```

**3. Render props** (`renderTreeNode`, `renderContent`, `renderLoading`,
`renderError`, `renderEmpty`) — full control over the markup, as shown above.

---

## Props reference

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `tree` | `BookNode \| BookNode[]` | — | One root, a forest, or omit for fully-lazy. |
| `loadChildren` | `LoadChildren` | — | Lazy children loader; enables on-demand expansion. |
| `fetchContent` | `FetchContent` | **required** | Resolves a node's HTML body (sync or async). |
| `getNextNode` / `getPrevNode` | `GetNextNode` / `GetPrevNode` | DFS order | Override reading order. |
| `location` | `BookLocation` | — | Controlled reading position. |
| `defaultLocation` | `BookLocation` | — | Initial position when uncontrolled. |
| `onLocationChange` | `(loc) => void` | — | Notified on scroll/navigation. |
| `cache` | `CacheConfig` | LRU ~5M chars | Bounded content cache; captured at mount. |
| `prefetchCount` | `number` | `2` | Nodes past the window kept warm. |
| `treeSide` | `'left' \| 'right'` | `'left'` | Which side the tree sits on. |
| `treeWidth` | `number \| string` | `320` | Tree pane width (number ⇒ px). |
| `sanitize` | `boolean \| (html) => string` | `true` | HTML sanitization control. |
| `overscan` | `number` | `2` | Virtualization buffer (nodes each side). |
| `estimateHeight` | `number` | `200` | Assumed px for unmeasured nodes. |
| `className` / `classNames` | `string` / `BookReaderClassNames` | — | Styling hooks (tier 2). |
| `renderTreeNode` / `renderContent` / `renderLoading` / `renderError` / `renderEmpty` | render props | defaults ship | Markup overrides (tier 3). |
| `aria-label` | `string` | — | Accessible label for the reader. |

All props are generic over `Meta`, so `node.meta` is fully typed everywhere
(`<BookReader<MyMeta> ... />`).

---

## Advanced exports

`BookReader` is the only component most consumers need. For custom shells, the
library also exports its building blocks: the panes (`TreePane`, `TreePaneView`,
`ContentPane`, `ContentNode`) and the **pure, framework-free core**
(`createTreeStore`, `createReadingOrder`, `createContentCache`,
`createVirtualizer`, the `scrollSync` helpers, and `sanitizeHtml`). These let you
recompose the reader without reimplementing the tree store, cache, or
virtualizer. See `src/index.ts` for the full surface.

---

## Requirements

- React 18 (`react` + `react-dom` as peer dependencies).
- The reader must live inside a container with a defined height.

## License

MIT
