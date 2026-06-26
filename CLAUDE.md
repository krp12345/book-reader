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
    virtualizer.ts    # windowing + height map + anchor correction
    scrollSync.ts     # scroll <-> active node <-> tree expansion
  tree/               # left pane: TreePane.tsx, useTreeState.ts, flatten.ts,
                      #   defaultTreeNode.tsx (+ tests)
  content/            # right pane (ContentPane, ContentNode, sanitize)
  styles/             # default stylesheet + --reader-* tokens
demo/                 # Vite dev harness with sample books
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
M0–M3 done (tree model + TreePane UI + right pane). **M4 done**: the caching layer.
`core/cache.ts` (`createContentCache`): bounded in-memory cache of *sanitized* HTML
keyed by node id — LRU by `maxChars` (default ~5M) + optional `maxNodes` + custom
`evict`; eviction fires only when over budget; `setPinned(ids)` exempts a window
from eviction (pinned ids never offered to a custom `evict`); `dedupe(id, factory)`
shares one in-flight promise and caches on resolve. Wired through
`useNodeContent` (synchronous cache hit settles flash-free / no re-fetch; reuses
`getInFlight`; async routes through `dedupe`) → `ContentNode`/`ContentPane`;
`BookReader` makes one cache per instance via `useRef` (config captured at mount),
fed by the new `BookReaderProps.cache`. 91 tests green; build+lint+typecheck clean.
**Next: M5 virtualization (`core/virtualizer.ts`: windowing, height map, anchor
correction) + drive `cache.setPinned()` from the viewport+overscan+prefetch window
+ `prefetchCount`.**
Notes for M5–M6: the cache *supports* pinning but nothing drives `setPinned` yet —
M5 computes the pinned window. The content pane recomputes its sequence from a
`version` prop but cross-pane scroll⟷tree sync, `location`, and reading-order
overrides (`getNextNode`/`getPrevNode`) are deliberately deferred to M6.
Package name = `book-reader`. Package manager = **pnpm** (not npm).
Note: `tsconfig` has `exactOptionalPropertyTypes` — public optional props must be
typed `?: T | undefined` so consumers can forward maybe-undefined values.
(Authoritative status + session log live in `MILESTONES.md`.)
```
