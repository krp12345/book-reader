# CLAUDE.md — BookReader library

> This file is auto-loaded into context at the start of **every** Claude Code
> session in this repo. Keep it short, current, and high-signal. It is the
> primary tool for avoiding full-project re-exploration (and the token cost of it).

## What this is
A React 18 **library** exposing `<BookReader>`: a two-pane book reader (section
tree on the left, continuous virtualized reading surface on the right). Scales
from tiny inline books to huge ones — the section **tree** is provided up front,
and section **content** loads lazily (fetch + cache + virtualize). Tree
**structure** can also load lazily: a `BookNode.lazy` branch resolves its
children on demand via `fetchChildren` (removed 2026-06-28, **re-added in M10**
2026-07-01, commit fd85830). Two resolve triggers: tree expand and reading-surface
scroll (the top-of-window lazy placeholder self-resolves, cascading to the first
content node); search/reset additionally eager-drills the leftmost path via
`gotoFirstShowable`.

## Read these first (in order), then act
1. `REQUIREMENTS.md` — frozen spec. The source of truth for behavior & API.
2. `MILESTONES.md` — restartable plan + progress checkboxes + session log.
3. `CONVENTIONS.md` — code style, the `any` rule, and the **code-first (no-TDD)**
   workflow. Binding.
4. This file — architecture map & conventions.

**Do not re-derive the design by searching the codebase.** The three docs above
hold it. Trust them; update them when reality changes.

## Architecture map (where things live)
> Update this list as files are created; it is the index that lets a fresh
> session jump straight to the right file instead of grepping.

```
src/
  index.ts            # public exports
  components/         # DUMB components — render-only; every behavior lives in a
                      #   hook (refactor 2026-07-04). Each names its logic hook.
    BookReader.tsx    #   shell/layout only → hooks/useBookReader
    tree/             #   TreePane(+View) → useTreePaneView; TreeSearch →
                      #   useTreeSearch; TreeOverlay → useTreeOverlay;
                      #   defaultTreeNode.tsx
    content/          #   ContentPane → useContentPane; ContentNode →
                      #   useNodeContent; LazyContentPlaceholder.tsx
  hooks/              # ALL React logic
    useBookReader.ts  #   store+cache ownership, location (controlled/echo-guard),
                      #   deep-link nav, search/reset replace, responsive collapse
    useContentPane.ts #   reading order, lazy filtering, virtual-list wiring,
                      #   scroll requests, lazy scroll-trigger, active reporting
    useTreePaneView.ts#   visible-row flattening + roving-focus keyboard nav
    useTreeSearch.ts  #   query state + SearchApi
    useTreeOverlay.ts #   popover dialog behavior (focus/Esc/outside-click)
    useVirtualList.ts #   windowing + measurement + anchor correction + pin/prefetch
    useNodeContent.ts #   fetch+sanitize+cache pipeline per node
    useTreeState.ts   #   expanded/selected state
    useLazyChildren.ts#   lazy children fetch orchestration (dedupe/abort/status)
    useStoreVersion.ts / useElementWidth.ts
  core/               # pure logic, React-free
    treeStore.ts      # normalized id-indexed tree; mutable + subscribable
                      #   (setChildren/replaceTree/setLazyStatus + version/notify)
                      #   so lazy branches & search can swap subtrees at runtime
    traversal.ts      # depth-first next/prev reading order
    cache.ts          # bounded LRU content cache (maxChars), pinning, dedup;
                      #   `load(id, factory(signal))` = refcounted, abortable load
                      #   that owns the signal & never caches an aborted result
    virtualizer.ts    # windowing + height map + anchor correction + offsetAt
    scrollSync.ts     # active-node detection, near-bottom, reading-order overrides
    flatten.ts        # expanded-set → visible tree rows (incl. lazy status rows)
  types/              # public types split by domain: node / reading / fetching /
                      #   search / tree / content / cache / props + barrel index.ts
                      #   (imports of `../types` resolve to the barrel)
  utils/              # sanitize.ts, prefetchNodeContent.ts, length.ts
                      #   (lengthToPx/toCssLength), cx.ts (classname join)
  styles/             # book-reader.css: default skin (presentation only) +
                      #   --reader-* tokens; emitted to dist/book-reader.css by a
                      #   Vite plugin, exported as `book-reader/styles.css` (opt-in)
demo/                 # Vite dev harness: main.tsx (12-example switcher) + data.ts
                      #   (faker-generated, deterministic book data) + demo.css
e2e/                  # Playwright tests (reader.spec.ts) vs the real demo — no
                      #   mocks. `pnpm test:e2e`; playwright.config.ts; not in
                      #   Vitest's src/** include.
tests/                # Vitest unit/RTL suites (mirrors old src layout by topic)
```

