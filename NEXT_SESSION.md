# NEXT SESSION — start here

> Scratch handoff for the next Claude Code session. Delete once its task lands.
> Read CLAUDE.md + the MILESTONES STATUS block first, then do the task below.

## ⚠ Workflow for this project (changed 2026-06-27) — CODE FIRST, NO TDD
- **Do NOT write tests up front.** Loop: **think → code → the user tests the running
  app → only after the user approves, write regression tests.** Never gate the
  implementation on tests. (Authoritative: `CONVENTIONS.md` › "Testing — code first".)
- Keep `pnpm build` + lint + typecheck green as you go. Don't run/extend the test
  suites for new behavior until the user has approved it.
- **pnpm, not npm.** TS strict, **no `any`**. `core/` must not import React.
- **Do NOT package/publish** — the user does that manually.

## ▶ TO RESUME: a single small prompt is enough
Just say: **"Continue with NEXT_SESSION.md"** (or "do the tree-click nav task").
Read CLAUDE.md + the MILESTONES STATUS block first, then do the Task below.

## ✅ Last session (docs + cleanup; no behavior change)
- **README written** (`README.md`) — consumer usage guide (install, quickstart,
  core concepts, lazy trees, states, `location`, styling tiers, full prop table).
- **All comments stripped from `src/`** (18 files; JSDoc included, per the user) via
  the TS scanner — behavior-neutral; build/lint/typecheck green.
- Confirmed loading/error/empty/content are **already configurable** via render
  props (`renderLoading`/`renderError`(+retry)/`renderEmpty`/`renderContent`).
- Note: 3 scroll-sync/anchor jsdom tests are **pre-existing flaky** (fail on the
  clean baseline too — 136/139 pass). Not caused by the cleanup. Worth stabilising
  alongside the nav task below since they cover the same code paths.
- **Next target = the tree-click navigation task below** (user-reported; highest
  impact). Accessibility pass is the only other open M8 item, after this.

---

## Task: make tree-click navigation seamless, and the whole component predictable
**User's words:** "I select something from the tree, it should seamlessly take the
book there as the user will naturally expect. Sometimes it is not taking there. Click
on a tree node should be respected and the view should start from the clicked node.
Sometimes it goes to the node but the title beginning is gone above the view. Cache
eviction should be stable. The behaviour of the whole component should be predictable
and stable."

Three distinct problems, plus an overarching "predictable & stable" bar. **Reproduce
each in the demo first** (`pnpm dev`, port 5179) before changing anything — the
"Quickstart" (small, branch nodes) and "Styling & location" (large, async, virtualized)
examples are the fixtures.

### The click → scroll path (where to work)
1. Tree select → `BookReader.goTo(id)` (`src/BookReader.tsx` ~L106): sets location,
   `emit`, and `requestScroll(id)` (no offset → wants the node at the *top*).
2. `requestScroll` (~L99) → tokened `scrollRequest` state.
3. `ContentPane` effect (`src/content/ContentPane.tsx` ~L167) → `scrollToId(id, offset)`.
4. `useVirtualList.scrollToId` (`src/content/useVirtualList.ts` ~L229):
   ```
   const index = ids.indexOf(id);
   if (index === -1) return;                       // <-- silently does nothing
   el.scrollTop = virtualizer.offsetAt(ids, index) + offset;
   syncMetrics();
   ```

### Problem A — "sometimes it is not taking there" (strong lead)
`ids` is the **content-bearing** sequence (`ContentPane` filters out
`hasContent === false` branches). Parts/Chapters in the demo books are organisational
(`hasContent:false`), so clicking one → `ids.indexOf(id) === -1` → `scrollToId`
returns and **nothing scrolls** (the highlight moves but the view doesn't). That is
almost certainly the "sometimes not taking there."
- **Direction:** when the clicked id isn't a content node, resolve it to the nearest
  content node in reading order (its first content-bearing descendant, else the next
  content node at/after it in `fullSeq`) and scroll there. `ContentPane` already has
  `fullSeq` + the `store`; the mapping can live there or in `useVirtualList`.

### Problem B — "title beginning is gone above the view"
After `scrollToId` lands node N at the top (`scrollTop = offsetAt(N)`), content
*above* N that is still settling (overscan nodes finishing their async fetch, or
estimate→measured) changes height → anchor correction adds to `scrollTop` → **N drifts
up and its title scrolls above the fold.** The old assumption ("scroll-to lands N at
the top so there's nothing above to correct") breaks with async bodies.
- **Direction:** make a navigation *sticky*: after a `scrollRequest`, keep N's top
  pinned to the viewport top until heights settle / until the user actually scrolls
  (e.g. re-align on the next measure within a short window, or treat N as the anchor
  in the correction logic). Also sanity-check `offsetAt` accuracy when nodes above N
  are still estimated (it can land N a bit low or high).

### Problem C — "cache eviction should be stable"
On a far jump the pinned window (`pinnedIds` = viewport+overscan+prefetch, driven in
`useVirtualList` ~L239 via `cache.setPinned`) moves; the old region is eligible for
eviction. Verify: (a) the pin updates for the *new* location before content mounts
there (no loading flash on arrival); (b) scroll-back over recently-read content stays a
synchronous cache hit (pin must cover what's about to be revealed); (c) eviction
(`core/cache.ts`, LRU by `maxChars`) doesn't thrash for large books. Reproduce by
jumping around the large book and scrolling back.

### Overarching: predictable & stable
The click→navigate→settle→cache sequence should be deterministic. Watch for races
between `scrollToId`, the async fetch/measure, anchor correction, and the
controlled-`location` echo. Prefer one clear owner of "where the view is" over
several effects nudging `scrollTop`.

### Deliverable for this session
Reproduce → **code the fixes** → hand back to the user to test in the demo. **No tests
yet** — write them only after the user approves (then: jsdom for pure logic, a
Playwright `e2e/reader.spec.ts` case for the real-browser navigation/scroll behavior).

## How to run / verify
- `pnpm dev` → http://localhost:5179 (4-example switcher).
- `pnpm build` / lint / typecheck must stay green while coding.
- e2e (only when writing approved tests): `pnpm test:e2e` (reuses the dev server).

## Still open in M8 (after this)
- Accessibility pass (tree roles/aria, focus-visible rings, content aria-busy/alert).
- Stabilise the 3 flaky jsdom scroll-sync/anchor tests (same code paths as the nav task).
