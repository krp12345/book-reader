# book-reader

A configurable **React 18** component for reading deeply-nested books: a section
tree on one side and a virtualized, continuous reading surface on the other.
It scales from tiny inline books to huge ones — section **content** is fetched
on demand, cached, and the scroll view stays stable (no flicker) as you read.
The section **tree** is provided up front.

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
  children?: BookNode[]; // present + non-empty ⇒ an expandable branch
  hasContent?: boolean;  // default true; false ⇒ pure organizational branch
  lazy?: boolean;        // children fetched on demand via fetchChildren
  meta?: Meta;           // arbitrary, typed data you attach to a node
}
```

- The whole tree is provided up front via `tree` (a node or an array of roots).
- A node with a non-empty `children` array is an **expandable branch**.
- A node with no `children` (or an empty array) is a **leaf**.

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

### Book-level "no data / no results" state

Distinct from the per-*section* `renderEmpty` above: when the **whole book** has
no showable content node — an empty `tree`, or a search that matched nothing —
the reading surface shows a built-in "Nothing to show here." panel
(`data-part="content-nodata"`, tunable via `--reader-content-nodata-padding` and
the muted color token). Replace it entirely with the `renderNoData` render prop:

```tsx
<BookReader
  tree={tree}
  fetchContent={fetchContent}
  renderNoData={() => <MyEmptyState onClear={clearSearch} />}
/>
```

---

## Custom content payloads

By default `fetchContent` returns a **sanitized HTML string**. You can instead
return **any typed object** and own the rendering end-to-end. `BookReader` is
generic over the content type: `<BookReader<Meta, Content>>`.

```tsx
interface RichSection {
  heading: string;
  paragraphs: string[];
}

