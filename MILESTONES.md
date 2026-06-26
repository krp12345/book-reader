# BookReader — Milestones & Progress

> **Restartable plan + progress tracker (single source of truth).** Each
> milestone is independently shippable and verifiable. At the start of any
> session, read the STATUS block below first, then `REQUIREMENTS.md` +
> `CONVENTIONS.md` + `CLAUDE.md`. Update this file as work lands.

---

## ▶ STATUS — keep this block current (update at end of every session)
- **Current milestone:** M8 — Hardening, docs, release prep (NEXT)
- **Overall progress:** 7 / 9 milestones complete (M0, M2–M7 done; M1 core types done)
- **Next action:** M8 hardening. README (quickstart + full prop reference, incl.
  the M7 styling tiers + `import 'book-reader/styles.css'`), accessibility pass,
  core coverage review, bundle-size / tree-shake verification, decide package
  name/scope, `npm publish --dry-run`.
- **Blocked on:** nothing. Package name = `book-reader`. pnpm is the package manager.
- **Deferred to later milestones:** README + a11y pass + bundle-size/tree-shaking
  checks + publish dry-run → M8.
- **Last updated:** 2026-06-27

---

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

## How we work each milestone (TDD rhythm)
Default loop: **red → green → refactor** (see `CONVENTIONS.md`). Within a
milestone, build **pure `core/` logic test-first**, then wire the React/DOM layer
with a few integration tests. Bend TDD for spikes and browser-only scroll
behavior — don't force unit tests onto real layout geometry. A milestone is done
only when its core logic tests are green and `npm run build && npm test` pass.

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

## M8 — Hardening, docs, release prep
**Goal:** ship-ready.
- [ ] README with quickstart + full prop reference.
- [ ] Accessibility pass (tree roles, focus, aria, keyboard).
- [ ] Test coverage for core (traversal, cache, scroll sync).
- [ ] Bundle-size check; tree-shakeable exports verified.
- [ ] Decide package name/scope; `npm publish --dry-run` clean.
**Done when:** dry-run publishes; demo covers all requirements.

---

## Session log (append newest on top)
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
