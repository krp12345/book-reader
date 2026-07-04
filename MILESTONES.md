# BookReader — Milestones & Progress

> **Restartable plan + progress tracker (single source of truth).** Each
> milestone is independently shippable and verifiable. At the start of any
> session, read the STATUS block below first, then `REQUIREMENTS.md` +
> `CONVENTIONS.md` + `CLAUDE.md`. Update this file as work lands.

---

## ▶ STATUS — keep this block current (update at end of every session)
- **Current milestone:** none open — **Project Restructuring (`RESTRUCTURE.md`) completed (2026-07-05)**: reorganized `src/` so every layer folder (`components/`, `hooks/`, `core/`, `utils/`, `types/`) shares the same uniform feature buckets (`bookReader`, `tree`, `content`, `common`), mirroring the `<BookReader>` view hierarchy. Phase 1 through Phase 6 completed and cleanly committed phase-by-phase on branch `refactor/project-restructure`. Public API (`src/index.ts`) is byte-for-byte identical. Verified with clean `pnpm run build && pnpm run lint && pnpm run typecheck`. (Note: per strict rules, test suite was not run; test paths in `tests/` were verified clean).
- **Overall progress:** M0–M11 complete. Project Restructuring (`RESTRUCTURE.md`) complete. No milestone in flight.
- **🆕 Tested 2026-07-01 — M10 lazy tree + search + selection/staging.** New coverage:
  `tests/core/treeStore.lazy.test.ts` (mutation/subscription/lazy status),
  `tests/useLazyChildren.test.tsx` (dedup, missing fetcher, error+retry, abort→reset),
  `tests/tree/flatten.lazy.test.ts` (lazy status rows),
  `tests/BookReader.lazy.test.tsx` (loading→children, retry, no-fetcher),
  `tests/BookReader.search.test.tsx` (replace + first-page descent, reset, custom
  renderSearch, in-flight coalescing) + e2e `e2e/lazy-search.spec.ts` (5: expand +
  scroll triggers, search descend, reset, custom box) and `e2e/selection.spec.ts`
  (6: stage/highlight, survives virtualization remount, unstage, deselect, show-all
  channel, locked-section guard). Also fixed the 4 stale `flatten.test.ts` assertions
  (`kind:'node'` shape). **186 unit + 23 e2e green** (was 160 unit incl. 4 red + 12 e2e;
  +26 unit, +11 e2e).
- **🐞 Real bug found + fixed by the new e2e (2026-07-01):** the reading-surface
  **lazy scroll-trigger was broken under React StrictMode** — `useLazyChildren` aborted
  the in-flight fetch on the StrictMode double-mount and left the node stuck `'loading'`
  with no in-flight promise, and the ContentPane scroll trigger only re-fires for
  `'unloaded'`, so lazy children never loaded on scroll (expand still worked — it calls
  `ensureLazy` directly). Fix: an aborted fetch now resets the node to `'unloaded'`
  (unless a newer fetch took over) so the trigger can pick it up again. Guarded by the
  `abort→unloaded` unit assertion + the `e2e/lazy-search.spec.ts` scroll-trigger test.
- **Next action:** nothing queued — await user direction. Both 2026-07-04 planned
  items are DONE (backlog worked in full; M11 coded + tested + Stable). The
  no-tests HARD RULE gate is **closed again** (that session's authorization was
  one-time); new owed tests go back into the bottom-of-file backlog.
  (The accessibility pass was **DROPPED 2026-07-02** at user request — do not
  resurrect it.)
- **🆕 Built 2026-06-30 — lazy tree + search (⚠️ Experimental):**
  - **Lazy tree:** `BookNode.lazy` + `fetchChildren` prop. The `treeStore` is now
    **mutable + subscribable** (`useSyncExternalStore` via `src/useStoreVersion.ts`):
    `setChildren`/`replaceTree`/`setLazyStatus` + version/notify. Orchestrated by
    `src/useLazyChildren.ts` (dedup, abort-on-unmount, retry, awaitable `ensureAsync`).
    **Two triggers:** tree expand (`useTreeState.onExpand`) and reading-surface scroll
    (`ContentPane` effect over window items). Placeholders: tree status rows
    (`flatten.ts` `kind:'lazy'`) + `content/LazyContentPlaceholder.tsx` in reading order.
  - **Search = tree replacement:** `showSearch`/`onSearch`/`onReset`/`searchPlaceholder`/
    `renderSearch` (+ `classNames.search`). `tree/TreeSearch.tsx` box; `BookReader`
    `runReplace` swaps the tree and `gotoFirstShowable` descends leftmost (fetching
    lazies) to the first content-bearing node. Clear-immediately loading UX.
  - **Demo:** new example 3 "Lazy & search" with a live `<FetchInspector>` sidecar
    (`demo/fetchBus.ts`) showing every fetchContent/fetchChildren/search/reset call,
    plus a default↔custom `renderSearch` toggle. build + lint + typecheck green.
- **✅ Shipped + tested (2026-06-28):** the whole M9 feature batch **plus its tests**.
  Features: configurable expand/collapse control (`renderExpandCollapse`/
  `ExpandCollapseApi`), inter-node spacing split (`--reader-content-padding-block`/
  `-inline`), `renderContentNode` wrapper prop, auto-open active branch (driven by
  explicit navigation in `goTo`, not scroll), tree-indent moved into the skin. Plus an
  **opinionated-style cleanup** (the default caret's `visibility` moved from inline
  into the skin via `data-expandable`; the bare component now carries only structural
  layout). **Tests written & green: 155 unit + 16 e2e**; build + lint + typecheck
  clean. README updated — **all features now Stable** (⚠️ Experimental markers
  dropped). Demo is a 7-example switcher (the Lazy-tree example was removed —
  see 2026-06-28 lazy-tree removal). **Dropped earlier:** `renderContentSurface`
  + broad configurable tree-node/`renderTreeRow`.
- **Workflow change (2026-06-27):** **code-first, NO TDD.** Think → code → user
  tests the app → tests only after the user approves. See `CONVENTIONS.md`.