<BookReader<unknown, RichSection>
  tree={tree}
  fetchContent={async (node) => loadSection(node.id)} // returns a RichSection
  renderContent={(node, section) => (
    <article>
      <h2>{section.heading}</h2>
      {section.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
    </article>
  )}
/>
```

Notes:

- **Object payloads are never sanitized** (only the default string path is) — you
  render them yourself, so you own their safety.
- An object payload **requires** a `renderContent`; there is no default renderer
  for objects (nothing renders without one).
- The string path is **unchanged** (back-compat): omit the `Content` type and
  everything behaves exactly as documented above.
- Objects are cached like strings; scroll-back stays a synchronous cache hit.

---

## Lazy tree (`lazy` + `fetchChildren`)

For very large books you don't have to ship the whole tree up front. Mark any
branch `lazy: true` and provide its children **on demand** via `fetchChildren`.
A lazy node renders as expandable even with no `children`; the library fetches
once, shows loading/error+retry around your callback, and never refetches.

```tsx
<BookReader
  tree={{
    id: 'root',
    title: 'My Book',
    children: [
      { id: 'p1', title: 'Part I', lazy: true, hasContent: false }, // children deferred
    ],
  }}
  fetchContent={loadBody}
  fetchChildren={async (node, { signal }) => {
    const res = await fetch(`/api/children/${node.id}`, { signal });
    return res.json(); // BookNode[] — may themselves be `lazy`
  }}
/>
```

- **Two triggers.** Children load when the reader **expands** the node in the
  tree, *or* when the **reading surface scrolls** to it. Either way the fetch
  runs once (concurrent triggers coalesce).
- **One level per call.** Return a node's immediate children; returned children
  may be `lazy` too, so the tree stays lazy to any depth.
- **States.** While loading, a placeholder row appears in the branch (and in the
  reading surface if scroll-triggered); on failure, an error row with **Retry**.
  Loaded children are retained when you collapse the branch.
- `fetchChildren` is only required if your tree contains `lazy` nodes. A lazy
  node opened with no `fetchChildren` configured shows an error.

---

## Search — replace the tree (`showSearch` / `onSearch` / `onReset`)

The optional tree search box is **not** a suggestion list — submitting it
**replaces the entire book** with a tree your `onSearch` returns (same shape as
`tree`, lazy nodes allowed), and the reader jumps to the **first page** of the
result, resolving lazy branches along the way. `onReset` restores a tree (usually
the original book) the same way.

```tsx
<BookReader
  tree={book}
  fetchContent={loadBody}
  fetchChildren={loadChildren}
  showSearch
  onSearch={async (query, { signal }) => {
    const res = await fetch(`/api/search?q=${query}`, { signal });
    return res.json(); // a whole BookNode tree — replaces the current book
  }}
  onReset={() => book}            // restore the original; hides the Reset button if omitted
  searchPlaceholder="Search…"
/>
```

- **Enter / the Search button** runs `onSearch`; the old tree vanishes and a
  loading state shows until the new tree (and its first page) resolve.
- **First-page resolution.** After the swap the reader descends the leftmost
  path — fetching lazy branches as needed — to the first content-bearing node.
- **Custom UI.** `renderSearch(api)` replaces the entire search control (input +
  Search/Reset buttons). The library still owns tree-replacement and first-page
  resolution; there are no result lists to render.

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
  path?: string[];       // root→parent ancestry, for deep-linking into lazy branches
}
```

### Deep-linking into `lazy` branches

A `location` / `defaultLocation` can point at a node that isn't in the tree yet
because it lives inside an **unfetched `lazy` branch**. On its own the reader
can't reach it — it doesn't know which branch hides the target — so you supply
the ancestry one of two ways, and the reader resolves each lazy ancestor in turn
until the node exists, then scrolls to it:

```tsx
// (a) Per-location: include the ancestor path (root → direct parent, excluding the target)
setLoc({ nodeId: 'sec-42', path: ['partB', 'ch7'] });

// (b) A resolver prop the reader calls when a target isn't loaded yet:
<BookReader
  fetchChildren={loadChildren}
  fetchPath={async (nodeId, signal) => {
    const res = await fetch(`/api/path/${nodeId}`, { signal });
    return res.json(); // string[] ancestry, or undefined if unknown
  }}
  defaultLocation={{ nodeId: 'sec-42' }}
/>
```

- A `BookLocation.path` takes precedence over `fetchPath`. With **neither**, a
  location into an unresolved branch is a **no-op** (the reader stays put) rather
  than silently guessing.
- Navigation is abortable: a newer location supersedes an in-flight resolve.
- Targets already in the tree (tree clicks, in-book scrolling) resolve
  synchronously — this path only engages for genuine deep-links.

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

## Collapsible tree

The tree can collapse into a **toggle button + popover** so the reading surface
gets the full width. `collapseTree` picks the mode (the modes are mutually
exclusive — the collapsed UI and every customization hook below are identical
across them; only the *trigger* differs):

```tsx
<BookReader collapseTree="auto"   ... /> // default — collapse only when too narrow
<BookReader collapseTree="always" ... /> // always collapsed, at any width
<BookReader collapseTree="never"  ... /> // never collapse (classic two-pane)
```

Booleans are accepted for back-compat: `true` ⇒ `"always"`, `false` ⇒ `"never"`.

In `"auto"` mode, the tree collapses when the reader can't fit both the tree and
`contentMinWidth` (reading width wins). When collapsed, the toggle opens a
popover containing the **same wired tree** (selection/expansion stay in sync),
scrolled to the current reading position.

```tsx
<BookReader
  tree={tree}
  fetchContent={fetchContent}
  collapseTree="auto"
  contentMinWidth={420}          // reading-surface floor (number ⇒ px, or CSS length)
  treeCollapseLabel="Contents"   // default toggle button text
  treeOverlayMinWidth={240}      // popover min width (default 240)
  treeOverlayMinHeight={200}     // popover min height (default 200; capped at 70vh)
/>
```

Customize the collapsed UI without losing the built-in tree a11y/keyboard nav:

```tsx
<BookReader
  // Custom trigger — gets open state + open/close/toggle + the label:
  renderTreeToggle={({ isOpen, toggle, label }) => (
    <button aria-expanded={isOpen} onClick={toggle}>☰ {label}</button>
  )}
  // Custom container — gets the fully-wired tree as `children` + a `close()`:
  renderTreeOverlay={({ children, close }) => (
    <MyModal onDismiss={close}>{children}</MyModal>
  )}
  classNames={{ treeToggle: 'my-toggle', treeOverlay: 'my-overlay' }}
  ...
/>
```

---

## Styling

Three tiers, from least to most invasive (use the lowest that gets the job
done):

**1. Override CSS variables.** Import the default skin, then redefine any
`--reader-*` token on the root. Presentation only (font, colors, surfaces,
spacing, tree indent, radius, focus ring) — layout stays intact. **Every
padding and margin in the skin is a token**, so you can retune spacing without
fighting hard-coded values; the defaults preserve the out-of-the-box look.

```css
@import 'book-reader/styles.css';

[data-part='book-reader'] {
  --reader-font: Georgia, serif;
  --reader-accent: #6b4eff;
  --reader-tree-indent: 1.25rem;

  /* Spacing is fully tweakable, e.g. a roomier reading column and tree: */
  --reader-content-padding: 2.5rem 3rem;
  --reader-content-paragraph-margin: 0 0 1.4em;
  --reader-tree-padding: 1rem;
}
```

Spacing tokens: `--reader-tree-padding`, `--reader-tree-indent`,
`--reader-tree-row-padding-block`, `--reader-tree-row-padding-inline`,
`--reader-tree-gap`, `--reader-content-padding`,
`--reader-content-padding-block`, `--reader-content-padding-inline`,
`--reader-content-paragraph-margin`, `--reader-content-heading-margin`,
`--reader-content-blockquote-margin`, `--reader-content-blockquote-padding`,
`--reader-content-code-padding`, `--reader-content-state-gap`,
`--reader-content-retry-padding`.

The content-node padding is split into `--reader-content-padding-block` and
`--reader-content-padding-inline`, so the **vertical gap between adjacent
sections** (twice the block padding) is tunable independently of the horizontal
text inset. `--reader-content-padding` remains a shorthand that overrides both at
once. Tree-row indentation comes from `--reader-tree-indent` × each row's depth
(applied by the skin), so it lives entirely in CSS — the bare, un-skinned
component carries no inline indent.

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
    treeToggle: 'my-toggle',   // collapsed-tree trigger
    treeOverlay: 'my-overlay', // collapsed-tree popover
  }}
  ...