## Key design invariants (do not break)
- **Cache, virtualization, and the height map are independent layers.** This is
  what makes "auto-cache + virtualized + no flicker" simultaneously possible.
- **No flicker / stable view is a hard requirement.** Scroll-back over read
  content must be a synchronous cache hit. Height changes use anchor correction.
- Cache is **bounded** (default: LRU by total character count) and **pinned** for
  the viewport+buffer+prefetch window.
- React 18 is a **peer dependency**, never bundled.
- Content is sanitized HTML by default; styling defaults ship but are fully
  overridable (CSS vars → data-part hooks → custom renderers).

## Conventions (full detail in `CONVENTIONS.md`)
- TypeScript strict. **No `any`** except documented last-resort (prefer generics
  / `unknown` + guards). Match surrounding code style.
- **Code first — NO TDD** (changed 2026-06-27). Think → code → the **user** tests
  the running app → **only after the user approves**, write regression tests. Never
  write tests before implementation or before approval (unless the user asks).
- 🚫 **HARD RULE (2026-06-28): do NOT write tests AND do NOT run the test suite
  (`pnpm test` / `pnpm test:e2e`) unless the user *explicitly* asks in that turn.**
  All test work is batched to the end of development — the user will say when.
  Until then, only `pnpm build` + lint + typecheck verify a change. The growing
  test backlog lives at the **very bottom of `MILESTONES.md`** ("⏸ PENDING TESTS")
  so it isn't forgotten; add to it, don't act on it.
- 🚫 **HARD RULE (2026-06-28) — TEST BOOKKEEPING IS MANDATORY & CONTINUOUS.** Every
  feature/change that ships **without** tests MUST have its owed tests logged
  **immediately** in the bottom-of-`MILESTONES.md` "⏸ PENDING TESTS" backlog — never
  let shipped behavior go unrecorded. The backlog is the durable source of truth
  (NEXT_SESSION mirrors only the active slice). **Coverage philosophy: book-keep and
  later write a small set of ESSENTIAL END-TO-END / integration tests** (real-browser
  `e2e/` Playwright + key cross-module flows) that prove the feature works **for the
  user** — **NOT** exhaustive per-file/unit coverage. Frame every backlog entry around
  the essential e2e flow, not depth-first unit assertions.
- 🚫 **HARD RULE (2026-06-28): README + stability lifecycle.** The moment a
  milestone/feature is **coded**, document it in `README.md` — never defer. A
  freshly-coded feature is marked ⚠️ **Experimental** (API may change; not yet
  test-covered). It graduates to **Stable** (drop the ⚠️) **only after its tests
  exist** — and test timing is **user-controlled** (see the test HARD RULE).
  Lifecycle: **code → document as Experimental → (user calls for tests) → Stable.**
  Full detail in `CONVENTIONS.md` › "README & feature stability".
- `core/` must not import React (keeps it pure + unit-testable).
- Tests (when written, post-approval) are Vitest/RTL suites in the top-level
  `tests/` directory (mirroring `src/` by topic); browser-only behavior goes in
  `e2e/` (Playwright), not jsdom.
- Keep `pnpm build` + lint + typecheck green as you go; a change is shippable when
  those pass and the user has approved the behavior.

