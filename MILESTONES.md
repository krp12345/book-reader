# BookReader — Milestones & Progress

> **Restartable plan + progress tracker (single source of truth).** Each
> milestone is independently shippable and verifiable. At the start of any
> session, read the STATUS block below first, then `REQUIREMENTS.md` +
> `CONVENTIONS.md` + `CLAUDE.md`. Update this file as work lands.

---

## ▶ STATUS — keep this block current (update at end of every session)
- **Current milestone:** M5 — Virtualization + stable scroll (NEXT)
- **Overall progress:** 4 / 9 milestones complete (M0, M2, M3, M4 done; M1 core types done)
- **Next action:** M5 `core/virtualizer.ts` — windowing (mount viewport+overscan),
  height map (measure/remember/estimate), anchor correction on height delta. Drive
  `cache.setPinned()` from the viewport+overscan+prefetch window so scroll-back is a
  synchronous hit; add `prefetchCount` (use `cache.dedupe` to warm next 1–2 nodes).
- **Blocked on:** nothing. Package name = `book-reader`. pnpm is the package manager.
- **Deferred to later milestones:** the pinned-window *driver* (M4 cache exposes
  `setPinned`; the actual viewport+overscan+prefetch range is computed in M5);
  prefetch-ahead → M5; cross-pane scroll⟷tree sync, controlled `location`, and
  reading-order overrides (`getNextNode`/`getPrevNode`) → M6.
- **Last updated:** 2026-06-26

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

## M5 — Virtualization + stable scroll
**Goal:** huge books perform; zero flicker.
- [ ] Windowing: mount only viewport + overscan.
- [ ] Height map: measure, remember, estimate unknowns.
- [ ] Anchor correction on height delta (no scroll jump).
- [ ] Scroll-back over read content is a synchronous cache hit (no flash).
- [ ] Prefetch-ahead (configurable `prefetchCount`).
**Done when:** scrolling a 10k-node simulated book is smooth and never jumps/flickers.

## M6 — Scroll ⟷ tree sync & auto-advance
**Goal:** the two panes move together.
- [ ] Scroll position → active node detection → tree highlight + ancestor auto-expand.
- [ ] Scroll-to-bottom auto-fetches & appends next node.
- [ ] Tree click → scroll content to node.
- [ ] `location` controlled/uncontrolled + `onLocationChange`.
**Done when:** reading scrolls the tree; clicking the tree scrolls the reading.

## M7 — Styling system
**Goal:** great defaults, progressive override.
- [ ] Default stylesheet (importable CSS).
- [ ] `--reader-*` custom properties for theming.
- [ ] Stable `data-part` hooks + per-slot `className`s.
- [ ] Demo showcases default, themed, and fully-custom skins.
**Done when:** all three styling tiers demonstrated in the demo.

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
