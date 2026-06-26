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
3. `CONVENTIONS.md` — code style, the `any` rule, and the TDD workflow. Binding.
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
    cache.ts          # bounded LRU content cache (maxChars), pinning, dedup
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
demo/                 # Vite dev harness (main.tsx + demo.css): 3-tier skin switcher
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
- **Pragmatic TDD**: red→green→refactor by default; bend the rule for spikes and
  DOM/scroll surfaces. Core pure logic (traversal, cache, treeStore, virtualizer
  math) is always tested.
- `core/` must not import React (keeps it pure + unit-testable).
- Tests with Vitest live next to source as `*.test.ts(x)`.
- Run `pnpm build && pnpm test` before declaring a milestone done.

## Current status
M0–M7 done. **M7 (styling system)**: `src/styles/book-reader.css` is the importable
default skin — **presentation only** (font/colors/typography/spacing), scoped under
`[data-part="book-reader"]`, layered on top of the **functional layout the components
keep inline** (flex/overflow/height/position) so the reader works even without the
sheet. Three tiers (REQUIREMENTS §2.5): (1) override the `--reader-*` tokens declared
on the root data-part — full set (font, `--reader-content-font`, accent/soft/hover/
error colors, surfaces, spacing, `--reader-tree-indent`, radius, focus-ring); (2)
target the stable `data-part` hooks / per-slot `classNames` — `classNames.root`
(newly wired), `tree`, `treeNode` (new — `treeNodeClassName` through `TreePaneView`/
`TreePane`), `content`, `contentNode`; (3) render-props (M3/M6). Build: a Vite plugin
`emitDefaultStylesheet()` copies the CSS to `dist/book-reader.css` (`generateBundle` →
`emitFile`); the CSS is **not** imported by `src/index.ts`, so `import
'book-reader/styles.css'` is opt-in + tree-shake-safe (`package.json` exports +
`sideEffects:["**/*.css"]`). Demo: 3-way skin switcher (default / themed token-only /
fully-custom render-props), M6 location readout kept; `demo/demo.css` holds the themed
+ custom skins. 3 RTL styling tests (data-part hooks, classNames threading, token
consumption). **137 tests green.** **Next: M8** — README + prop reference, a11y pass,
core coverage review, bundle-size/tree-shake check, package name decision, `npm
publish --dry-run`.

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
