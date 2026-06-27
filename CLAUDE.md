# CLAUDE.md — BookReader library

> This file is auto-loaded into context at the start of **every** Claude Code
> session in this repo. Keep it short, current, and high-signal. It is the
> primary tool for avoiding full-project re-exploration (and the token cost of it).

## What this is
A React 18 **library** exposing `<BookReader>`: a two-pane book reader (section
tree on the left, continuous virtualized reading surface on the right). Scales
from tiny inline books to huge lazily-loaded ones.

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
  BookReader.tsx      # top-level component, composes the panes
  types.ts            # Node, BookReaderProps, FetchContext, CacheConfig, ...
  core/
    treeStore.ts      # normalized id-indexed tree; sync + lazy loadChildren
    traversal.ts      # depth-first next/prev reading order
    cache.ts          # bounded LRU content cache (maxChars), pinning, dedup;
                      #   `load(id, factory(signal))` = refcounted, abortable load
                      #   that owns the signal & never caches an aborted result
    virtualizer.ts    # windowing + height map + anchor correction + offsetAt
    scrollSync.ts     # active-node detection, near-bottom, reading-order overrides,
                      #   next-lazy-subtree-to-load (pure; React-free)
  tree/               # left pane: TreePane.tsx, useTreeState.ts, flatten.ts,
                      #   defaultTreeNode.tsx (+ tests)
  content/            # right pane: ContentPane (virtualized scroll surface),
                      #   ContentNode, useNodeContent, useVirtualList (windowing +
                      #   measurement + anchor correction + pin/prefetch driver),
                      #   prefetchNodeContent, sanitize
  styles/             # book-reader.css: default skin (presentation only) +
                      #   --reader-* tokens; emitted to dist/book-reader.css by a
                      #   Vite plugin, exported as `book-reader/styles.css` (opt-in)
demo/                 # Vite dev harness: main.tsx (4-example switcher) + data.ts
                      #   (faker-generated, deterministic, lazy book data) + demo.css
e2e/                  # Playwright tests (reader.spec.ts) vs the real demo — no
                      #   mocks. `pnpm test:e2e`; playwright.config.ts; not in
                      #   Vitest's src/** include.
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
- `core/` must not import React (keeps it pure + unit-testable).
- Tests (when written, post-approval) use Vitest next to source as `*.test.ts(x)`;
  browser-only behavior goes in `e2e/` (Playwright), not jsdom.
- Keep `pnpm build` + lint + typecheck green as you go; a change is shippable when
  those pass and the user has approved the behavior.

## Current status
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
core concepts, lazy trees, states, `location`, styling tiers, prop table).
**137 unit + 6 e2e green.**

**✅ Resolved — scroll flicker (2026-06-27).** The view jumped on *some* scrolls — a
"no flicker / stable view" violation. **Real root cause:** a **StrictMode
double-`ResizeObserver` leak** in `content/useVirtualList.ts` — the node observer was
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
only reproduces in a real browser). Remaining M8: a11y pass (README done).

### M6 reference (scroll ⟷ tree sync & auto-advance)
Pure mapping in
`core/scrollSync.ts` — `activeNodeAt` (node under the scroll reference line),
`isNearBottom`, `nextNodeToLoad` (next expandable-but-unloaded node = next lazy
subtree to fetch), `withReadingOverrides` (layers `getNextNode`/`getPrevNode` over
the base DFS order; visited-guarded `getSequence`); plus `virtualizer.offsetAt`
(absolute start of an off-screen node). React wiring: `useVirtualList` now tracks
**live scroll** (added the missing scroll listener) and exposes `activeId`/
`activeOffset`/`atBottom`/`scrollToId`; `ContentPane` builds an override-aware
sequence, reports active changes, asks `onNeedNode` to load the next lazy subtree
near the bottom, and honours a tokened `scrollRequest`; **`BookReader` is the
coordinator** — lifts one shared `useTreeState` (`TreePane` split into
`TreePaneView`+`TreePane`), highlights the active node, auto-expands its path
deepest-first only when the active node changes, threads `version` into the content
pane (so lazy loads regrow the reading sequence), and implements controlled/
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
delta back) + `pinnedIds`/`prefetchIds`. React wiring in `content/useVirtualList.ts`:
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
