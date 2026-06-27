# NEXT SESSION — start here

> Scratch handoff for the next Claude Code session. Delete once its task lands.
> Read CLAUDE.md + the MILESTONES STATUS block first, then do the Task below.

## ⚠ Workflow (CODE FIRST, NO TDD — unchanged)
- Loop: **think → code → the user tests the running app → only after the user
  approves, write regression tests.** Never gate implementation on tests.
  (Authoritative: `CONVENTIONS.md` › "Testing — code first".)
- Keep `pnpm build` + lint + typecheck green as you go.
- **pnpm, not npm.** TS strict, **no `any`**. `core/` must not import React.
- **Do NOT package/publish** — the user does that manually.

## ▶ TO RESUME: one line is enough
Say: **"Continue with NEXT_SESSION.md"** (or "do the responsive tree-collapse
task"). Run: `pnpm dev` → http://localhost:5179 (5-example switcher).
`pnpm test` / `pnpm test:e2e` (port 5179, reuses dev server).

## ✅ Done & verified since last handoff (all on `main`)
- **Tree-click navigation** (the old top task): confirmed already-fixed and
  **user-approved** — clicking organisational (`hasContent:false`) nodes resolves
  to the first content descendant; deep jumps pin the title to the top; cache
  scroll-back is a sync hit. Guarded by `e2e/reader.spec.ts` › "tree click
  navigates the reading surface" (5 cases).
- **Active-node tie-break fix** (`core/scrollSync.ts`: `>=`→`>`): the topmost of
  equally-covered sections is active (was bottom-most). User tested — works.
  Side effect (intended): at the very top of a book the root is the active node,
  so the tree sits collapsed-at-root on load until you move into the book. Open
  offer to the user: also auto-expand the active node's *own* children when it's
  a branch (currently auto-expand only opens ancestors). Not yet requested.
- **Spacing fully tokenized** (`styles/book-reader.css`): every padding/margin is
  a `--reader-*` token (defaults unchanged). README + CLAUDE.md updated.
- **Branch-content example**: `demo` "2 · Branch content" + `makeBranchContentBook`
  — non-leaf nodes can carry their own content and are first-class reading/active
  targets. e2e-guarded.
- **Render props are complete** (confirmed): `renderTreeNode`, `renderContent`,
  `renderLoading`, `renderError(node,error,retry)`, `renderEmpty` all wired. NOTE:
  they replace a slot's *inner* content, not its wrapper element (`<article
  data-part="content-node">` / `<div role="treeitem">` stay — measureRef + ARIA).
  A `renderContentNode`/`renderTreeRow` wrapper override is a possible small future
  prop the user floated; only build if asked.
- **139 unit + 11 e2e green.**

---

## Task (PRIMARY, user-requested): responsive tree-collapse → toggle + overlay
**Reading width wins.** Give the reading (content) section a configurable
**min width**; when the reader is too narrow to fit *both* the tree and that min
width, **sacrifice the tree first** — collapse it. Requirements, verbatim intent:

1. Content section has a configurable **min width**. When available width can't
   accommodate (tree + content-min), the **tree disappears first** (content keeps
   its min width and never goes below it).
2. Collapsed, the tree **reduces to a button** whose text comes from input (a
   label prop). Clicking it re-opens the tree.
3. Fully configurable: the user can supply a **custom component** for that
   collapsed trigger (instead of the default button).
4. When collapsed, provide a **utility to open the book tree in a new stacking
   context** (overlay/portal) so the tree stays fully accessible.
5. Allow a **custom container** for that overlay where the user controls
   height/width/position/etc. of the tree view.
6. If **no custom container** is given, default to **the same `<BookReader>` tree
   in a new stacking context** (an overlay rendering the normal TreePane), i.e.
   what you'd see normally, just floated — no width problem.

### Where this lives / touchpoints
- `src/BookReader.tsx` — the layout coordinator (owns the flex two-pane layout,
  `treeSide`/`treeWidth`). The responsive logic + collapsed/overlay rendering go
  here. It already lifts the shared `useTreeState` both panes use, so the overlay
  can reuse the exact same tree state (selection/expansion stay in sync).
- Need the **reader root's own width**: add a `ResizeObserver` on the root (mirror
  the pattern in `content/useVirtualList.ts`; keep it in a small hook, e.g.
  `src/useReaderWidth.ts` or inline). Collapse when
  `rootWidth - treeWidthPx < contentMinWidthPx`.
- `src/types.ts` — new `BookReaderProps`. **exactOptionalPropertyTypes**: type new
  optional props as `?: T | undefined`.
- Overlay = a real **new stacking context** — `createPortal` (React peer dep) to
  a container, or a positioned element with `isolation:isolate`/z-index. User said
  "new stacking context" explicitly.

### Proposed API (TENTATIVE — confirm with the user before locking)
- `contentMinWidth?: number | string` — reading-surface floor that triggers
  collapse (e.g. `420` / `'28rem'`).
- `treeCollapseLabel?: string` — text for the default collapsed button
  (default e.g. `'Contents'`).
- `renderTreeToggle?: (api: { isOpen: boolean; open(): void; close(): void;
  toggle(): void; label: string }) => ReactNode` — custom collapsed trigger.
- `renderTreeOverlay?: (api: { close(): void; children: ReactNode }) => ReactNode`
  — custom container controlling the floated tree's size/position; **default**
  renders the normal TreePane in a minimal built-in overlay panel.
- maybe `collapseTree?: 'auto' | boolean` — force-on / force-off the behavior
  (default `'auto'` = width-driven).

### Invariants to respect (do not break)
- **Unopinionated styling** (the user cares): default toggle/overlay carry only
  *structural* inline layout + `data-part` hooks; all look is opt-in via the skin
  / `classNames` / the render props above. No imposed colors/fonts.
- **No-flicker / virtualization** untouched: collapsing the tree must not disturb
  the content pane's bounded scroll viewport or its measured height map.
- **a11y**: toggle is a real `<button>` with `aria-expanded`/`aria-controls`;
  overlay gets a dialog role + focus management (focus in on open, `Esc` closes,
  focus returns to the toggle), and selecting a node navigates + closes.
- React stays a **peer dep**; `core/` stays React-free.

### Deliverable (CODE FIRST — no tests until the user approves)
Reproduce the squeeze in the demo (shrink the window / a narrow `.reader-frame`)
→ code the collapse + toggle + overlay (default first, then the render-prop
hooks) → hand to the user to test → after approval add tests (jsdom for the
collapse-decision logic + prop wiring; an `e2e/` case for the real resize →
collapse → open-overlay → select flow).

---

## Task (SECONDARY, also open): accessibility (a11y) pass — last core M8 item
Make the reader usable with a keyboard + screen reader. Reproduce in the demo,
code, hand back to the user to test, then (post-approval) add tests.

### Tree (left pane) — `src/tree/TreePane.tsx`
- Roving-tabindex keyboard nav already exists (Arrow/Home/End/Enter/Space). Verify
  it against the WAI-ARIA **tree** pattern; check `aria-expanded`/`aria-selected`/
  `aria-level` are correct on every row, and the caret is properly hidden from AT.
- Ensure a visible **focus-visible** ring (token `--reader-focus-ring` exists).

### Content (right pane) — `src/content/ContentNode.tsx` / `ContentPane.tsx`
- Loading nodes set `aria-busy` (present) — confirm; error uses `role="alert"`
  (present) — confirm it announces. Consider `aria-live="polite"` on the reading
  region for active-section changes, and a label on the scroll container.
- The spacer divs are `aria-hidden` (good). Check virtualized (unmounted) sections
  don't strand AT focus.

### Cross-pane
- Confirm the controlled `location` / active-node highlight is announced sanely.
- Tab order: tree → content. Skip-link not required for a 2-pane widget but verify
  focus doesn't get trapped.

### Deliverable
Reproduce gaps (keyboard-only + VoiceOver/NVDA if available, else axe/Lighthouse) →
code fixes → hand to user → after approval add tests (jsdom for role/aria wiring;
an `e2e/` case for focus/keyboard if browser-only).

## Minor open offers (only if the user asks)
- Move the tree-indent default (`--reader-tree-indent`, applied inline on rows)
  into the opt-in skin, so the bare no-CSS component has *zero* non-layout style.
- Auto-expand the active node's *own* children when it's a branch (auto-expand
  currently opens only ancestors → tree sits collapsed-at-root at a book's top).
- Wrapper-level render props (`renderContentNode`/`renderTreeRow`) that hand back
  the wrapper props (ref/data-*/ARIA/handlers) to spread onto a custom element —
  current render props replace a slot's *inner* content, not its wrapper.

## How to run / verify
- `pnpm dev` → http://localhost:5179.
- `pnpm build` / lint / typecheck must stay green.
- `pnpm test` (139) / `pnpm test:e2e` (11, port 5179).
