# NEXT SESSION — start here

> Scratch handoff for the next Claude Code session. Delete once its task lands.
> Read CLAUDE.md + the MILESTONES STATUS block first, then do the Task below.
> (Shipped-work detail lives in MILESTONES.md — M9 checkboxes + session log.)

## ▶ TO RESUME: one line is enough
Say: **"Continue with NEXT_SESSION.md"**.

## ⚠ Workflow (CODE FIRST, NO TDD — batch mode for next session)
- **Next session = BATCH, not step-by-step.** Build *all* of features 3–8 in one
  pass (a11y excluded), then hand back the whole thing; the **user** tests the full
  batch and drives iterations; milestones get refined after. Do **not** stop for
  per-feature approval. (See PRIMARY task below.)
- Underlying loop unchanged: **code → the user tests the running app → fixes/
  iterations → (regression tests only when the user later asks).** Never gate
  implementation on tests. (Authoritative: `CONVENTIONS.md` › "Testing — code first".)
- 🚫 **HARD RULE: do NOT write tests AND do NOT run `pnpm test` / `pnpm test:e2e`
  unless the user *explicitly* asks in that turn.** Test work is batched to the end;
  the user will say when. Keep adding owed cases to the backlog (bottom of
  `MILESTONES.md` + the list below) — but do not act on them.
- Keep `pnpm build` + lint + typecheck green as you go (these are the *only*
  verification you run unprompted).
- **pnpm, not npm.** TS strict, **no `any`**. `core/` must not import React.
- **Do NOT package/publish** — the user does that manually.

## Task (PRIMARY): BUILD ALL remaining features in ONE pass (NOT step-by-step)
**Execution mode set by the user 2026-06-28 — read carefully:**
- **Do NOT go feature-by-feature with an approval gate between each.** Implement
  **all** the remaining M9 features below **in a single batch**, then hand the whole
  thing back. The user will **test the full batch themselves and drive iterations**
  to fix/adjust; **then** the milestones get refined if needed.
- **EXCLUDE accessibility** (item 9) — do *not* start the a11y pass; it stays last
  and separate.
- Still **CODE-FIRST + the HARD test rule**: no tests written, no `pnpm test` /
  `pnpm test:e2e` run, unless the user explicitly asks. Keep `pnpm build` + lint +
  typecheck green throughout. Add each feature's owed tests to the backlog at the
  **bottom of `MILESTONES.md`** as you go.
- Add/extend **demo examples** for each so the user can exercise everything in one
  `pnpm dev` session.

**Build these (everything except a11y) — full briefs in MILESTONES.md › M9:**
1. **Configurable expand/collapse control** — `renderExpandCollapse?:
   RenderExpandCollapse`, `RenderExpandCollapse = (api: ExpandCollapseApi) =>
   ReactNode`, `ExpandCollapseApi = { expandable; expanded; loading; depth; toggle();
   expand(); collapse() }`. Replaces *only* the hard-coded caret in `TreePane.tsx`
   (library keeps the row wrapper + `aria-expanded` + keyboard nav). Keep
   `data-part="tree-node-caret"`. Threads `TreePaneView`→`TreePane`→`BookReader`
   (+ overlay tree). (Names provisional.) **Only tree customization in scope.**
2. **Inter-node spacing token split** — a token for the gap *between* sections,
   independent of inline content padding (e.g. `--reader-content-node-gap` or
   `--reader-content-padding-block/-inline`). Defaults unchanged.
3. **`renderContentNode`** — per-content-node *wrapper* render prop; hand back the
   wrapper props (`ref={measureRef}` / `data-node-id` / `data-status` / `aria-busy`)
   to spread onto a consumer element. Content side only.
4. **Headless / controlled tree-collapse** — expose collapse + overlay open state
   (`treeOpen`/`onTreeOpenChange`) + the tree as a standalone, so the toggle/tree can
   live *outside* `<BookReader>`.
5. **Auto-open active branch** — when the active node is a branch, expand its *own*
   children (currently auto-expand opens only ancestors). Optional polish — do it if
   cheap.
6. **Tidy default styles** — move the `--reader-tree-indent` default out of the inline
   row style into the opt-in skin (bare component = zero non-layout style).

**Invariants (do not break):** no-flicker / virtualization layering; cache /
height-map independence; React stays a **peer dep**; `core/` stays React-free;
unopinionated styling (structural inline only; look is opt-in). **Dropped — do NOT
build:** `renderContentSurface`, broad tree-row wrapper (`renderTreeRow`).

> Note: the **object content payload** (demo example 6) is already implemented and
> will be tested as part of the user's batch test — no separate gate needed.

## ✅ Priority order (batch mode 2026-06-28 — build 3–8 together, a11y excluded)
1. ✅ **Responsive tree-collapse** — DONE & user-approved. Tests deferred.
2. ✅ **Object content payload** (M9 — generic, non-string content) — implemented,
   tested as part of the user's batch test. Tests deferred.
   --- ⬇ **Items 3–8 = the NEXT-SESSION BATCH (do all in one pass, no gates)** ⬇ ---
3. **Configurable expand/collapse control** (M9 — replaceable tree caret/disclosure
   via the `ExpandCollapseApi` contract; the *only* tree customization in scope)