## Current status
**✅ 2026-07-04: the ⏸ PENDING TESTS backlog is CLEARED** (the authorized test
session worked all of it; the bottom-of-`MILESTONES.md` section records where each
item landed — new owed tests go there again). **M11 shipped + Stable**: book/tree-
level "no data / no results" state — `data-part="content-nodata"` default panel in
`ContentPane` when the tree has no showable content node, `renderNoData` render-prop
override, `--reader-content-nodata-padding` token (covered by E5 e2e + U2 RTL + E6).
**The P1 LZ-UP e2e caught a real design bug (fixed, `hooks/useVirtualList.ts`):
anchor correction pinned the fold line, which sits *inside* the materialising
region during an upward lazy cascade — the view ratcheted up the resolving branch
and the cascade stalled.** Fix = direction-aware anchoring (last *user* scroll
direction tracked): scrolling **up**, anchor the first **settled** node at/below
the fold (settledness read from mounted `data-status`) and correct in full for
everything above it, in BOTH the ResizeObserver path and a new sequence-swap
layout effect (id swaps never fire an RO; it reconciles height-map vs DOM truth,
then pins the anchor). Scrolling down keeps the legacy fold rule. Full detail in
the MILESTONES session entry. **Suites: 205 unit + 48 e2e green; `playwright.
config.ts` runs 1 worker** (2 Chromiums + Vite on 4 cores starved rAF → flaky
"element not stable" clicks). Demo = **12-example switcher** (new: "11 · Lazy
depths" asymmetric-depth lazy book, "12 · Edge cases" empty/single/custom-order).
**M9 feature batch BUILT + TEST-COVERED 2026-06-28. Accessibility pass DROPPED
2026-07-02 (user has no plan to implement a11y — do not write a11y/keyboard/focus
tests or propose an a11y pass).** Test-coverage expansion landed 2026-07-02 (see
`TEST_PLAN.md` + session log): real-browser e2e for error/retry, a seeded
interaction **fuzzer** with an invariant oracle, controlled-`location`, remount
teardown, and LRU-eviction; new demo tabs "9 · States & errors" + "10 · Tiny cache".
Shipped + tested: `renderExpandCollapse`/`ExpandCollapseApi` (caret-only
tree customization, library keeps row a11y/keyboard nav), inter-node spacing split
(`--reader-content-padding-block`/`-inline`), `renderContentNode` wrapper render prop
(`ContentNodeApi`/`ContentNodeWrapperProps`; spread `wrapperProps` incl. `ref` or
virtualization breaks), auto-open active branch (driven by explicit
navigation in `goTo`, **not** the scroll-derived active — so the top of the book is never
auto-dumped), tree-indent moved into the skin (rows expose `--br-tree-depth`/`data-depth`).
Plus an **opinionated-style cleanup**: the bare component now carries only structural
layout inline (the default caret's `visibility` moved to the skin via `data-expandable`).
The collapsed-tree overlay is **uncontrolled only** — the headless/controlled
`treeOpen`/`onTreeOpenChange` props were **removed 2026-06-28** (no driving the overlay
from a toggle outside `<BookReader>`); custom-but-inside hooks `renderTreeToggle`/
`renderTreeOverlay` and `classNames.treeToggle`/`.treeOverlay` remain.
**Tests: small set of essential integration + real-browser
flows; only `ResizeObserver`/`scrollIntoView` are stubbed. All features are Stable
in the README** (no ⚠️ Experimental left). Generic (object)
content payload shipped earlier in the batch too.

M0–M7 done. **M7 (styling system)**: `src/styles/book-reader.css` is the importable
default skin — **presentation only** (font/colors/typography/spacing), scoped under
`[data-part="book-reader"]`, layered on top of the **functional layout the components
keep inline** (flex/overflow/height/position) so the reader works even without the
sheet. Three tiers (REQUIREMENTS §2.5): (1) override the `--reader-*` tokens declared
on the root data-part — full set (font, `--reader-content-font`, accent/soft/hover/
error colors, surfaces, `--reader-tree-indent`, radius, focus-ring) — and **every
padding/margin in the skin is a token** (tree padding/row/gap, content padding,
prose paragraph/heading/blockquote/code spacing, error+retry spacing; defaults
unchanged) so spacing is fully tweakable without fighting hard-coded values; (2)
target the stable `data-part` hooks / per-slot `classNames` — `classNames.root`
(newly wired), `tree`, `treeNode` (new — `treeNodeClassName` through `TreePaneView`/
`TreePane`), `content`, `contentNode`; (3) render-props (M3/M6). Build: a Vite plugin
`emitDefaultStylesheet()` copies the CSS to `dist/book-reader.css` (`generateBundle` →
`emitFile`); the CSS is **not** imported by `src/index.ts`, so `import
'book-reader/styles.css'` is opt-in + tree-shake-safe (`package.json` exports +
`sideEffects:["**/*.css"]`). 3 RTL styling tests (data-part hooks, classNames
threading, token consumption). **137 tests green.**

**M8 in progress** (hardening/docs/examples). Core coverage reviewed (solid),
bundle/tree-shake re-confirmed. **Demo rewritten** into a 4-example switcher
(`demo/main.tsx`: Quickstart / Lazy / States / Styling+location) over faker data
(`demo/data.ts`). **e2e (Playwright) suite added** (`e2e/reader.spec.ts`, 6 tests,
real Chromium, no mocks) — the **first real-browser run found & fixed two bugs**:
(1) **cache poisoning by aborted fetches** — an aborted async fetch resolved to `''`
and `cache.dedupe` cached it, so nodes showed "No content." forever; fixed with the
refcounted, signal-owning `cache.load` (never caches an aborted result) which the
hook's async path now uses. (2) **Unbounded reading viewport** — the reader root had
no height, so the content pane grew to full book height and never virtualized/
scrolled; fixed with `height:100%` on the reader root (fills the consumer's sized
container). Demo `.reader-frame` is now `clamp(320px,60vh,760px)` so window resize
grows the viewport (resize→fetch-more). **Publishing is OUT of scope** — the user
packages/publishes manually; do not run `npm pack`/`publish` or bump the version.
**README written** (`README.md` — consumer usage guide: install, quickstart,
core concepts, states, `location`, styling tiers, prop table).
**137 unit + 6 e2e green.**

**✅ Resolved — scroll flicker (2026-06-27).** The view jumped on *some* scrolls — a
"no flicker / stable view" violation. **Real root cause:** a **StrictMode
double-`ResizeObserver` leak** in `hooks/useVirtualList.ts` — the node observer was
created via lazy-init *during render* (impure), so StrictMode's double render +
remount left two live observers that each applied anchor correction → ~2× scroll
jump. Fixed by owning the observer in a `useLayoutEffect` (clean lifecycle; observes
already-mounted nodes on setup). Fixed alongside: (a) a **straddle over-correction** —
correction must use the node's *bottom* edge (`start+oldHeight <= scrollTop`), not
`start < scrollTop`, since growth is at the bottom (`correctScrollTop` updated to take
`itemBottom`); (b) **native scroll-anchoring conflict** — `overflow-anchor: none` on
the scroll surface so the browser's anchoring can't double up with ours; (c) folding
the corrected scrollTop into state in the same batch (`syncMetrics()` after
correction) + computing starts from the height map (`offsetAt`) not the rendered
window. Guarded by `content/ContentPane.anchor.test.tsx` (jsdom logic) + a
real-browser `e2e/reader.spec.ts` "reading line stays put" test (the StrictMode leak
only reproduces in a real browser). Remaining M8: none (a11y pass DROPPED 2026-07-02
at user request; README done).

### M6 reference (scroll ⟷ tree sync)
Pure mapping in
`core/scrollSync.ts` — `activeNodeAt` (node under the scroll reference line),
`isNearBottom`, `withReadingOverrides` (layers `getNextNode`/`getPrevNode` over
the base DFS order; visited-guarded `getSequence`); plus `virtualizer.offsetAt`
(absolute start of an off-screen node). React wiring: `useVirtualList` now tracks
**live scroll** (added the missing scroll listener) and exposes `activeId`/
`activeOffset`/`atBottom`/`scrollToId`; `ContentPane` builds an override-aware
sequence, reports active changes, and honours a tokened `scrollRequest`;
**`BookReader` is the
coordinator** — lifts one shared `useTreeState` (`TreePane` split into
`TreePaneView`+`TreePane`), highlights the active node, auto-expands its path
deepest-first only when the active node changes, and implements controlled/
uncontrolled `location` + `onLocationChange` with an echo-guard. New props:
`getNextNode`/`getPrevNode`/`location`/`defaultLocation`/`onLocationChange`. New
types: `ReadingOrderContext`, `GetNextNode`/`GetPrevNode`, `BookLocation`. 134 tests
green; build+lint+typecheck clean. **Next: M7 styling system** (importable default
CSS, `--reader-*` tokens, `data-part` hooks — most already on elements — per-slot
classNames, demo skins).

---

### M5 reference (virtualization + stable scroll)
`core/virtualizer.ts` (`createVirtualizer`, pure):
**height map** (`setHeight` remembers measured px, returns the delta vs the prior
height; `getHeight` estimates unknowns, default 200) + **windowing** (`getWindow` →
mounted items with absolute starts + top/bottom spacer paddings + totalHeight;
`viewportHeight ≤ 0` ⇒ mount all, the un-measured fallback) + **anchor correction**
(`correctScrollTop`, pure: a node above the viewport top shifts the view, add the
delta back) + `pinnedIds`/`prefetchIds`. React wiring in `hooks/useVirtualList.ts`:
owns the scroll-container ref + live scrollTop/clientHeight, one `ResizeObserver`
measures every mounted node (eager lazy-init; per-id **stable** ref callbacks to
avoid observe churn), applies anchor correction synchronously in the RO callback,
and drives `cache.setPinned(pinnedIds(...))` + warms `prefetchIds(...)` via
`prefetchNodeContent` (mirrors `useNodeContent`'s fetch+sanitize+cache pipeline,
no React state). `ContentPane` is now the scroll surface (spacer divs + windowed
`ContentNode`s; `ContentNode` has a `measureRef`). New props: `overscan` (2),
`prefetchCount` (2), `estimateHeight`. `resolveSanitizer` lives in `sanitize.ts`
(shared). `resolveSanitizer` lives in `sanitize.ts` (shared).

---

Package name = `book-reader`. Package manager = **pnpm** (not npm).
Note: `tsconfig` has `exactOptionalPropertyTypes` — public optional props must be
typed `?: T | undefined` so consumers can forward maybe-undefined values.
(Authoritative status + session log live in `MILESTONES.md`.)
```
