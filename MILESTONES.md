# BookReader — Milestones & Progress

> **Restartable plan + progress tracker (single source of truth).** Each
> milestone is independently shippable and verifiable. At the start of any
> session, read the STATUS block below first, then `REQUIREMENTS.md` +
> `CONVENTIONS.md` + `CLAUDE.md`. Update this file as work lands.

---

## ▶ STATUS — keep this block current (update at end of every session)
- **Current milestone:** M2 — Tree model (IN PROGRESS: treeStore done, tree pane UI next)
- **Overall progress:** 1 / 9 milestones complete (M0 done; M1 core types done)
- **Next action:** M2 traversal (depth-first reading order) via TDD, then TreePane UI.
- **Blocked on:** nothing. Package name = `book-reader`. pnpm is the package manager.
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

## M2 — Tree model (sync + async)
**Goal:** the left pane with both data strategies.
- [x] Normalized internal tree store (id-indexed) supporting partial/lazy trees.
- [x] Accept full sync `tree` object (+ forest of roots).
- [x] Lazy node support in store (`hasChildren`, `setChildren`). [loadChildren wiring: M2 UI]
- [ ] Accept async `loadChildren`; lazy-expand on demand (React layer).
- [ ] Expand/collapse, selection, keyboard nav.
- [ ] Default tree node renderer + `renderTreeNode` override.
**Done when:** both a small inline book and a lazy book render & expand.

## M3 — Content fetch + continuous render (no virtualization yet)
**Goal:** right pane reads top-to-bottom.
- [ ] `fetchContent` integration (sync + async), `FetchContext` assembled.
- [ ] HTML sanitization (toggle), `renderContent` override.
- [ ] Depth-first reading-order traversal (`getNext/getPrev` + overrides).
- [ ] Loading / error / empty states + their render-props.
**Done when:** a book renders its nodes in book order in one scroll surface.

## M4 — Caching layer
**Goal:** bounded auto-cache, delegated-but-safe.
- [ ] In-memory content cache keyed by node id.
- [ ] LRU eviction by `maxChars` (default), `maxNodes`, custom `evict`.
- [ ] In-flight de-duplication.
- [ ] Pinned window (never evict viewport+buffer+prefetch range).
- [ ] Unit tests for eviction & pinning.
**Done when:** cache stays bounded under large-book simulation; pinned nodes survive.

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
- 2026-06-26 — **M0 done, M1 core types done, M2 treeStore done.** Scaffolded
  Vite lib + TS strict + pnpm; ESM/CJS/dts build green; eslint no-explicit-any
  active; vitest wired. Wrote `src/types.ts` (generic `BookNode<Meta>`, cache
  types). Built `core/treeStore.ts` **via TDD** (red→green→refactor; a test
  caught the leaf-vs-unloaded semantic). 9 tests green, lint+typecheck clean.
  Next: `core/traversal.ts` (depth-first reading order) via TDD.
- 2026-06-26 — Spec frozen (`REQUIREMENTS.md`), milestones drafted, `CLAUDE.md`
  created. No implementation code yet. Next: M0 scaffold (awaiting package name).