/>
```

**3. Render props** (`renderTreeNode`, `renderContent`, `renderLoading`,
`renderError`, `renderEmpty`, plus `renderExpandCollapse` and
`renderContentNode` below) — full control over the markup, as shown above.

---

## Render hooks: caret & content wrapper

Two render props let you replace structural pieces the other render props don't
reach — without re-implementing tree a11y/keyboard nav or breaking
virtualization.

**`renderExpandCollapse`** replaces *only* the disclosure caret in each tree
row. The library keeps the row wrapper, `aria-expanded`, and keyboard nav; your
control is presentation plus its click handler. It receives
`{ expandable, expanded, loading, depth, toggle, expand, collapse }`:

```tsx
<BookReader
  renderExpandCollapse={({ expandable, expanded, loading, toggle }) =>
    expandable ? (
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation(); // don't also select the row
          toggle();
        }}
      >
        {loading ? '⋯' : expanded ? '−' : '+'}
      </button>
    ) : null
  }
  ...
/>
```

**`renderContentNode`** owns the per-section *wrapper element* (tag, classes,
attrs, handlers), where `renderContent` replaces only the inner body. You get
`{ node, state, wrapperProps, children }`: spread `wrapperProps` onto your
element — **including its `ref`, which the height map depends on** — and render
`children` (the body the default/`renderContent` renderer produced) inside:

```tsx
<BookReader
  renderContentNode={({ state, wrapperProps, children }) => (
    <section {...wrapperProps}>
      <div className="badge">{state.status}</div>
      {children}
    </section>
  )}
  ...
