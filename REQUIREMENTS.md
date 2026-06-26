# BookReader — Requirements Specification

> A React 18 **library** exposing a `<BookReader>` component for reading books
> structured as arbitrarily deep sections/subsections: a tree on the left, the
> reading material on the right.

Status: **specification frozen** (2026-06-26). Implementation tracked in `MILESTONES.md`.

---

## 1. Product goal

Expose a single, highly-configurable, embeddable React component that renders a
book as:

- **Left pane:** a navigable tree of sections / subsections, to any depth.
- **Right pane:** the reading material, as one continuous, scrollable surface.

The component must scale from **tiny books** (a handful of nodes, given inline)
to **very large books** (huge trees, loaded lazily) with the same API.

---

## 2. Core requirements (from the user)

### 2.1 Tree (structure) input
- A book is a tree of **sections and subsections to arbitrary depth**.
- The tree may be supplied **two ways**, both first-class:
  - **Synchronous** — a full nested object up front (small books).
  - **Asynchronous** — a `loadChildren(node, ctx)` function for lazy expansion
    (large books). The whole tree need never be in memory at once.
- Both strategies must be **fully configurable**, usable independently or mixed.
- The left tree **auto-expands the active reading path** ("deepest level first")
  so the tree view stays in sync with where the reader is in the text.
- Both **branch and leaf** nodes may carry readable content.

### 2.2 Content fetcher (the reading material)
- The component takes a **data fetcher** as input.
- The fetcher receives the **current context** (the node + reading context) and
  returns the **content of that node**.
- Content is an **HTML string** (sanitized before render by default).
- May be **sync or async**.
- Signature (conceptual): `fetchContent(node, ctx) => string | Promise<string>`.

### 2.3 Scroll tracking & auto-advance
- The right pane tracks **scroll position**.
- On approaching the bottom, it **automatically fetches the next resource** and
  appends it — continuous reading, no manual "next" click.
- "Next" = next node in **depth-first reading order** (real-book order,
  descending into children).
- Overridable via `getNextNode` / `getPrevNode` hooks for custom traversal.
- Scrolling also drives **tree sync**: the active node highlights and its
  ancestors auto-expand. Clicking a tree node scrolls the content to it.

### 2.4 Configurable view
- Layout is configurable: tree side (left/right), tree width, collapsible tree,
  overscan, prefetch count, sanitize on/off, etc.

### 2.5 Configurable styling
- **Default styles ship out of the box** — a simple user writes no CSS and gets
  a polished look.
- **Progressive override**, three tiers:
  1. Override `--reader-*` **CSS custom properties** (colors, spacing, font,
     indent) — no JS.
  2. Target stable `data-part="..."` **hooks** / per-slot `className`s.
  3. Provide **custom renderers** for full control.
- Framework-agnostic (works with plain CSS, CSS modules, Tailwind). No CSS-in-JS
  runtime dependency.

### 2.6 Custom renderers
- Pluggable render-props, each optional (default provided):
  - `renderTreeNode(node, state)` — custom tree node.
  - `renderContent(node, html, state)` — custom content renderer.
  - `renderLoading`, `renderError`, `renderEmpty`.

---

## 3. Caching & performance requirements

### 3.1 The hard constraints
- **Virtualized** rendering: only nodes in viewport + buffer are in the DOM, so
  tiny and huge books behave identically.
- **Automatic caching** of fetched content (the user does NOT want to require an
  external cache library for basic use).
- Cache must be **bounded** — never unbounded growth for a large book.
- Cache strategy **configurable** (default: budget by total character count).
- **No flicker.** The view must be **stable** during scroll, including
  scroll-back over already-read content.

### 3.2 The architecture that satisfies all of the above
Three **independent** layers (this is what makes "cache + virtualization + no
flicker" simultaneously possible):

1. **Content cache** (in memory): sanitized HTML keyed by node id. Bounded, LRU.
   - Default eviction budget: **total character count** (e.g. ~5M chars).
   - Configurable: `cache={{ maxChars, maxNodes?, evict?: customFn }}`.
   - **Pinned window**: nodes within viewport + overscan + prefetch range are
     exempt from eviction → re-entering view is always a synchronous cache hit
     (no fetch, no loading flash).
2. **DOM virtualization**: off-screen nodes leave the DOM but **stay in cache**.
3. **Height map**: measured node heights are remembered; remount reuses the known
   height. **Anchor correction** adjusts scrollTop when a measured height differs
   from its estimate, so content under the reader's eyes never jumps.

- **Prefetch-ahead**: keep next 1–2 nodes warm before they enter view.
- **In-flight de-duplication**: the same node is never fetched twice concurrently.
- A re-fetch can only ever happen for an **evicted** (far off-screen) node, so it
  is never visible → flicker-free guarantee holds.

---

## 4. Reading position / persistence
- Reading position exposed as **controlled or uncontrolled** `location`
  (active node id + scroll offset) with `onLocationChange`.
- The component does **not** force a persistence mechanism — consumer decides
  (URL, localStorage, backend). No built-in storage required.

---

## 5. Public API (target shape, conceptual)

```ts
<BookReader
  // --- data ---
  tree={treeObjectOrRoot}                      // sync option
  loadChildren={(node, ctx) => Promise<Node[]>}// async option (either/both)
  fetchContent={(node, ctx) => string | Promise<string>}

  // --- reading order (optional overrides) ---
  getNextNode={(node, ctx) => Node | null}
  getPrevNode={(node, ctx) => Node | null}

  // --- position ---
  location={...} defaultLocation={...} onLocationChange={fn}

  // --- caching ---
  cache={{ maxChars?: number; maxNodes?: number; evict?: EvictFn }}
  prefetchCount={2}

  // --- view config ---
  treeSide="left" treeWidth={320} collapsibleTree overscan={3}
  sanitize={true}

  // --- styling ---
  className classNames={{ tree, content, node, ... }} style theme

  // --- custom renderers ---
  renderTreeNode renderContent renderLoading renderError renderEmpty
/>
```

`Node` (conceptual): `{ id, title, children?, hasChildren?, hasContent?, meta? }`.
`ctx` carries: node path, traversal direction, `AbortSignal`, book-level metadata.

---

## 6. Tooling & packaging
- **Vite library mode + TypeScript.**
- Output: **ESM + CJS + `.d.ts`** types.
- **React 18 as a `peerDependency`** (not bundled).
- **Vitest** for tests.
- A **Vite demo app** (`/demo` or `/playground`) with sample book data, used as a
  live development harness.
- Default stylesheet shipped as an importable CSS file.

---

## 7. Non-goals (for v1)
- No built-in persistence backend.
- No content authoring/editing — read-only.
- No bundled markdown/PDF parser (fetcher returns HTML; consumers convert).
- No mandatory external state/data library.

---

## 8. Open / deferred decisions
- npm package name + scope (e.g. `@scope/book-reader`) — **TBD by user**.
- Exact default `maxChars` budget — start ~5M, tune later.
- Whether to ship optional adapters (markdown→HTML helper) as a sub-export later.