- **✅ Resolved (2026-06-27):** the intermittent scroll flicker. The user-visible
  cause was a **StrictMode double-`ResizeObserver` leak** (observer created in render
  → duplicated → anchor correction applied twice); fixed by owning the observer in a
  `useLayoutEffect`. Found & fixed alongside two more anchor defects: a wrong
  correction condition (straddle over-correction → use the node's *bottom* edge) and
  a native scroll-anchoring conflict (`overflow-anchor: none`). Guarded by
  `content/ContentPane.anchor.test.tsx` (jsdom logic) + a real-browser
  `e2e/reader.spec.ts` "reading line stays put" test. See top of session log.
- **Done so far in M8:** core coverage reviewed (solid), bundle/tree-shake
  re-confirmed, demo rewritten into a 4-example switcher with faker data
  (`demo/data.ts`), **e2e (Playwright) suite added (`e2e/reader.spec.ts`, 6 tests,
  no mocks)** — which on first real-browser run found & fixed two bugs: cache
  poisoning by aborted fetches (`cache.load`) and an unbounded reading viewport
  (reader root `height:100%`). **README written** (`README.md` — consumer usage
  guide). See the latest session-log entry. **Publishing is out of scope** — the
  user packages manually (no version bump / publish from here).
- **Blocked on:** nothing. (The Lazy & search demo was verified and its tests
  landed 2026-07-01.) Package name = `book-reader`. pnpm is the package manager.
- **Last updated:** 2026-07-04

---

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

## How we work (code-first — NO TDD, changed 2026-06-27)
Loop: **think → code → the user tests the running app → after the user approves,
write regression tests** (see `CONVENTIONS.md`). Do not write tests before the
implementation or before the user has approved the behavior. Keep `pnpm build` +
lint + typecheck green as you go; browser-only behavior is guarded in `e2e/`
(Playwright), pure logic in jsdom — both **after** approval.

---

## M0 — Project scaffold & conventions ✅
**Goal:** an installable, buildable empty library + dev harness.
- [x] Vite library-mode project, TypeScript strict (+ noUncheckedIndexedAccess).
- [x] `package.json`: ESM+CJS+types exports, React 18 peer dep, pnpm, scripts.
- [x] Vitest wired (jsdom + RTL deps); smoke test passes.
- [x] Demo app (`/demo` + root `index.html`) renders placeholder.
- [x] Lint (eslint flat config, no-explicit-any=error) + prettier config.
- [x] `src/` entry created; full folder structure grows per milestone.
**Done when:** `build`, `test`, `typecheck`, `lint` all run clean. ✅

## M1 — Types & public API surface
**Goal:** the full TypeScript contract, no behavior yet.
- [ ] `Node`, `BookReaderProps`, `FetchContext`, `CacheConfig`, render-prop types.
- [ ] Component exported with props typed; renders empty shell (two panes).
- [ ] Types reviewed against `REQUIREMENTS.md` §5.
**Done when:** consumers get full autocomplete; `tsc` passes.

## M2 — Tree model (sync + async) ✅
**Goal:** the left pane with both data strategies.
- [x] Normalized internal tree store (id-indexed) supporting partial/lazy trees.
- [x] Accept full sync `tree` object (+ forest of roots).
- [x] Lazy node support in store (`hasChildren`, `setChildren`).
- [x] Accept async `loadChildren`; lazy-expand on demand (`useTreeState`, in-flight dedup).
- [x] Expand/collapse, selection (controlled/uncontrolled), roving-tabindex keyboard nav.
- [x] Default tree node renderer + `renderTreeNode` override.
**Done when:** both a small inline book and a lazy book render & expand. ✅
(Demonstrated in `demo/main.tsx`. Top-level `BookReader` two-pane composition
folds in with M3 when the right pane lands.)

## M3 — Content fetch + continuous render (no virtualization yet) ✅
**Goal:** right pane reads top-to-bottom.
- [x] `fetchContent` integration (sync + async), `FetchContext` assembled
      (`content/useNodeContent.ts`: sync settles flash-free, async loading state,
      per-fetch `AbortController`, retry).
- [x] HTML sanitization (toggle + custom fn), `renderContent` override
      (`content/sanitize.ts` allowlist sanitizer; `sanitize` prop = `true`/`false`/fn).
- [x] Depth-first reading-order traversal (`getNext/getPrev`, + `getSequence()` for
      whole-book layout). [Custom `getNextNode`/`getPrevNode` overrides deferred to
      M6, where scroll auto-advance actually consumes "next node".]
- [x] Loading / error / empty states + their render-props
      (`renderLoading`/`renderError`(+retry)/`renderEmpty`, shipped defaults).
**Done when:** a book renders its nodes in book order in one scroll surface. ✅
(`content/ContentPane.tsx` + top-level `BookReader.tsx`; demo renders sync + lazy
roots with a slow + a failing section. 69 tests green.)

## M4 — Caching layer ✅
**Goal:** bounded auto-cache, delegated-but-safe.
- [x] In-memory content cache keyed by node id (`core/cache.ts`,
      `createContentCache`; stores sanitized HTML, recency via Map order).
- [x] LRU eviction by `maxChars` (default ~5M), `maxNodes`, custom `evict`
      (eviction only fires when over budget; pinned ids never offered to `evict`).
- [x] In-flight de-duplication (`dedupe(id, factory)` shares one promise; caches
      on resolve, clears on settle; `getInFlight` exposes the pending load).
- [x] Pinned window (`setPinned(ids)` exempts ids from eviction; re-runs eviction
      when the pinned set changes). The *driver* (which ids = viewport+overscan+
      prefetch) lands in M5.
- [x] Unit tests for eviction & pinning (20 cache tests + 2 ContentNode cache
      integration tests).
**Done when:** cache stays bounded under large-book simulation; pinned nodes survive. ✅
(Wired into `useNodeContent`/`ContentNode`/`ContentPane`; `BookReader` creates one
cache per instance via `useRef`, captured at mount, fed by the new `cache` prop.
Re-entering a node is a synchronous cache hit — verified by RTL test.)

## M5 — Virtualization + stable scroll ✅
**Goal:** huge books perform; zero flicker.
- [x] Windowing: mount only viewport + overscan (`core/virtualizer.ts` `getWindow`;
      spacer paddings hold the off-screen scroll height).
- [x] Height map: measure, remember, estimate unknowns (`setHeight` returns the
      delta vs the previously-used height).
- [x] Anchor correction on height delta (no scroll jump) — `correctScrollTop`
      (pure) + `useVirtualList` nudges `scrollTop` synchronously in the RO callback
      when a node above the viewport top changes height.
- [x] Scroll-back over read content is a synchronous cache hit (no flash) — the
      pinned window (`pinnedIds`) covers mounted + prefetch so it's never evicted.
- [x] Prefetch-ahead (configurable `prefetchCount`) — `prefetchIds` + `cache.dedupe`
      via `prefetchNodeContent` warm the next nodes before they enter view.
**Done when:** scrolling a 10k-node simulated book is smooth and never jumps/flickers. ✅
(`core/virtualizer.ts` 21 unit tests; React wiring in `content/useVirtualList.ts` +
`ContentPane` driving `cache.setPinned()`; 3 integration tests stub scroll geometry.
Demo adds a 5,000-section sync book. 115 tests green.)

## M6 — Scroll ⟷ tree sync & auto-advance ✅
**Goal:** the two panes move together.
- [x] Scroll position → active node detection → tree highlight + ancestor auto-expand
      (`core/scrollSync.ts` `activeNodeAt`; `BookReader` lifts one `useTreeState`,
      highlights the active node, and auto-expands its path deepest-first only when
      the active node changes).
- [x] Scroll-to-bottom auto-fetches & appends next node (`isNearBottom` +
      `nextNodeToLoad` → `onNeedNode` → `useTreeState.load`, de-duped; version bump
      regrows the sequence). Reading-order overrides (`getNextNode`/`getPrevNode`)
      consumed via `withReadingOverrides`.
- [x] Tree click → scroll content to node (`virtualizer.offsetAt` +
      `useVirtualList.scrollToId`, driven by a tokened `scrollRequest` prop).
- [x] `location` controlled/uncontrolled + `onLocationChange` (active node id +
      offset; echo-guard stops a controlled `location` from bouncing the view).
**Done when:** reading scrolls the tree; clicking the tree scrolls the reading. ✅
(Pure mapping in `core/scrollSync.ts` (15 tests) + `virtualizer.offsetAt`; React
wiring in `useVirtualList` (now tracks live scroll), `ContentPane`, `BookReader`;
3 RTL scroll-sync integration tests. **134 tests green.** Also closed an M5 gap:
the virtual list had no scroll listener, so the window never recomputed on scroll —
M6 adds it.)

## M7 — Styling system ✅
**Goal:** great defaults, progressive override.
- [x] Default stylesheet (importable CSS) — `src/styles/book-reader.css`, emitted
      to `dist/book-reader.css` by a Vite plugin (`emitDefaultStylesheet`) and
      exposed as `book-reader/styles.css`. *Not* imported by the JS graph, so it's
      opt-in + tree-shake-safe (verified: no `.css` ref in the JS bundle).
- [x] `--reader-*` custom properties for theming — full token set on
      `[data-part="book-reader"]` (font/colors/surfaces/spacing/indent/radius);
      every rule reads tokens. `--reader-tree-indent` still drives row inset inline.
- [x] Stable `data-part` hooks + per-slot `className`s — audited all hooks (present);
      wired the previously-unapplied `classNames.root` and added `classNames.treeNode`
      (threaded through `TreePaneView`/`TreePane` via `treeNodeClassName`).
- [x] Demo showcases default, themed, and fully-custom skins — a skin switcher
      (default / themed token-override / fully-custom render-props), M6 location
      readout kept.
**Done when:** all three styling tiers demonstrated in the demo. ✅
(`src/styles/book-reader.css` + Vite emit plugin; `classNames.root`/`treeNode`
wired; 3 RTL styling tests assert data-part hooks + classNames threading + token
consumption. **137 tests green.** Default skin works without the stylesheet
because functional layout stays inline; the CSS layers presentation only.)

## M8 — Hardening, docs, examples
**Goal:** ship-ready. (Packaging/publishing is out of scope — the user does that
manually; do not run `npm pack`/`publish` or bump the version.)
- [x] README with quickstart + full prop reference (`README.md` — consumer usage
      guide: install, quickstart + sized-container note, core concepts, lazy trees,
      states, controlled/uncontrolled `location`, reading-order overrides, 3-tier
      styling, full prop table, advanced exports).
- ~~Accessibility pass (tree roles, focus, aria, keyboard)~~ — **DROPPED
      2026-07-02 at user request** (no plan to implement a11y; do not write
      a11y/keyboard/focus tests or propose an a11y pass).
- [x] Core coverage reviewed — traversal (18) / cache (20) / treeStore (8) /
      virtualizer (22) / scrollSync (15) all well-covered; no holes found.
- [~] Bundle-size / tree-shake re-confirmed: 31.9 kB JS (9.09 kB gzip), 7.45 kB
      CSS; zero `.css` refs in the JS bundle (CSS stays opt-in).
- [x] Rich runnable examples: demo rewritten into a 4-example switcher
      (Quickstart / Lazy / States / Styling+location) over faker-generated,
      deterministic, lazily-materialised book data (`demo/data.ts`). **Now
      browser-verified** (the e2e run drives the real demo).
- [x] **End-to-end test (Playwright): scroll-to-end auto-advance shows next
      content.** `e2e/reader.spec.ts` (6 tests, real Chromium, no mocks) +
      `playwright.config.ts` (`webServer: pnpm dev`, `reuseExistingServer`) +
      `test:e2e` script. Covers: content renders (no spurious "No content."),
      scroll-to-end auto-advance, resize→fetch-more, bounded-viewport
      virtualization, and stable scroll-back. Browser-verifying the demo exposed
      **two real bugs, both fixed** — see the session log entry.
- [x] **Stable-scroll hardening:** fixed the scroll flicker that violated the
      no-flicker requirement — a StrictMode double-`ResizeObserver` leak in
      `content/useVirtualList.ts` (observer now owned by a `useLayoutEffect`), plus a
      straddle over-correction (`correctScrollTop` uses the node's bottom edge) and a
      native scroll-anchoring conflict (`overflow-anchor: none`). Guarded by
      `content/ContentPane.anchor.test.tsx` + `e2e/reader.spec.ts` "reading line
      stays put". See session log.
**Done when:** demo covers all requirements + the e2e scroll-to-end test is green.

---

## M9 — Generic (object) node + content payloads, headless control (planned)
**Goal:** let advanced users model nodes and section content as **arbitrary
objects, not just strings**, and own the rendering end-to-end. Requested by the
user 2026-06-27.
- [x] **Generic content payload.** ✅ implemented 2026-06-28 (awaiting user test).
      `fetchContent` now returns a generic `Content` (default `string` for
      back-compat): `FetchContent<Meta, Content>` returns `Content`; `RenderContent`
      receives the typed `Content`. Sanitize/`dangerouslySetInnerHTML` only applies
      to the string path; object payloads pass through and the consumer's
      `renderContent` owns output. `Content` threaded through `useNodeContent`,
      the cache (`ContentCache<Content>`, `sizeOf`), `ContentNode`, `ContentPane`,
      `useVirtualList`, `prefetchNodeContent`, `BookReader`. **`ContentState.html`
      renamed → `ContentState.content`.** Demo example 7 "Object content"
      (`RichSection` payload + typed `renderObjectContent`). Regression tests
      deferred → NEXT_SESSION PENDING TESTS.
- [ ] **Richer node data.** `BookNode.meta` already carries arbitrary data; verify
      the render props (`renderTreeNode`, `renderContent`) expose it ergonomically
      so advanced users get "full control of all the things" without casts.
- [x] **Configurable expand/collapse control (contract).** ✅ implemented
      2026-06-28 (awaiting user test). `renderExpandCollapse?: RenderExpandCollapse`
      + `ExpandCollapseApi { expandable; expanded; loading; depth; toggle; expand;
      collapse }` in `types.ts`; replaces *only* the caret in `TreePane.tsx`
      (library keeps row wrapper + `aria-expanded` + keyboard nav + the
      `data-part="tree-node-caret"` default). Threaded `TreePaneView`→`TreePane`→
      `BookReader` (shared `treeView`, so the overlay tree gets it too). Demo
      example 7 "Render hooks" (+/− caret). Tests deferred → backlog item 5.
      ← the **only** tree
      customization in scope (broader tree-node/row wrapper was **dropped** by the
      user 2026-06-28). Today the **caret (`▾`/`▸`) is hard-coded** in `TreePane.tsx`
      and `renderTreeNode(node, state)` only replaces the row's *inner label*. Make
      the expand/collapse disclosure a first-class, replaceable component with a
      stable **contract** so consumers can ship their own control (icon, animated
      chevron, +/− button, twisty) **without re-implementing tree a11y or keyboard
      nav**. Proposed API (names provisional):
        - `renderExpandCollapse?: RenderExpandCollapse` — replaces just the
          disclosure control. `RenderExpandCollapse = (api: ExpandCollapseApi) =>
          ReactNode`, where `ExpandCollapseApi = { expandable; expanded; loading;
          depth; toggle(); expand(); collapse() }`. The library still renders the row
          wrapper + wires `onClick`→`toggle` and `aria-expanded`; the custom
          component is **presentation only**. Keep `data-part="tree-node-caret"` as
          the no-JS CSS hook.
      Threads through `TreePaneView` → `TreePane` → `BookReader` (+ the overlay tree,
      which shares the same `treeView`). New type in `types.ts`; new prop on
      `BookReaderProps`. Demo: a tree example swapping the caret for a custom one.
- [x] **Inter-node spacing control.** ✅ implemented 2026-06-28 (awaiting user
      test). Split the content-node padding into `--reader-content-padding-block` /
      `--reader-content-padding-inline` (vertical gap between sections = 2× block
      padding, tunable independently of the inline inset); `--reader-content-padding`
      kept as a shorthand that overrides both. Defaults reproduce `1.5rem 2rem`.
      Tests deferred → backlog item 7.
- [x] **Per-node content wrapper render prop (`renderContentNode`).** ✅ implemented
      2026-06-28 (awaiting user test). `RenderContentNode` + `ContentNodeApi
      { node; state; wrapperProps; children }` + `ContentNodeWrapperProps`
      (`ref`/`className`/`data-part`/`data-node-id`/`data-status`/`aria-busy`).
      `ContentNode` builds the wrapper props and, when the prop is supplied, hands
      body + props to the consumer instead of its `<article>`. Threaded
      `ContentPane`→`BookReader`. Demo example 7 wraps each section in a `<section>`
      with a status badge. Tests deferred → backlog item 6. **Content side only** —
      the tree-row wrapper (`renderTreeRow`) and `renderContentSurface` were dropped.
- [x] ~~**Headless / controlled tree-collapse.**~~ **REMOVED 2026-06-28.** The
      controlled overlay open state (`treeOpen` + `onTreeOpenChange`) that let a
      toggle outside `<BookReader>` drive the section overlay was removed per the
      user: the reader must not expose a way to put the collapse button/tree outside
      the component. The overlay is now **uncontrolled only**. The custom-but-inside
      hooks (`renderTreeToggle`/`renderTreeOverlay`) and restyling
      (`classNames.treeToggle`/`.treeOverlay`) are kept. The "tree as a standalone"
      need is still met by the already-exported `TreePane`/`TreePaneView`.
- [x] **Auto-open active branch.** ✅ implemented + tested 2026-06-28. Selecting a
      branch (explicit navigation via `goTo`) opens its *own* children, not just its
      ancestors — so clicking a Part reveals its sections. Driven by navigation, not
      the scroll-derived active id, so the top of the book is never auto-dumped on
      load. Covered by `tests/BookReader.autoExpand.test.tsx`.
- [x] **Tidy default styles (tree-indent into skin).** ✅ implemented 2026-06-28.
      Rows now expose depth as data (`--br-tree-depth` + `data-depth`); the skin
      computes `padding-inline-start` from it × `--reader-tree-indent`, so the bare
      component carries zero inline indent. Tests deferred → backlog item 8.
**Done when:** a demo example renders object-content nodes via a custom
`renderContent`, with the string path unchanged (back-compat); and a tree example
swaps the expand/collapse caret for a custom component via the new contract, with
the default caret + a11y/keyboard nav unchanged when no override is supplied.

---

## Session log (append newest on top)
- 2026-07-05 (latest) — **Project Restructuring (`RESTRUCTURE.md`) completed.** Executed all 6 phases on branch `refactor/project-restructure` (no behavior change, public API byte-for-byte identical):
  - **Phase 1 (`core/`)**: Organized into `core/tree/` (`treeStore`, `traversal`, `flatten`) and `core/content/` (`virtualizer`, `anchoring`, `scrollSync`, `cache`).
  - **Phase 2 (`utils/`)**: Organized into `utils/content/` (`sanitize`, `content`, `prefetchNodeContent`), `utils/tree/` (`collapse`), and `utils/common/` (`cx`, `length`, `thenable`).
  - **Phase 3 (`types/`)**: Re-cut internal layer types into feature buckets (`types/{layer}/{bucket}/`) with bucket barrels, preserving `types/public/` and top-level `types/index.ts` barrel untouched.
  - **Phase 4 (`hooks/`)**: Organized into `hooks/bookReader/`, `hooks/tree/` (with nested `view/`, `search/`, `overlay/`), `hooks/content/` (with nested `node/`), and `hooks/common/`.
  - **Phase 5 (`components/`)**: Organized into `components/bookReader/` (extracted `TreeToggleBar`), `components/tree/` (split `TreePaneView` out of `TreePane`, nested `view/`, `search/`, `overlay/`), and `components/content/` (extracted `ContentLoading`, `ContentEmpty`, `ContentError` into `node/`).
  - **Phase 6 (final)**: Updated architecture documentation (`CLAUDE.md`, `CONVENTIONS.md`) and verified all test import paths in `tests/` point cleanly to the new feature-uniform layout. Verified green with `pnpm run build && pnpm run lint && pnpm run typecheck`. (Per strict repo rules, test suite execution was deferred to user request).
- 2026-07-04 (latest) — **Pure-logic extraction: hooks → `core/`/`utils/` (no
  behavior change, user-requested).** Freed the hooks of inline algorithms so
  they only do React wiring (SOLID/separation-of-concerns pass, follow-up to the
  dumb-components refactor). New `src/core/anchoring.ts` (React-free): the
  **direction-aware anchor-correction policy** moved out of `useVirtualList` —
  `applyHeightMeasurements` (the ResizeObserver height-change path) +
  `reconcileSequenceSwap` (the id-swap layout-effect path, the LZ-UP fix) +
  `ScrollDirection`/`IsSettled` types; the hook now only maps observed elements
  → ids, reads DOM heights, and applies the returned scrollTop/correction.
  Ports are **line-faithful** (same pre-mutation snapshot order, same anchor
  selection, same fold rules) — do not "simplify" them without the LZ-UP/fuzz
  e2e green. `core/traversal.ts` gained `findFirstShowable` (the leftmost
  lazy-resolving walk from `useBookReader.gotoFirstShowable`; the hook keeps
  only the `goTo` call) and `resolveToShowable` (from `useContentPane.
  resolveContentId`). New utils: `collapse.ts` (`shouldCollapseTree` — the
  responsive-collapse predicate from `useBookReader`), `thenable.ts`
  (`isThenable`, **deduped** — was copy-pasted in `useNodeContent` +
  `prefetchNodeContent`), `content.ts` (`isEmptyContent`), and
  `sanitize.ts › resolveContentSanitizer` (the string-only payload sanitizer,
  also deduped from those two files). **Public API unchanged** (nothing new
  exported from `index.ts`). Deliberately NOT extracted: `useTreePaneView`'s
  keyboard `switch` (event-coupled UI dispatch, and a11y work is dropped —
  not algorithmic), `useLazyChildren` (pure orchestration), the echo-guard
  trail in `useBookReader` (5 lines, extraction would obscure it). Build +
  lint + typecheck green. **UPDATE (same session): the user explicitly
  authorized running the suites — `pnpm test` 205/205 and `pnpm test:e2e`
  48/48 ALL PASS** (incl. the LZ-UP/LZ-DOWN lazy-neighbour and no-flicker
  fuzz guards over the moved anchoring code). No new tests owed (pure moves;
  existing anchor/e2e suites are the guard).
- 2026-07-04 (later) — **Structural refactor: dumb components + organized folders
  (no behavior change, user-requested).** All React components are now
  presentation-only; every behavior lives in a hook. New layout:
  `src/components/` (BookReader + `tree/` TreePane/TreeSearch/TreeOverlay/
  defaultTreeNode + `content/` ContentPane/ContentNode/LazyContentPlaceholder),
  `src/hooks/` (all hooks — existing ones moved in, plus **new extractions**:
  `useBookReader` ← BookReader's entire coordinator logic, `useContentPane` ←
  sequencing/virtualization wiring/scroll-request/lazy-trigger, `useTreePaneView`
  ← row flattening + roving-focus keyboard nav, `useTreeSearch` ← query state +
  SearchApi, `useTreeOverlay` ← dialog focus/Esc/outside-click; renamed
  `useReaderWidth.ts` → `useElementWidth.ts`), `src/types/` (monolithic
  `types.ts` split into node/reading/fetching/search/tree/content/cache/props +
  barrel `index.ts` — old `src/types` import specifiers still resolve;
  `ScrollRequest` moved here from ContentPane, re-exported for compat),
  `src/core/` unchanged (+ `flatten.ts` moved in from `tree/` — it's pure),
  `src/utils/` (`sanitize.ts`, `prefetchNodeContent.ts`, `length.ts` =
  lengthToPx/toCssLength, `cx.ts` classname join). **Public API unchanged**
  (index.ts exports identical). All moves via `git mv`; test files untouched
  except import paths. Build + lint + typecheck green; **suite NOT run** (test
  HARD RULE — user should run `pnpm test` + `pnpm test:e2e` to confirm the
  refactor, all 205 unit + 48 e2e are expected to pass as-is). **UPDATE (same
  day): the user ran both suites — all 205 unit + 48 e2e PASS.** No new tests
  owed (pure restructure, no new behavior).
- 2026-07-04 — **Test-bookkeeping audit (no tests written or run).** Rebuilt the
  mandatory **⏸ PENDING TESTS backlog at the bottom of this file** — it had been
  cleared 2026-07-01 (when the M10 tests landed) while real gaps remained, violating
  the continuous-bookkeeping HARD RULE. Audited all 42 e2e + 200 unit tests first.
  **Headline gap (user-flagged): the lazy effective-neighbour case** — scroll-up
  from a node like `5.1.1` must recursively resolve the lazy branch above (`4.9`)
  until its deepest-last leaf (`4.9.9.9.9`) sits directly above; this behaviour was
  fixed on request but has **no regression coverage at any layer** (the cross-branch
  neighbour e2e uses the eager Styling book; the lazy scroll e2e only proves
  downward resolution with no neighbour-identity assertion). Backlog now holds:
  P1 lazy-neighbour e2e (LZ-UP/LZ-DOWN + asymmetric-depth fixture), P2 carry-overs
  (E5/E6/E8/U2/U3), P3 health (cross-branch flake, 3 unimplemented fuzzer-oracle
  checks). **Staleness purged:** STATUS no longer names the dropped a11y pass as
  next action; "Blocked on: user verification" cleared (landed 2026-07-01); the M8
  a11y checklist item + the "Remaining (only): a11y" block struck through;
  `TEST_PLAN.md` §7 corrected — **U1 is DONE** (`tests/core/resolveToNode.test.ts`,
  9 tests) — and now defers to this backlog as canonical. **User decisions (same
  day, via Q&A):** (1) E5's open question resolved — the library WILL ship a
  **book/tree-level** default "no results / no data" template + a consumer override
  render prop (→ new **M11** section; per-section `renderEmpty` already exists,
  this is the missing level); (2) the P1 lazy fixture must use **asymmetric
  depths** (different-depth neighbouring branches); (3) **next session is
  authorized to work the whole PENDING TESTS backlog** (P1 first) and to code M11
  before its E5 test — workspace prepped accordingly (STATUS → Next action).
- 2026-07-02 — **Test-coverage expansion (autonomous, per reviewed `TEST_PLAN.md`).**
  Added real-browser e2e for the failure/recovery + interaction-fuzz gaps the
  happy-path suite left. New specs (all green): **`e2e/errors.spec.ts`** (content
  error→retry→loaded; empty≠error; rapid-nav no cache poisoning; lazy child-fetch
  error placeholder→retry) · **`e2e/fuzz.spec.ts`** (seeded random click/scroll/
  expand walk with an invariant oracle — no blank, no "No content.", nothing stuck
  loading/error, bounded scrollTop, no pageerror — over quickstart/styling/lazy/
  tiny-cache × seeds 1,7; seed+action-log printed on failure) · **`e2e/location.spec.ts`**
  (controlled `location` drive+echo doesn't lock the view; remount-across-tabs
  teardown holds no-flicker, guarding the StrictMode observer-leak class) ·
  **`e2e/cache-eviction.spec.ts`** (tiny `cache.maxChars` → evict→scroll-back→refetch
  stays loaded/correct; per-slot `classNames` threading). Demo scaffolding: new
  `makeStatesBook`/`makeFailingFetchChildren` + tabs **"9 · States & errors"** and
  **"10 · Tiny cache"** in `demo/main.tsx`. Key fixes found while writing: fuzzer
  needs `actionTimeout` so a non-actionable click fails fast (else it hangs the whole
  test budget); several fold/text assertions must wait for `loaded`/settle before
  measuring. **Accessibility tests (E4) REMOVED at user request — no plan to
  implement a11y; treat the historical "accessibility pass" milestone as dropped.**
  Deferred to next slice (in `TEST_PLAN.md`): E5 zero-result search (open product
  question re: empty state), E6 empty/single book, E8 custom getNextNode/getPrevNode,
  unit U1–U3. Note: `reader.spec.ts` cross-branch scroll test is a **pre-existing**
  flake under full-suite load (passes in isolation).
- 2026-06-28 — **Lazy tree-structure loading removed entirely (at the user's
  request — "keep things simple").** Scope: only the **tree structure**; lazy
  **content** (`fetchContent` + cache + virtualization) is untouched and remains
  the core. Deleted: `loadChildren`/`LoadChildren`/`LoadChildrenContext`, the
  `BookNode.hasChildren` field, `treeStore.isLoaded`/`setChildren` (children are
  always known up front; `childIds` is always an array), `scrollSync.nextNodeToLoad`
  + the `ContentPane.onNeedNode`/`BookReader` auto-load wiring + the tree `version`
  plumbing, and the `TreeNodeState.loading`/`ExpandCollapseApi.loading` spinner state
  (+ its `tree-node-spinner` CSS). `useTreeState` simplified to expand/collapse/select
  only. Demo: the "Lazy tree" example removed (8→7 switcher) + `makeLazyBook`/
  `loadChildren` generators dropped from `demo/data.ts`. Tests: lazy-only unit specs
  removed (`treeStore`/`traversal`/`scrollSync`/`TreePane` lazy blocks) and incidental
  `hasChildren` fixtures converted to real `children`; e2e "Lazy tree renders",
  "scroll-to-end auto-advances", and "resize pulls in more" removed (the bounded-
  viewport + no-flicker + nav e2e remain). Docs updated: REQUIREMENTS §2.1 (sync tree
  only), README (dropped the "Lazy trees" section + `BookNode.hasChildren`/`loadChildren`
  rows), CLAUDE.md, CONVENTIONS.md. **`tree` is now the sole tree source.** build +
  lint + typecheck green. ⚠️ Tests not yet re-run by the user this session.
- 2026-06-28 — **Opinionated-style cleanup + the whole test backlog written (green).**
  Two-part session at the user's request. (1) **Removed the last opinionated inline
  style:** the default tree caret's `visibility` (hide on non-expandable rows) moved
  out of inline style into the opt-in skin via a `data-expandable` attribute, so the
  bare (no-skin) component now carries *only* structural layout — no presentational
  inline style anywhere. (2) **Wrote the deferred test backlog** as a small set of
  essential integration + real-browser e2e flows (not exhaustive units; minimal
  mocking): new `tests/BookReader.objectContent.test.tsx`, `tests/tree/expandCollapse.test.tsx`,
  `tests/content/renderContentNode.test.tsx`, `tests/BookReader.collapse.test.tsx`
  (modes + headless + overlay-min), `tests/BookReader.autoExpand.test.tsx`; updated the
  styling indent test for the new `--br-tree-depth` mechanism; added 5 e2e blocks
  (responsive collapse, render hooks, headless toggle, object content, spacing split).
  Added `scrollIntoView` no-op to `vitest.setup.ts`. **Refined auto-open-active-branch
  while writing tests:** the real-browser run showed the active node *flips during load*,
  so the previous "active branch expands itself" logic auto-dumped the root on mount and
  broke the collapsed-at-top contract (and two existing e2e). Re-driven off **explicit
  navigation** (`goTo` — a tree selection) instead of the scroll-derived active id, so
  selecting a Part opens its sections but the top of the book is never auto-expanded.
  **155 unit + 16 e2e green; build + lint + typecheck clean.** README: dropped all ⚠️
  Experimental markers — **every feature is now Stable** (test-covered); Feature-stability
  section rewritten. MILESTONES PENDING-TESTS backlog cleared (replaced with a
  what-landed-where map). **Only remaining: the accessibility pass.**
- 2026-06-28 — **M9 batch built in one pass (awaiting user test).** Per the user's
  batch directive, shipped *all* remaining M9 features (a11y excluded) together:
  (1) **`renderExpandCollapse`** + `ExpandCollapseApi` — replaces only the tree
  caret; library keeps row wrapper + `aria-expanded` + keyboard nav +
  `data-part="tree-node-caret"`; threaded `TreePaneView`→`TreePane`→`BookReader`.
  (2) **Inter-node spacing split** — `--reader-content-padding` is now the
  `--reader-content-padding-block`/`-inline` shorthand; vertical section gap is
  tunable independently (defaults `1.5rem 2rem` unchanged). (3) **`renderContentNode`**
  + `ContentNodeApi`/`ContentNodeWrapperProps` — consumer owns the per-section
  wrapper element; spreads back `ref`(measureRef)/`className`/`data-*`/`aria-busy`;
  composes with `renderContent`. (4) ~~**Headless/controlled tree-collapse**~~ —
  `treeOpen`/`onTreeOpenChange` shipped here but were **removed 2026-06-28** (no
  driving the overlay from a toggle outside `<BookReader>`); the overlay is
  uncontrolled only. (5) **Auto-open active branch** — the auto-expand
  effect now also expands the active node itself when it's a branch. (6) **Tidy
  default styles** — tree rows expose depth as `--br-tree-depth`/`data-depth` and the
  skin owns the indent calc, so the bare component has zero inline indent. Touched
  `types.ts`, `index.ts`, `tree/TreePane.tsx`, `content/ContentNode.tsx`+`ContentPane.tsx`,
  `BookReader.tsx`, `styles/book-reader.css`; demo grew to an **8-example switcher**
  (new "Render hooks" + "Headless tree" examples, `demo/demo.css` styles). README:
  new "Render hooks" + "Headless tree control" sections + prop-table rows +
  Feature-stability entries (both render props + headless ⚠️ Experimental). Owed tests
  logged (PENDING TESTS items 5–10). build/lint/typecheck green; **no tests written
  or run** (HARD RULE). **Next: user tests the batch → iterate → a11y pass + tests.**
- 2026-06-28 — **Collapse modes given named values (ergonomic polish; no new feature).**
  Brainstormed the user's "let the developer force the button/popover even at full
  width" ask and **confirmed it already shipped** — `collapseTree={true}` forces the
  collapsed UI at any width, `'auto'` is width-driven, `false` never collapses; the
  modes are mutually exclusive and **all customization hooks** (`renderTreeToggle`/
  `renderTreeOverlay`/`treeCollapseLabel`/`treeOverlayMin*`/`classNames`) apply across
  modes because every mode funnels through one `collapsed` boolean → one render path.
  So **no new milestone**; instead did the elegance polish the user asked for: the
  prop now accepts **named modes** `collapseTree: 'auto' | 'always' | 'never'` (the
  `true`/`false` booleans still accepted for back-compat: `true`⇒`'always'`,
  `false`⇒`'never'`). Touched `types.ts` (type + doc), `BookReader.tsx` (`forceCollapsed`/
  `forceExpanded` derivation), demo example 6 "Always collapsed" now uses
  `collapseTree="always"`. build/lint/typecheck green. **Code-first → no tests yet**;
  owed case logged below. **Also documented the collapse feature in the README** (new
  "Collapsible tree" section + `collapseTree`/`contentMinWidth`/`treeCollapseLabel`/
  `treeOverlayMin*`/`renderTreeToggle`/`renderTreeOverlay` rows in the prop table +
  `treeToggle`/`treeOverlay` classNames) — it had postdated the responsive feature and
  was previously undocumented. **New HARD RULE (user, in `CLAUDE.md` + `CONVENTIONS.md`):
  the moment a feature is coded it gets documented in `README.md` marked ⚠️ Experimental;
  it graduates to Stable only once its tests exist (test timing user-controlled).**
  Applied it: added a **Feature stability** section + documented the generic **object
  content payload** ("Custom content payloads") and marked **both** it and the
  **Collapsible tree** ⚠️ Experimental (both shipped, neither test-covered yet);
  everything older/test-covered stays Stable.
- 2026-06-28 — **M9 scope trimmed + reprioritized (user).** **Dropped**
  `renderContentSurface` (whole-text-area wrapper) and the broad **configurable tree
  node / `renderTreeRow`** wrapper. **Kept** only the *expand/collapse control* as
  configurable — narrowed that item to `renderExpandCollapse` + `ExpandCollapseApi`
  contract (caret-only; library keeps row wrapper + a11y/keyboard nav). `renderTreeRow`
  removed; the per-node *content* wrapper survives as `renderContentNode` (content
  side only). **Accessibility pass moved to LAST.** New order: 3 expand/collapse
  control ← NEXT · 4 inter-node spacing · 5 `renderContentNode` · 6 headless collapse ·
  7 auto-open active branch · 8 tidy default styles · 9 a11y. Also removed the demo
  **"States" example** (loading/error/empty) — demo is now a 6-example switcher.
- 2026-06-28 — **M9: generic (object) content payload implemented (awaiting user test).**
  Threaded a `Content = string` generic through the entire content path so
  `fetchContent` can return any typed payload, not only sanitized HTML strings
  (default `string` ⇒ existing usage unchanged). Sanitize/`dangerouslySetInnerHTML`
  now run **only** on the string path; object payloads pass through to a
  consumer-owned `renderContent(node, payload, state)`. Touched `types.ts`
  (`FetchContent<Meta,Content>`, `RenderContent<Meta,Content>`, `ContentState<Content>`
  — **field `html`→`content`**, `BookReaderProps<Meta,Content>`), `useNodeContent`
  (generic + `isEmptyContent`), `ContentNode` (renderContent-wins / string-default /
  object-no-default), `ContentPane`, `useVirtualList`, `prefetchNodeContent`,
  `BookReader`; `core/cache.ts` was already generic. Demo example 7 "Object content"
  (`RichSection` payload + `makeObjectFetchContent` + typed `renderObjectContent` +
  `.obj-*` CSS). build/lint/typecheck green. **Code-first → no regression tests yet**;
  full backlog noted in NEXT_SESSION PENDING TESTS. Next: `renderContentSurface`.
- 2026-06-28 — **Responsive tree-collapse implemented (awaiting user test); M9 added;
  next-session order set by the user.** Built the "reading width wins" collapse:
  when the reader can't fit tree + `contentMinWidth`, the tree collapses to a toggle
  **stacked above** the reading surface (not overlapping) that opens a **popover
  anchored below it**, showing the same wired tree **at the current reading position**
  (active row focused + scrolled in). New props `contentMinWidth`/`collapseTree`/
  `treeCollapseLabel`/`renderTreeToggle`/`renderTreeOverlay` + types; new
  `src/useReaderWidth.ts` (`useElementWidth` + `lengthToPx`) and `src/tree/TreeOverlay.tsx`
  (in-subtree popover, dialog a11y, Esc + outside-click, focus return). Demo example 6
  "Responsive tree" (width slider + 4 modes). build/lint/typecheck green; headless-Chromium
  smoke-tested. **Not yet user-approved → no regression tests yet** (code-first). Added
  **M9** (generic object content payload, `renderContentSurface` wrapper render prop,
  inter-node spacing token split, maybe headless tree-collapse). **User set the
  next-session order** (see STATUS / NEXT_SESSION): finalize collapse → object payload →
  `renderContentSurface` → spacing split → a11y → 4 opted-in extras.
- 2026-06-27 — **M8: README usage guide written; publishing/version goals removed
  from the plan.** Added `README.md` — a consumer-facing usage guide derived from
  `src/types.ts`, `package.json`, and the demo: install (+ React 18 peer dep, opt-in
  `book-reader/styles.css`), quickstart with the **sized-container** note (reader is
  `height:100%`), core concepts (`BookNode` sync/lazy/leaf, `fetchContent`,
  sanitize), lazy trees (`loadChildren`), loading/error/empty render props,
  controlled vs uncontrolled `location` + custom `getNextNode`/`getPrevNode`, the
  three styling tiers, a full prop-reference table, and an advanced-exports note
  (`BookReader` is the one component; panes + pure `core/` are opt-in building
  blocks). Checked off the M8 README item. Per the user, **packaging/publishing and
  any version bump are out of scope** — removed the lingering "decide package
  name/`npm publish --dry-run`" goal from M8 (the `version: 0.0.0` in `package.json`
  is left as-is intentionally). Docs-only change; no code touched, tests unchanged.
  Remaining M8: the accessibility pass.
- 2026-06-27 — **Scroll flicker, take 2: found the *real* root cause — a StrictMode
  double-`ResizeObserver` leak — plus two more anchor-correction defects.** The
  earlier same-day fix (below) was necessary but **insufficient**; the demo still
  flickered in "Styling & location". Diagnosed empirically in a real browser
  (Playwright, measuring the fold section's per-step movement vs the scroll step —
  not a settled assertion, since the bug is mid-scroll):
  1. **StrictMode double-observer leak (the flicker).** `useVirtualList` created its
     node `ResizeObserver` via **lazy-init during render** — an impure side effect
     that StrictMode's double render + mount/unmount/remount duplicated, leaving
     **two live observers** that each applied anchor correction → the scroll jumped
     by ~2× the height delta. With StrictMode off, deviation was 0; on, ~352–658px.
     Fixed by moving observer creation into a `useLayoutEffect` (proper lifecycle,
     clean teardown) that observes already-mounted nodes on setup (their ref
     callbacks ran during commit, before the effect). *This was the user-visible
     bug.* (RTL's StrictMode simulation doesn't recreate the observer the same way,
     so only a real-browser test catches it — added one: `e2e/reader.spec.ts` ›
     "reading line stays put while scrolling".)
  2. **Wrong anchor-correction condition (straddle over-correction).** Correction
     fired when `start < scrollTop`, but a height change happens at a node's
     *bottom*, so it shifts on-screen content only when the node is **entirely
     above** the fold (`start + oldHeight <= scrollTop`). A node *straddling* the
     fold grows below the top → correcting it jerked the view. Fixed the inline
     condition and the pure `correctScrollTop` helper (now takes `itemBottom`; tests
     updated). Regression: `ContentPane.anchor.test.tsx` › straddle case.
  3. **Native scroll-anchoring conflict.** Set `overflow-anchor: none` on the scroll
     surface so the browser's own anchoring can't double up with ours (defensive;
     also Safari has none, so the manual path must be authoritative).
  Also hardened the controlled-`location` echo guard in `BookReader` (a *trail* of
  recent emits, not just the last, so a lagging echo can't slip through and fire a
  spurious scroll-to) — defensive, not the flicker cause. **139 unit + 7 e2e green;
  build + lint + typecheck clean.** Remaining M8: README + a11y pass.
- 2026-06-27 — **Fixed the intermittent scroll instability (anchor-correction
  race) [superseded by the entry above — necessary but not sufficient].** The "no
  flicker / stable view" hard requirement was being violated on *some* scrolls. Root cause in `content/useVirtualList.ts`: the `ResizeObserver`
  callback corrected `scrollTop` imperatively but **never folded the new value into
  React state**, so the `measureVersion`-driven re-render computed the window with
  the *new heights* against the *old* `metrics.scrollTop` for one frame — the active
  node jumped to an earlier section, then the browser's async `scroll` event fixed
  metrics a frame later (the flicker). Fix: after applying the correction, call
  `syncMetrics()` so the corrected scrollTop and the window recompute land in the
  **same React batch** (no bad frame). Also hardened the correction itself: it no
  longer reads a node's start from the possibly-stale **rendered window**
  (`windowRef.items`) — it resolves the *current* start straight from the height map
  via `virtualizer.offsetAt`, snapshots all pre-change starts before mutating, and
  applies one **summed** correction (so batched measurements share a consistent
  reference frame). `core/virtualizer.ts` unchanged (already correct + unit-tested).
  **Deterministic regression test** added: `content/ContentPane.anchor.test.tsx` —
  re-measures a node above the viewport taller and asserts the active node stays put
  (verified red→green: original code reported the jumped-to `c3`, fixed reports
  `c5`). Chose jsdom over Playwright deliberately: the bug is a *transient* frame a
  real browser self-corrects via the async scroll event, so a settled Playwright
  assertion can't catch it without flakiness; jsdom never fires that compensating
  event, making the bad state permanent and assertable. **138 unit + 6 e2e green;
  build + lint + typecheck clean.** Remaining M8: README + a11y pass.
- 2026-06-27 — **M8: e2e (Playwright) added; first real browser run found & fixed
  two bugs.** Added `playwright.config.ts` + `e2e/reader.spec.ts` (6 tests, real
  Chromium against the Vite demo, **nothing mocked**) + `test:e2e`. Running the
  demo for the first time in a browser surfaced two defects the jsdom unit tests
  couldn't: **(1) cache poisoning by aborted fetches** — `useNodeContent` routed
  every async fetch through `cache.dedupe`, which cached *whatever the fetch
  resolved to*, including the `''` a fetcher returns when `signal.aborted`; under
  StrictMode (and any scroll-away mid-fetch) this cached an empty body, so nodes
  showed **"No content." permanently**. Fixed by adding a refcounted
  `cache.load(id, factory(signal))` that **owns the abort signal** (one reader
  unmounting no longer cancels a fetch another still needs) and **never caches a
  result produced under an aborted signal**; the hook's async path now uses it.
  `dedupe`/`getInFlight` kept (prefetch + tests) as a hold-until-settled warm over
  the same primitive. **(2) Unbounded reading viewport** — the BookReader root had
  no height, so inside a sized frame the content pane grew to full book height
  (5385 px), never virtualized, and couldn't scroll internally (the frame just
  clipped at 480 px). Fixed by giving the reader root `height: 100%` so it fills
  the consumer's sized container → content pane becomes a bounded, virtualized
  scroller. Also made the demo `.reader-frame` `clamp(320px,60vh,760px)` so window
  resize genuinely grows the viewport (the resize→fetch-more path). 137 unit tests
  + 6 e2e green; build + lint + typecheck clean.
- 2026-06-27 — **M8 (partial): committed M6+M7; reworked the demo into examples;
  scoped out publishing.** Committed the previously-uncommitted M6 (scroll⟷tree
  sync) + M7 (styling) work (`623497a`). Per the user: **publishing/packaging is
  dropped from M8** (they'll `npm publish` manually later) — replaced that goal
  with *rich runnable examples* and a planned *end-to-end scroll-to-end test*.
  Reviewed core coverage (traversal/cache/treeStore/virtualizer/scrollSync — all
  thorough, no holes) and re-confirmed bundle/tree-shake (31.9 kB JS / 9.09 kB
  gzip; no `.css` in the JS bundle). **Rewrote the demo** (`demo/main.tsx`) from a
  skin-switcher into a **single app with a 4-example switcher** — Quickstart (sync
  tree), Lazy tree (`loadChildren`), Loading/error/empty states, and Styling tiers
  + controlled `location` — over **faker-generated book data** (`demo/data.ts`,
  `@faker-js/faker` devDep): deterministic (seeded), with section *titles* up front
  but *bodies* synthesized lazily on `fetchContent`, so a 1,000-section book stays
  cheap and re-reads are stable. Typecheck clean; demo not yet browser-verified.
  **Deferred to a fresh session (user's call): the e2e Playwright test** that
  scrolls the content pane to the end and asserts the next section renders — full
  brief written to `NEXT_SESSION.md`. Remaining M8: README + a11y pass.
- 2026-06-27 — **M7 done: styling system.** Shipped the importable default skin
  `src/styles/book-reader.css` — purely *presentation* (font/colors/typography/
  spacing) scoped under `[data-part="book-reader"]` so it can't leak into a host
  app, layered on top of the structural layout the components keep inline
  (flex/overflow/height/position). Key decision: **functional layout stays inline,
  presentation lives in the opt-in CSS** — so the reader still works if the
  stylesheet is never imported, and inline styles never fight the sheet (they
  agree on the few overlapping props; tokens are only set in CSS). Tier 1: a full
  `--reader-*` token set (font, `--reader-content-font`, colors incl. accent/
  accent-soft/hover/error, surfaces, spacing, `--reader-tree-indent` (already
  consumed inline by TreePane), radius, focus-ring) declared on the root data-part;
  every rule reads tokens, so retheming is token-only. Tier 2: audited the
  `data-part` hooks (all present — book-reader/tree-pane/tree/tree-node(+caret/
  label/spinner)/content-pane/content/content-node/content-html/loading/empty/
  error/retry/spacers) and the per-slot `classNames` — **wired `classNames.root`**
  (was defined but never applied; root now joins `br-reader`+`className`+`root`)
  and **added `classNames.treeNode`** (new `treeNodeClassName` threaded through
  `TreePaneView`+`TreePane` onto every `data-part="tree-node"` row). Tier 3:
  render-props already existed (M3/M6) — demo exercises them. **Build wiring:**
  a tiny Vite plugin `emitDefaultStylesheet()` copies the plain CSS to
  `dist/book-reader.css` via `this.emitFile` in `generateBundle` (no transform
  needed); the CSS is deliberately **not** imported by `src/index.ts`, so the JS
  bundle has zero `.css` references → `import 'book-reader/styles.css'` is opt-in
  and tree-shake-safe (`package.json` exports + `sideEffects:["**/*.css"]` were
  already in place from M0). Demo rewritten with a 3-way skin switcher (default /
  themed sepia via token overrides only / fully-custom dark terminal skin via
  `classNames`+`data-part`+all five render-props), `key={skin}` for a clean remount,
  M6 location readout kept; `demo/demo.css` holds the themed + custom skins. TDD
  bent for CSS (visual) per CONVENTIONS — added `BookReader.styling.test.tsx`
  (3 RTL tests: every `data-part` hook renders, all five `classNames` thread to the
  right elements with base classes preserved, row indent consumes the
  `--reader-tree-indent` token). build+typecheck+lint clean, **137 tests green**
  (was 134, +3). No-flicker/stable-scroll (M5) and cross-pane sync (M6) untouched.
  Next: M8 hardening/docs/release.
- 2026-06-26 — **M6 done: scroll ⟷ tree sync & auto-advance.** Pure core **TDD-first**
  (red→green→refactor): `core/scrollSync.ts` — `activeNodeAt(spans, refLine)` (the
  node whose span holds the scroll reference line; clamps both ends), `isNearBottom`
  (bottom-approach cue; true when the whole book fits), `nextNodeToLoad(store, seq,
  fromId)` (first expandable-but-unloaded node at/after `fromId` — the next lazy
  subtree to fetch), and `withReadingOverrides(store, base, {getNextNode,getPrevNode})`
  which layers the consumer overrides over the base DFS order (node→id translation,
  visited-guarded `getSequence` so a cyclic override can't spin). 15 tests. Added
  `virtualizer.offsetAt(ids, index)` (absolute start of a possibly-off-screen node;
  +1 test). Then the React layer (TDD bent for scroll geometry): **`useVirtualList`
  now tracks live scroll** (a `scroll` listener was missing in M5, so the window
  never recomputed on scroll — fixed; metrics setter bails when unchanged) and
  exposes `activeId`/`activeOffset` (from `activeNodeAt` over the mounted window),
  `atBottom` (`isNearBottom`), and `scrollToId(id, offset)` (`offsetAt` → set
  scrollTop). `ContentPane` builds an override-aware sequence (`fullSeq` for loading,
  `ids` = content-bearing for layout), reports active changes, asks `onNeedNode`
  for the next lazy subtree when near bottom (or when the active node is itself
  unloaded), and honours a tokened `scrollRequest`. **`BookReader` is now the
  coordinator**: lifted one shared `useTreeState` (split `TreePane`→`TreePaneView`
  to inject it; standalone `TreePane` API unchanged), highlights the active node,
  auto-expands its path deepest-first **only when the active node changes** (via a
  ref so a manual collapse isn't fought), threads `version` into `ContentPane` (an
  M5 gap — lazy loads now regrow the reading sequence), and implements
  controlled/uncontrolled `location` + `onLocationChange` with an echo-guard so a
  controlled `location` that's just our own scroll echo doesn't bounce the view.
  Added `useTreeState.load(id)` (load lazy children without expanding the row).
  New public types/props: `ReadingOrderContext`, `GetNextNode`/`GetPrevNode`,
  `BookLocation`, and `getNextNode`/`getPrevNode`/`location`/`defaultLocation`/
  `onLocationChange` on `BookReaderProps`; exported scrollSync + new types from
  `index.ts`. 3 RTL scroll-sync integration tests (stub RO/clientHeight/GBCR, drive
  real `scroll` events) prove active-highlight+auto-expand+onLocationChange,
  tree-click→scroll, and bottom→lazy-load. Demo wires `onLocationChange` to a live
  reading-position readout. build+typecheck+lint clean, **134 tests green** (was
  115; +19). No-flicker/stable-scroll guarantee preserved (scroll-to lands a node
  at the viewport top so anchor correction has nothing above to fix; appended lazy
  nodes are always below the fold). Next: M7 styling system.
- 2026-06-26 — **M5 done: virtualization + stable scroll.** Built the pure core
  **TDD-first** (red→green→refactor): `core/virtualizer.ts` `createVirtualizer` —
  a **height map** (`setHeight` remembers measured px and returns the delta from
  the previously-used height; `getHeight` falls back to a configurable estimate,
  default 200) + **windowing** (`getWindow` resolves every node's absolute start
  from the height map, finds the viewport-intersecting slice, applies overscan,
  and returns mounted items + top/bottom spacer paddings + totalHeight) +
  **anchor correction** (`correctScrollTop(itemStart, delta, scrollTop)` — pure:
  only a node *above* the viewport top shifts the view, so add `delta` back) +
  pin/prefetch helpers (`pinnedIds` = window + prefetchCount ahead; `prefetchIds` =
  just the ahead slice). 21 unit tests, incl. the `viewportHeight ≤ 0 → mount all`
  boundary (un-measured viewport) and measured-height offsets. Then the React layer
  (TDD bent for scroll geometry per CONVENTIONS): `content/useVirtualList.ts` owns
  the scroll-container ref + live scrollTop/clientHeight, one `ResizeObserver`
  measuring every mounted node (eager lazy-init so it exists when item refs fire in
  commit; per-id **stable** ref callbacks cached in a Map to avoid observe/unobserve
  churn), applies anchor correction synchronously in the RO callback, and drives
  `cache.setPinned(pinnedIds(...))` + warms `prefetchIds(...)`. `ContentPane`
  rewritten to be the scroll surface (top/bottom spacer divs + the windowed
  `ContentNode`s; `ContentNode` gained a `measureRef` → its `<article>`);
  `prefetchNodeContent` mirrors `useNodeContent`'s fetch+sanitize+cache pipeline
  (no React state) for warming ahead. Factored `resolveSanitizer` into `sanitize.ts`
  as the shared source of truth. New props threaded through `BookReader`/types:
  `overscan` (default 2), `prefetchCount` (default 2), `estimateHeight`; the content
  wrapper became a sizing box (ContentPane owns scroll). 3 RTL integration tests stub
  `ResizeObserver`/`clientHeight`/`getBoundingClientRect` to prove: only the window
  mounts (not all 21 nodes), the cache pins the window+prefetch, and ahead nodes warm
  without mounting. Exported `createVirtualizer`/helpers/types from `index.ts`. Demo
  adds a 5,000-section sync book. build+typecheck+lint clean, **115 tests green**
  (was 91). Next: M6 scroll⟷tree sync + auto-advance + `location`.
- 2026-06-26 — **M4 done: caching layer.** Built `core/cache.ts`
  (`createContentCache`) **TDD-first** (red→green→refactor): 20 cache tests stating
  store/recency, LRU eviction by `maxChars`, eviction by `maxNodes`, pinning (never
  evict pinned even when budget can't be met; re-run eviction on unpin), custom
  `sizeOf`/`evict` (pinned ids never offered to the policy), and in-flight dedup
  (same promise for concurrent loads, cache-on-resolve, no-cache-on-reject). One
  design decision surfaced via two red tests: **eviction only fires when over a
  budget** (not on every `set`) — otherwise a "evict everything you see" custom
  policy fires before a node can be pinned; fixed + the two tests adjusted to pin
  before exceeding budget. Recency is `Map` insertion order (oldest=head); `get`/
  `set` re-insert at the tail. Then wired through the React layer: `useNodeContent`
  reads through an optional `cache` — (1) synchronous cache hit settles flash-free
  with no re-fetch (skipped on `retry`), (2) reuse `getInFlight` so a second consumer
  never double-fetches, (3) fresh fetch: sync settles + `cache.set`, async routes the
  sanitized promise through `cache.dedupe`. Threaded `cache` prop down ContentNode →
  ContentPane; `BookReader` creates one cache per instance via `useRef` (config
  captured at mount so a fresh `cache={{…}}` literal can't wipe it) fed by the new
  `BookReaderProps.cache` (`CacheConfig<string>`). Cache stores *sanitized* HTML.
  Added 2 RTL cache tests (synchronous re-entry; concurrent dedup). Exported
  `createContentCache`/`ContentCache` from `index.ts`. build+typecheck+lint clean,
  91 tests green (was 69). Next: M5 virtualization + the pinned-window driver +
  prefetch.
- 2026-06-26 — **M3 done: content pane + top-level BookReader.** TDD on the pure
  parts first: extended `ReadingOrder` with `getSequence()` (5 tests) and built
  `content/sanitize.ts`, an allowlist HTML sanitizer (11 tests: drops script/style/
  iframe + on* handlers + `javascript:`/`data:` URLs + `style` attr; unwraps unknown
  tags keeping text; keeps safe formatting/links/img/class). Then the React layer
  (RTL, TDD-bent for async): `useNodeContent` (sync settles with no loading flash,
  async loading→loaded/empty/error, fresh `AbortController` per fetch so a stale
  slow fetch can't clobber a newer node, `retry`), `ContentNode` (state→render-prop
  with shipped defaults + `data-status`/`data-part` hooks; `sanitize` toggle/custom
  fn), `ContentPane` (book-order render via `getSequence()`, skips `hasContent:false`),
  and `BookReader` composing both panes over one shared store (`treeSide`/`treeWidth`).
  Public API surface added to `types.ts` (`FetchContent`, `SanitizeOption`, content
  render-prop types, `ContentState`, `BookReaderProps`/`BookReaderClassNames`) and
  re-exported from `index.ts`. Demo now shows the full `BookReader`. build+lint+
  typecheck clean, 69 tests green (was 37). Deferred (documented): cross-pane scroll
  sync, `location`, and `getNextNode`/`getPrevNode` overrides → M6; caching/dedup → M4.
  Next: M4 caching layer.
- 2026-06-26 — **M2 done: TreePane UI.** Pure `tree/flatten.ts` (visible-row
  flattening) built TDD-first (5 tests), then the React layer: `useTreeState`
  (expand/collapse, controlled+uncontrolled selection, async `loadChildren` with
  per-id in-flight dedup + `version` bump so lazy children re-render),
  `defaultTreeNode`, and `TreePane` (ARIA `tree`/`treeitem`, aria-level/expanded/
  selected, roving tabindex, ↑↓→←/Home/End/Enter/Space). 10 RTL tests (jsdom +
  user-event). Added public types: `LoadChildren(+Context)`, `TreeNodeState`,
  `RenderTreeNode`. Caught two `exactOptionalPropertyTypes` errors (forwarding
  possibly-undefined props) — fixed by widening optional props to `| undefined`.
  Demo now renders a sync + a lazy book. build+lint+typecheck clean, 37 tests
  green. Next: M3 content pane. (BookReader top-level composition deferred to M3.)
- 2026-06-26 — **M2 traversal done (`core/traversal.ts`) via TDD.** red→green→
  refactor: wrote 13 failing tests stating depth-first reading order, then
  `createReadingOrder(store)` over the tree store — `getNext/getPrev` (pre-order
  descend → next-sibling → climb ancestors; prev = prev-sibling's deepest last
  descendant else parent) + `getFirst/getLast`. Lazy-aware: an unloaded
  expandable node reads as a leaf until `setChildren` arrives. A `tsc`
  `noUncheckedIndexedAccess` error in the test (string|undefined index) caught
  before green-claim. build+typecheck+lint clean, 22 tests green. Next: M2
  TreePane UI. (Reading-order overrides + fetch wiring deferred to M3.)
- 2026-06-26 — **M0 done, M1 core types done, M2 treeStore done.** Scaffolded
  Vite lib + TS strict + pnpm; ESM/CJS/dts build green; eslint no-explicit-any
  active; vitest wired. Wrote `src/types.ts` (generic `BookNode<Meta>`, cache
  types). Built `core/treeStore.ts` **via TDD** (red→green→refactor; a test
  caught the leaf-vs-unloaded semantic). 9 tests green, lint+typecheck clean.
  Next: `core/traversal.ts` (depth-first reading order) via TDD.
- 2026-06-26 — Spec frozen (`REQUIREMENTS.md`), milestones drafted, `CLAUDE.md`
  created. No implementation code yet. Next: M0 scaffold (awaiting package name).

---


## ✅ TESTS WRITTEN — backlog cleared 2026-06-28
> The deferred test backlog has been **written and is green** (155 unit + 16 e2e).
> Coverage philosophy honoured: a *small set* of essential integration + real-browser
> e2e flows that prove each feature works **for the user**, driven through the public
> `<BookReader>` / the demo — not exhaustive per-file units, minimal mocking (only the
> jsdom-missing `ResizeObserver` + `scrollIntoView` stubs in `vitest.setup.ts`).

Where each owed item landed:
- **Generic object content payload** → `tests/BookReader.objectContent.test.tsx`
  (identity/`status`, never sanitized/HTML-injected, object-no-`renderContent` renders
  nothing, nullish ⇒ empty, string path still sanitizes) + e2e `object content payload`.
- **Responsive tree-collapse** (`auto`) + **named modes** → e2e `responsive tree-collapse`
  (real resize → collapse → open popover → select navigates+closes → widen restores) and
  `collapse modes` unit (`always`/`never` forced states).
- **`treeOverlayMinWidth/Height`** → `tests/BookReader.collapse.test.tsx` (min-size applied
  to the default popover).
- **renderExpandCollapse** → `tests/tree/expandCollapse.test.tsx` (default caret keeps
  `data-part`/`data-expandable`/row `aria-expanded`; custom control replaces the caret and
  its api drives state) + e2e `render hooks`.
- **renderContentNode** → `tests/content/renderContentNode.test.tsx` (consumer element +
  spread hooks, composes with `renderContent`, default `<article>` fallback) + e2e
  `render hooks` (custom `<section>` wrapper; no-flicker e2e unaffected).
- **Inter-node spacing split** → e2e `inter-node spacing tokens` (computed block/inline
  padding; overriding only the block token moves vertical spacing, not horizontal).
- **Tree-indent into the skin** → `tests/BookReader.styling.test.tsx` (`data-depth` +
  `--br-tree-depth`; no inline `padding-inline-start`).
- **Auto-open active branch** → `tests/BookReader.autoExpand.test.tsx` (selecting a branch
  opens its own children; sibling stays closed; no auto-dump at the top of the book).
- ~~**Headless / controlled tree-collapse**~~ → **removed 2026-06-28** (`treeOpen`/
  `onTreeOpenChange` and their tests + the e2e `headless tree` spec deleted).
- **ResizeObserver / scrollIntoView infra** → global stubs in `vitest.setup.ts`.

**Remaining: nothing.** ~~The accessibility pass~~ was **DROPPED 2026-07-02 at user
request** (no a11y plan — do not add a11y/keyboard/focus tests). Open coverage gaps
live in the ⏸ PENDING TESTS backlog at the bottom of this file.

---

## ✅ LANDED — text selection / staging e2e (2026-07-01) — was PENDING (2026-06-28)
> Landed in **`e2e/selection.spec.ts`** (6 real-browser tests): stage via right-click →
> persistent `<mark>` + staged chip; **survives virtualization** (staged section scrolled
> out until it unmounts, then back → highlight re-painted from the stored char range);
> right-click a staged highlight → **Unstage** only (removes it live); **Deselect** on a
> fresh selection stages nothing; the outside **“Show all staged content”** button dumps
> each selection's text + `nodeId`/`meta.category` (proves the decoupled channel crossed
> the `<BookReader>` boundary); a `🔒 user-select:none` locked section yields no menu.
> Selections are created programmatically (DOM Range + dispatched `contextmenu`) for
> determinism; everything downstream is the unmocked demo. Pure helpers already covered
> by `tests/demo/highlight.test.ts` + `tests/content/renderContentNode.test.tsx`.

---

## ✅ LANDED — M10 lazy tree + tree search tests (2026-07-01) — was PENDING (2026-06-30)
> Split across a fast RTL/jsdom layer (store + orchestration + search wiring, since
> jsdom has no layout and mounts every node) and real-browser e2e (the trigger paths).
> Where each owed item landed:
> - **Store unit** → `tests/core/treeStore.lazy.test.ts`: `setChildren`/`setLazyStatus`/
>   `replaceTree` bump version + notify (+ unsubscribe); `isExpandable`/`getLazyStatus`
>   for unresolved/pre-resolved/non-lazy nodes; unknown-id no-ops.
> - **`useLazyChildren`** → `tests/useLazyChildren.test.tsx`: dedup concurrent triggers,
>   loading→loaded + insert, missing-`fetchChildren` error, rejection→error→retry, and
>   **abort-on-unmount resets to `'unloaded'`** (see the StrictMode fix below).
> - **Lazy status rows** → `tests/tree/flatten.lazy.test.ts` (loading/error rows, walk
>   once resolved, none while collapsed).
> - **Expand-trigger + error/retry + no-fetcher** → `tests/BookReader.lazy.test.tsx`
>   (loading row → children, single fetch, Retry succeeds, no-`fetchChildren` error) and
>   e2e `e2e/lazy-search.spec.ts` "expand trigger" (fetch + render, re-expand is cached).
> - **Scroll-trigger** → e2e `e2e/lazy-search.spec.ts` "scroll trigger": scrolling
>   resolves lazy branches down to real leaf sections that load (the case the StrictMode
>   bug broke — now guarded here).
> - **Search replace + first-page descent + reset + custom box + coalescing** →
>   `tests/BookReader.search.test.tsx` (RTL) + e2e `e2e/lazy-search.spec.ts` (real
>   collapsed-overlay flow; asserts descent via the reading-position readout).
> - **Note on the demo layout:** the Lazy & search example renders the tree **collapsed**
>   (narrow frame beside the inspector), so the e2e drives tree/search via the floated
>   overlay — representative of the real collapsed UX.
>
> **🐞 The e2e caught a real bug (fixed):** lazy scroll-trigger was dead under
> StrictMode — an aborted double-mount fetch left the node stuck `'loading'`; fix resets
> aborted fetches to `'unloaded'` so the trigger re-fires (`src/useLazyChildren.ts`).

---

## ✅ LANDED — deep-link into unfetched lazy branches (`fetchPath` / `BookLocation.path`) — coded + tested 2026-07-01
> **Feature:** a `location`/`defaultLocation` can target a node that isn't in the tree yet
> because it sits inside an unfetched `lazy` branch. `core/traversal.ts › resolveToNode`
> walks the ancestry (`BookLocation.path`, else the `fetchPath` prop), resolving each lazy
> ancestor via `ensureAsync` in order until the target exists, then scrolls. Wired in
> `BookReader` as an abortable `requestScrollResolved` (fast-path for already-known nodes;
> per-nav `AbortController`). Fixes the gap where such a location was a **silent no-op**.
> **Stable** in the README.
>
> Where the coverage landed (essential-flow, not exhaustive — the pure logic in unit, the
> real on-screen flow in e2e, since jsdom mounts every node and resolves lazy branches
> incidentally via the viewport trigger):
> - **unit `tests/core/resolveToNode.test.ts` (9 tests)** — already-known ⇒ true (no fetch);
>   chained lazy ancestors resolved **in order**; `fetchPath` fallback when no `path`;
>   no-ancestry ⇒ `false` no-op; `fetchPath`→undefined ⇒ false; unknown ancestor ⇒ false;
>   ancestor fetch rejection ⇒ false; pre-aborted signal short-circuits (no fetch); abort
>   **mid-walk** stops before the next ancestor (the superseding-nav contract).
> - **e2e `e2e/lazy-search.spec.ts` "deep-link into an unfetched lazy branch"** — the demo's
>   Lazy & search example gained a "Deep-link to a buried section" button (`fetchPath` +
>   a `defaultLocation` remount to `lz/3/2/1`, three lazy parts deep). Asserts the buried
>   leaf is absent, then after the click resolves its ancestry and mounts/actives it — the
>   bug's exact case, in a real browser where virtualization keeps off-screen branches
>   unfetched. **195 unit + 24 e2e green.**

---

## ✅ LANDED — cross-branch reading-order navigation (tree click → scroll to the effective neighbour) — tested 2026-07-02
> **What it proves:** clicking any node navigates correctly, and the reading surface's
> effective previous/next node is the adjacent **content** section in depth-first order —
> even across Part/Chapter boundaries (organisational `hasContent:false` nodes are skipped).
> So "click §2.1.1, scroll up ⇒ §1.8.16 (previous Part's last section)" and "click §2.8.16,
> scroll down ⇒ §3.1.1 (next Part's first section)". No library change — this is behaviour
> already provided by DFS traversal (`core/traversal.ts`) + ContentPane's content filter +
> virtualization; these tests were the missing coverage.
> - **unit `tests/core/traversal.test.ts` › "cross-branch content navigation" (5 tests)** —
>   a deep 3×3×4 book (Parts/Chapters organisational, Sections are content leaves); asserts
>   the content sequence is the sections in DFS order, and that previous/next cross Part
>   **and** Chapter boundaries correctly, with start/end-of-book yielding `undefined`. This
>   mirrors ContentPane's `ids` (DFS filtered to content nodes).
> - **e2e `e2e/reader.spec.ts` › "tree click navigates the reading surface" (2 tests)** —
>   the Styling example's deep `makeLargeBook` (8×8×16). Expands Part 2 → a Chapter via
>   carets (rows located by deterministic title prefix, not faker headings), clicks a deep
>   Section, asserts it lands at the top, then scrolls up/down and asserts the neighbouring
>   Part's boundary section (`l.p0.c7.s15` / `l.p2.c0.s0`) mounts on the correct side.
>   Ordering + mount checked in a **single atomic poll** (tolerates async body-load relayout);
>   navigation-settle polls use the repo's 10 s timeout (stable under parallel workers).
> - **⚠️ Regression caught mid-work:** an earlier attempt added `data-node-id` to tree rows
>   for test targeting — this collided with the bare `[data-node-id]` selector in
>   `selection.spec` (which assumed only *content* nodes carry it), breaking its unmount
>   assertion. Reverted; rows are targeted via `role=treeitem` + title prefix instead. No
>   public DOM change. **200 unit + 26 e2e green.**

---

## ✅ LANDED — backlog test session + upward-cascade anchor fix (2026-07-04)
> The user-authorized test session (see NEXT_SESSION 2026-07-04): worked the entire
> ⏸ PENDING TESTS backlog (P1 first) and coded+tested M11, batching all code first,
> then all tests, then one verification pass. **205 unit + 48 e2e green** (was
> 200 + 42). Item-by-item placement is recorded in the backlog section at the
> bottom (kept as a landed record).
>
> **🐞 The P1 LZ-UP e2e caught a real design bug, exactly as the backlog caveat
> predicted** — the "no flicker" anchor policy was wrong for upward scrolls.
> Anchor correction pinned the **fold line** (node straddling the viewport top);
> during an upward lazy cascade the fold sits *inside the materialising region*,
> so every placeholder→children swap re-anchored on churn: the view ratcheted up
> the resolving branch (readout drifting `az/0/1/2/2` → `az/0/2/0/0`…), the
> section the reader came from was pushed ~800 px below the viewport, and the
> cascade then **stalled** with the remaining placeholders outside the window.
> Diagnosed with temporary in-page correction logging (per-swap/per-RO-delta
> event log + 20 s position snapshots).
> **Fix (`content/useVirtualList.ts`), three parts:**
> 1. **Track the last *user* scroll direction** (`scrollDirRef`; programmatic
>    corrections excluded via `expectedTopRef`).
> 2. **Direction-aware anchor policy** in BOTH correction paths (the new
>    sequence-swap layout effect and the ResizeObserver callback): scrolling
>    **down**, keep the legacy fold rule (children unfold in place below the
>    line being read). Scrolling **up**, anchor on the first **settled** node
>    at/below the fold — settledness read off the mounted elements'
>    `data-status` (`loaded`/`empty`; placeholders and fetching sections report
>    `loading`) — and correct **in full** for everything materialising above it,
>    including nodes straddling or below the fold line but above the anchor.
> 3. **Sequence-swap anchor correction** (new layout effect): id-sequence changes
>    (placeholder→children swaps) never fire a ResizeObserver, so swaps above the
>    fold used to shift the view. The effect reconciles the height map with DOM
>    truth (Step A — freshly-mounted items are already at real height; deltas
>    above the anchor accumulate a sync correction so the adjustment is never
>    silently absorbed), then pins the anchor across the swap in the reconciled
>    coordinates (Step B). Skips when a navigation anchor is active (nav re-pins
>    its own target).
> With the fix, the LZ-UP cascade converges: `az/0/2/2/2` materialises directly
> above `az/1/0`, the view holds for 20 s+ with no runaway, and the whole demo
> book stays scrollable backwards through arbitrary-depth lazy resolution.
> **Also fixed:** full-suite e2e flakes were CPU contention (2 workers + Vite on
> 4 cores starved rAF: tab clicks never "stable", cascades stalled) —
> `playwright.config.ts` now sets `workers: 1`.

---

## ✅ LANDED — M11 tree/book-level empty state (decided with the user 2026-07-04; coded + tested 2026-07-04)
**Goal:** a defined "no data / no results" experience at the **book/tree level** —
the level that had none. (Per-**section** empty already exists: `renderEmpty`
+ the "No content." default in `ContentNode`. Do not confuse the two.)
- [x] **Default template:** when the (possibly search-replaced) tree has no showable
      content nodes, `ContentPane` renders a centred "Nothing to show here." panel —
      `data-part="content-nodata"`, styled by the skin via the
      `--reader-content-nodata-padding` token; presentation overridable like
      everything else.
- [x] **Consumer override:** `renderNoData?: RenderNoData` render prop on
      `BookReaderProps` (parallel to `renderLoading`/`renderError`/`renderEmpty`),
      exported type in `src/index.ts`.
- [x] Empty-book case (`tree` with no content nodes) renders the same state.
- [x] README documented; **Stable** (its tests landed the same session: [E5] e2e in
      `lazy-search.spec.ts`, [U2] RTL in `BookReader.search.test.tsx`, [E6] e2e in
      `edge.spec.ts`).

---

## ⏸ PENDING TESTS — durable backlog (canonical; keep at the very bottom)

> **This section is the single source of truth for owed/missing tests** (per the
> HARD RULE in `CLAUDE.md`/`CONVENTIONS.md`; `TEST_PLAN.md` §7 defers here).
> **✅ CLEARED 2026-07-04** — the user-authorized test session worked the whole
> backlog. Every item below landed (kept for the record of *where*); the backlog
> is currently **empty**. New untested behaviour must be logged here immediately,
> framed as essential e2e flows, per the HARD RULE.

### ✅ Landed 2026-07-04 (was 🔴 P1 — lazy effective-neighbour navigation)

**The core promise:** from any reading position, scrolling up/down must land on the
**logical previous/next content node by tree traversal**, resolving lazy branches
**recursively** when the neighbour lives inside one (`prev of 5.1.1 = 4.9.9.9.9`).
The backlog's caveat — "if LZ-UP goes red, suspect a **real remaining bug**" —
**proved right**: LZ-UP exposed that the anchor-correction *policy* was wrong for
upward scrolls (see the session entry above for the three-part
`useVirtualList.ts` fix).

1. **[LZ-UP]** → `e2e/lazy-neighbor.spec.ts`: deep-link to `az/1/0`, scroll up;
   one atomic poll asserts the 5-level Part above recursively resolves so its
   deepest-LAST leaf `az/0/2/2/2` mounts **directly above** (adjacency < 4 px,
   `data-status=loaded`), the reading line staying in-viewport, plus a 10-step
   scroll-up stability loop over the resolved region.
2. **[LZ-DOWN]** → same spec: from `az/1/2`, scroll down; the 4-level next Part
   resolves its leftmost chain and `az/2/0/0` lands **directly below** (identity +
   adjacency + loaded).
3. **[LZ-FIXTURE]** → `demo/data.ts › makeAsymmetricBook()/makeAsymmetricFetchChildren()`:
   deterministic asymmetric-depth lazy book (Parts of depth 5 / 3 / 4) behind the
   "11 · Lazy depths" demo tab with `az-up`/`az-down` deep-link buttons.
4. **[LZ-ORDER]** — skipped deliberately: the e2e identity assertions prove the
   recomputed order end-to-end; a jsdom integration test would add no signal
   (jsdom mounts everything, so the placeholder→leaf switch is incidental there).

### ✅ Landed 2026-07-04 (was 🟡 P2)

5. **[E5]** → `e2e/lazy-search.spec.ts` "tree search — zero results": a `zz…` query
   swaps in the zero-result book, the M11 `content-nodata` default shows, reset
   restores the original book. (Custom-override + re-search/reset-mid-load edges
   covered at the RTL layer in [U2] — cheaper and just as conclusive.)
6. **[E6]** → `e2e/edge.spec.ts`: empty book renders the no-data state (default
   text + zero content nodes + no page errors) and `renderNoData` override renders
   instead; single-section book mounts its one loaded section, no spurious scroll.
   Fixtures: `makeEmptyBook()`/`makeSingleBook()` in `demo/data.ts` ("12 · Edge
   cases" tab).
7. **[E8]** → `e2e/edge.spec.ts`: custom `getNextNode`/`getPrevNode` (even-chapters
   chain over `makeOrderBook()`) drive the **real** scroll sequence — odd chapters
   never mount while scrolling the full book, in either direction.
8. **[U2]** → `tests/BookReader.search.test.tsx` (+4): no-match search renders the
   M11 default (and no content nodes); `renderNoData` override wins; re-search
   replaces cleanly (call-counted); reset-mid-load discards the late result.
9. **[U3]** → `tests/BookReader.scrollsync.test.tsx` (+1): an echoed controlled
   `location` does not oscillate the scroll position; a genuinely new location
   still navigates.

### ✅ Landed 2026-07-04 (was 🟢 P3)

10. **[FLAKE]** → `e2e/reader.spec.ts` "crosses into the previous Part's last
    section": now settles (all mounted nodes loaded, 15 s poll) before the upward
    scroll, final poll 15 s. Additionally `playwright.config.ts` now runs
    **1 worker** — two Chromiums + Vite on a small machine starved rAF in the
    sibling page (tab clicks never saw a "stable" element; cascades stalled).
11. **[FUZZ-ORACLE]** → `e2e/fuzz.spec.ts`: (a) fold section moves ≤ the scroll
    delta on every random scroll step; (b) the reported reading position (readout
    id or a descendant) is visible in the viewport after settling; (c) post-walk
    scroll-away/scroll-back probe is a synchronous `loaded` cache hit (skipped on
    tiny-cache, where eviction is expected).

### Deliberately NOT owed (do not add)
- **Accessibility/keyboard/focus tests** — dropped 2026-07-02 at user request.
- **`BookLocation.path`-supplied deep-link e2e** — the pure walk is unit-covered
  (`resolveToNode.test.ts`) and the `fetchPath` e2e covers the essential user flow.
- **More cache/virtualizer/traversal/scrollSync unit depth** — already thorough;
  against the essential-flows coverage philosophy.