/>
```

`renderContent` (inner body) and `renderContentNode` (wrapper) compose freely.

---

## Props reference

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `tree` | `BookNode \| BookNode[]` | — | One root or a forest; the full tree up front. |
| `fetchContent` | `FetchContent` | **required** | Resolves a node's HTML body (sync or async). |
| `fetchChildren` | `FetchChildren` | — | Resolves a `lazy` node's children on demand. |
| `fetchPath` | `FetchPath` | — | Resolves a deep-link target's ancestry so `location` can reach unfetched `lazy` branches. |
| `showSearch` | `boolean` | `false` | Show the tree search box. |
| `onSearch` | `SearchFn` | — | Returns a new tree that replaces the book on submit. |
| `onReset` | `ResetFn` | — | Returns the tree to restore; hides Reset if omitted. |
| `searchPlaceholder` | `string` | `'Search…'` | Default search input placeholder. |
| `renderSearch` | `RenderSearch` | default box | Replace the search control UI. |
| `getNextNode` / `getPrevNode` | `GetNextNode` / `GetPrevNode` | DFS order | Override reading order. |
| `location` | `BookLocation` | — | Controlled reading position. |
| `defaultLocation` | `BookLocation` | — | Initial position when uncontrolled. |
| `onLocationChange` | `(loc) => void` | — | Notified on scroll/navigation. |
| `cache` | `CacheConfig` | LRU ~5M chars | Bounded content cache; captured at mount. |
| `prefetchCount` | `number` | `2` | Nodes past the window kept warm. |
| `treeSide` | `'left' \| 'right'` | `'left'` | Which side the tree sits on. |
| `treeWidth` | `number \| string` | `320` | Tree pane width (number ⇒ px). |
| `collapseTree` | `'auto' \| 'always' \| 'never' \| boolean` | `'auto'` | Tree-collapse mode (`true`⇒`'always'`, `false`⇒`'never'`). |
| `contentMinWidth` | `number \| string` | `360` | Reading-surface floor; in `'auto'` mode the tree collapses below it. |
| `treeCollapseLabel` | `string` | `'Contents'` | Default collapsed toggle button text. |
| `treeOverlayMinWidth` | `number \| string` | `240` | Min width of the default collapsed popover. |
| `treeOverlayMinHeight` | `number \| string` | `200` | Min height of the default collapsed popover (capped at `70vh`). |
| `renderTreeToggle` | `RenderTreeToggle` | default button | Custom collapsed trigger. |
| `renderTreeOverlay` | `RenderTreeOverlay` | portal drawer | Custom collapsed popover container. |
| `sanitize` | `boolean \| (html) => string` | `true` | HTML sanitization control. |
| `overscan` | `number` | `2` | Virtualization buffer (nodes each side). |
| `estimateHeight` | `number` | `200` | Assumed px for unmeasured nodes. |
| `className` / `classNames` | `string` / `BookReaderClassNames` | — | Styling hooks (tier 2). |
| `renderTreeNode` / `renderContent` / `renderLoading` / `renderError` / `renderEmpty` | render props | defaults ship | Markup overrides (tier 3). |
| `renderNoData` | `RenderNoData` | built-in panel | Book-level "no data / no results" state (whole tree has nothing to show). |
| `renderExpandCollapse` | `RenderExpandCollapse` | default caret | Replace the tree row disclosure control. |
| `renderContentNode` | `RenderContentNode` | default `<article>` | Own the per-section wrapper element. |
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

## Feature stability

Most shipped features are **Stable** — documented and covered by tests (jsdom/RTL
integration for the wiring + real-browser Playwright e2e for the layout/scroll
behaviour). That includes the collapsible tree, custom (object) content payloads,
and the render hooks (`renderExpandCollapse` / `renderContentNode`) alongside the
core tree, content fetching, caching, virtualization, reading position, and
styling.

The **lazy tree** (`lazy` + `fetchChildren`) and **search** (`showSearch` /
`onSearch` / `onReset` / `renderSearch`) are now **Stable** — covered by unit +
real-browser tests, including the scroll-trigger under StrictMode and the
effective-neighbour contract (scrolling up/down resolves lazy branches
recursively to the logical previous/next leaf at any depth). The book-level
**no-data state** (`renderNoData`) is **Stable** — covered by RTL + real-browser
tests (zero-result search, empty book).

There is no accessibility pass planned. Keyboard nav and ARIA roles ship on the
tree as-is.

---

## Requirements

- React 18 (`react` + `react-dom` as peer dependencies).
- The reader must live inside a container with a defined height.

## License

MIT
