# NEXT SESSION — start here

> Scratch handoff for the next Claude Code session. Delete once its task lands.
> Read CLAUDE.md + the MILESTONES STATUS block first, then do the Task below.

## ▶ TO RESUME: one line is enough
Say: **"Continue with NEXT_SESSION.md"**.

## Task (PRIMARY): the accessibility pass — the LAST remaining M9 item
Everything else is built, documented (all **Stable**), and test-covered
(155 unit + 16 e2e green). The only thing left is a focused **accessibility pass**
across the whole reader, then a11y tests.

What already ships (don't redo — verify/extend):
- Tree: `role="tree"`/`treeitem`, `aria-level`/`aria-expanded`/`aria-selected`,
  roving `tabindex`, full keyboard nav (↑↓→←/Home/End/Enter/Space).
- Collapsed tree overlay: `role="dialog"`, Esc + outside-click close, focus moves to
  the active row on open and returns to the toggle on close; toggle has
  `aria-haspopup="dialog"` + `aria-expanded`.
- Reader/panes carry `aria-label`s; content nodes set `aria-busy` while loading.

Audit + harden (suggested scope — confirm with the user if unsure):
- Reading surface semantics: should the content pane be a labelled region / have a
  reading landmark? Is the active section announced (aria-live / `aria-current`)?
- Focus management when navigating via the tree (does focus follow into content?).
- Error/retry + loading/empty states: roles/labels for assistive tech (retry is a
  real button; error already uses `role="alert"`).
- Reduced-motion / scroll behaviour; visible focus rings on all interactive parts.
- The render-prop escape hatches must not strip required a11y (document the contract).

## Workflow (unchanged)
- **Code-first, NO TDD.** Build → user tests → tests after approval. BUT the user may
  again ask to batch the a11y tests at the end — follow what they say in-session.
- Keep `pnpm build` + lint + typecheck green as you go. **pnpm, not npm.** TS strict,
  **no `any`**; `core/` stays React-free; styling stays unopinionated (structural inline
  only, look is opt-in); React stays a peer dep. **Do NOT package/publish.**
- Tests live in `tests/**` (Vitest/RTL, jsdom) + `e2e/**` (Playwright, real browser
  against the demo). `vitest.setup.ts` stubs `ResizeObserver` + `scrollIntoView`.

## How to run / verify
- `pnpm dev` — demo is an **8-example switcher** (Quickstart / Branch / Lazy /
  Styling / Responsive / Object / Render hooks / Headless tree).
- `pnpm build` / `pnpm lint` / `pnpm typecheck` must stay green.
- `pnpm test` (155 unit) / `pnpm test:e2e` (16 Playwright, real Chromium).