4. **Inter-node spacing token split** (M9 — vertical gap independent of inline padding)
5. **Per-node content wrapper render prop** — `renderContentNode` (hand back the
   wrapper props — ref/`measureRef`/`data-*` — to spread onto a custom element).
   *Content side only* (tree-row wrapper was dropped).
6. **Headless tree-collapse** — place the toggle/tree *outside* `<BookReader>`
7. **Auto-open active branch** — expand the active branch's *own* children (optional
   polish; skip unless cheap).
8. **Tidy default styles** — move `--reader-tree-indent` default into the opt-in skin
   (purity cleanup; lowest value).
   --- ⬆ **end of batch** ⬆ ---
9. **Accessibility pass** — **EXCLUDED from the batch; do LAST, separately**, only
   after the user has tested/iterated the batch above.
Plus housekeeping: re-confirm bundle-size / tree-shake (M8 had it in-progress).

**Dropped (user, 2026-06-28):** `renderContentSurface` (whole-text-area wrapper) and
broad **configurable tree node / `renderTreeRow`** — only the expand/collapse control
stays configurable.
(Full briefs: MILESTONES.md › M9.)

## ⏸ PENDING TESTS — DEFERRED (decided 2026-06-28)
> 🚫 **HARD RULE: never write these tests or run `pnpm test` / `pnpm test:e2e`
> unless the user explicitly asks in that turn.** Durable source-of-truth backlog
> = **bottom of `MILESTONES.md`** ("⏸ PENDING TESTS"); the list below mirrors the
> active slice. When a feature lands without tests, append its owed cases there.
> 🚫 **Bookkeeping is mandatory & continuous** — every shipped-without-tests feature
> gets its owed cases logged immediately. 🎯 **Aim for a small set of ESSENTIAL
> end-to-end / integration flows** (real-browser e2e + key cross-module paths), **not**
> exhaustive per-file unit tests.

The user is **batching all test-writing to the end of development**. Keep building
features; do **not** stop to write regression/e2e tests as each lands. When the
feature work is done, write everything below in one pass. Keep `build` + lint +
typecheck green meanwhile.

- **Generic (object) content payload** — jsdom/RTL unit (`tests/content/`, `tests/BookReader.*`):
  - Object `fetchContent` → `renderContent(node, payload, state)` gets the *typed*
    object; `state.content === payload`, `state.status === 'loaded'`.
  - **Object path is never sanitized / never `dangerouslySetInnerHTML`'d** (assert an
    object with an HTML-looking string field passes through untouched; no
    `[data-part="content-html"]` node for objects). **String path unchanged:** default
    renderer still sanitizes + `dangerouslySetInnerHTML`s; `ContentState.content` holds
    the *sanitized* string.
  - **Empty detection** (`isEmptyContent`): blank/whitespace string → `'empty'`;
    `null`/`undefined` → `'empty'`; non-empty object → `'loaded'`.
  - **Object + no `renderContent`** → body renders nothing (no unsafe default), status `'loaded'`.
  - **Cache stores objects:** scroll-back = synchronous cache hit (no refetch); custom
    `cache.sizeOf` honored (default `sizeOf` uses `String(content).length`).
  - **`prefetchNodeContent`** caches objects (sanitize skipped) and still sanitizes strings.
  - **error/retry** unchanged on the object path.
  - **API rename guard:** `ContentState.html` → `ContentState.content`.
- **Responsive tree-collapse** — **e2e** (`e2e/`): real resize → tree collapses →
  open popover at current reading position → select navigates + closes → widen
  restores the inline pane. Plus jsdom unit: collapse threshold + `lengthToPx`,
  prop/`classNames` wiring (`treeToggle`/`treeOverlay`). **Also cover the named
  collapse modes** added 2026-06-28: `collapseTree="always"` (and `true`) forces the
  toggle+popover at full width; `"never"` (and `false`) never collapses; `"auto"` is
  width-driven.
- **`treeOverlayMinWidth`** / **`treeOverlayMinHeight`** — unit: number→px / string
  resolution, `min-width`/`min-height` applied to the default popover (height capped
  by `max-height: 70vh`).
- **ResizeObserver test-infra** — global stub in `vitest.setup.ts` + the
  `useReaderWidth` clientWidth read keep the suite green; no new test owed, just re-run.

## Minor open offers (slot into items above)
- Move the tree-indent default (`--reader-tree-indent`, applied inline on rows) into
  the opt-in skin, so the bare no-CSS component has *zero* non-layout style.
- Auto-expand the active node's *own* children when it's a branch (auto-expand
  currently opens only ancestors → tree sits collapsed-at-root at a book's top).
- Wrapper-level render prop (`renderContentNode`) that hands back the content-node
  wrapper props (ref/`measureRef`/data-*) to spread onto a custom element — current
  `renderContent` replaces only the slot's *inner* content, not its wrapper. (Item #5.
  Tree-row wrapper `renderTreeRow` was dropped; only the caret stays configurable.)

## How to run / verify
- `pnpm dev` — demo is a **6-example switcher** (Quickstart / Branch / Lazy /
  Styling / Responsive / Object). Port varies if 5173 is taken.
- `pnpm build` / `pnpm lint` / `pnpm typecheck` must stay green.
- `pnpm test` (unit) / `pnpm test:e2e` (Playwright).
