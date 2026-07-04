# TEST_PLAN.md — proposed test coverage to add

> **Status: EXECUTED 2026-07-02 (historical record).** The autonomous session ran
> and landed 16 new e2e (final suite: **200 unit + 42 e2e green**). Anything still
> open below was **moved to the canonical backlog: `MILESTONES.md` › "⏸ PENDING
> TESTS" (bottom of that file)** — maintain gaps THERE, not here. This file is kept
> as the record of what was planned/landed and why.
>
> Scope note (as of the 2026-07-02 start): the plan augmented the then-existing
> suite (31 unit/integration files + 3 e2e specs; now 7 e2e specs). It does **not**
> re-cover what was already green — see "Already covered" at the bottom.

---

## 7. AUTONOMOUS EXECUTION PROGRESS (live — updated as work lands)

> Session started 2026-07-02 (autonomous, user-approved). Verify gate per theme:
> build+lint+typecheck always; the touched e2e spec run per theme.
>
> **FINAL VERIFY (this session): full suite GREEN — 42 e2e passed (single worker,
> exit 0) + 200 unit passed. typecheck + lint clean.** 16 new e2e added.

- ✅ **Phase 1 scaffolding** — added `makeStatesBook` + `makeFailingFetchChildren`
  to `demo/data.ts`; new demo tab **"9 · States & errors"** in `demo/main.tsx`
  (`fetchStates` fails `st.err` first / empties `st.empty`; `statesFailingChildren`
  fails `st.lazy` once). typecheck + lint green.
- ✅ **E1–E3 `e2e/errors.spec.ts`** — 4 tests GREEN (content error→retry→loaded;
  empty state distinct from error; rapid-nav no cache poisoning; lazy child-fetch
  error placeholder → retry recovers). Note: lazy error surfaces on the **content**
  placeholder (`content-lazy-error`), not the tree row, because the scroll trigger
  resolves it first — spec asserts there.
- ❌ **E4 a11y — REMOVED at user request 2026-07-02.** User has no plan to implement
  accessibility; the a11y spec was deleted. Do not reintroduce a11y/keyboard/focus
  tests. See [[no-accessibility-work]].
- ✅ **E7+E11 `e2e/location.spec.ts`** — 2 tests GREEN (controlled location
  drive+echo doesn't lock the view; remount-across-examples teardown holds
  no-flicker → guards the StrictMode observer-leak class).
- ✅ **E12 `e2e/fuzz.spec.ts`** — 6 tests GREEN (quickstart/styling/lazy × seeds
  1,7). Fix that mattered: `test.use({ actionTimeout: 2500 })` so a non-actionable
  row click fails fast instead of hanging the whole 180s test budget.
- ✅ **E9+E10 `e2e/cache-eviction.spec.ts`** — 2 tests GREEN. Added a **"10 · Tiny
  cache"** demo tab (`largeBook` + `cache.maxChars:3000`) and folded it into the
  **fuzzer's** example list, so LRU eviction is exercised under random scroll too.
  E9 asserts evict→scroll-back→refetch stays loaded with correct text; E10 asserts
  per-slot `classNames` thread through (custom skin). Flake fixes: wait for `loaded`
  before reading text; settle-poll before fold measurement; 150ms step cadence.
- ✅ **U1 resolveToNode edge branches — DONE (landed separately, 2026-07-01):**
  `tests/core/resolveToNode.test.ts` (9 tests) covers ancestor-fetch rejection,
  target-not-found/undefined ancestry, unknown ancestor, and pre-/mid-walk abort.
- ➡️ **Everything still open moved 2026-07-04 to the canonical backlog:
  `MILESTONES.md` › "⏸ PENDING TESTS"** (bottom of that file). That includes the
  E5 / E6 / E8 / U2 / U3 items formerly listed here **plus a newly-audited 🔴 P1
  gap this plan missed**: the lazy **effective-neighbour** flows — scroll-up into
  an unresolved lazy branch must recursively resolve to its deepest-LAST leaf as
  the effective previous (and the leftmost-deep leaf as effective next going down),
  with neighbour identity asserted. The cross-branch e2e covers the eager book
  only; the lazy scroll e2e proves downward resolution without identity. Do not
  maintain the gap list here anymore.
- ✅ **That backlog was fully CLEARED 2026-07-04** (the authorized test session) —
  the `MILESTONES.md` section records where each item landed. Suites at close:
  **205 unit + 48 e2e green**. The P1 LZ-UP case caught + fixed a real
  anchor-policy bug in `useVirtualList.ts` (see the MILESTONES session entry).
- Unit baseline re-confirmed green (200) after demo changes.
- **Known pre-existing flake (NOT introduced here):** `reader.spec.ts` › "crosses
  into the previous Part's last section" times out under full-suite load; passes in
  isolation (2.4s). Timing-sensitive cross-branch scroll test on the untouched
  Styling example.

---

## 0. Intent recap (what this project is, so the tests target the right things)

`<BookReader>` is a **library**, not an app. Its hard promises are: (1) content
loads lazily (fetch → sanitize → **bounded LRU cache** → **virtualized**) with
**no flicker / stable view**; (2) tree **structure** can also load lazily
(`fetchChildren`) via two triggers (expand + scroll) plus eager first-page descent
on search/reset/deep-link; (3) scroll ⟷ tree stay in sync (active node, auto-open,
cross-branch DFS reading order); (4) everything is themeable/overridable without
breaking a11y or virtualization.

**Coverage philosophy (from CONVENTIONS.md — binding):** a *small set of essential
end-to-end / integration flows that prove the feature works **for the user***, NOT
exhaustive per-file units. The unit layer is already strong; **the missing coverage
is almost entirely real-browser e2e** — the layout/scroll/virtualization/focus
behaviour jsdom physically cannot produce. This plan is weighted accordingly.

Tests are written **BDD-style in plain Playwright/Vitest** (Given/When/Then in the
body; capability→outcome names). No Gherkin/Cucumber tooling — decided already.

---

## 1. Execution strategy (how to be fast + not break things) — for the autonomous session

Follow this order; it front-loads the shared cost and keeps risk low.

1. **Do the demo scaffolding FIRST, in one pass.** Most new e2e need a demo example
   that exhibits the behaviour (a rejecting fetch, a zero-result search, an empty
   book, a controlled-`location` parent, a custom `getNextNode`). Several tests
   share the same new example. Build all needed demo hooks up front in `demo/`
   (new tab(s) in `demo/main.tsx` + fixtures in `demo/data.ts`), verify by eye with
   `pnpm dev` mentally / `pnpm build`, then write the specs against them. Batching
   this avoids re-touching the demo per test.
2. **Reuse the existing e2e helper vocabulary** — `content`, `nodes`, `mountedIds`,
   `viewport`, `rectsById`, `topNodeId`, `readout`, `openExample`, `openTree`,
   `setFrameWidth`. Lift shared helpers into a tiny `e2e/_helpers.ts` **only if** a
   new spec needs one that already exists in another spec (DRY the duplication that's
   already there between `reader.spec.ts` and `lazy-search.spec.ts`); otherwise
   leave existing specs untouched to avoid churn.
3. **One new spec file per theme**, not per test: `e2e/errors.spec.ts`,
   `e2e/a11y.spec.ts`, `e2e/location.spec.ts`, `e2e/cache-eviction.spec.ts`. Keeps
   diffs reviewable and parallelizable by Playwright.
4. **Deterministic > timing.** Prefer `expect.poll` / web-first assertions over
   `waitForTimeout` (the existing specs lean on timeouts; don't add more than
   necessary). For rejects/aborts, make the demo fetch fail **deterministically**
   (e.g. a node id / query flagged to reject), never randomly.
5. **Verify gate per the repo rule:** after each theme, run only what's needed —
   `pnpm build` + lint + typecheck always; `pnpm test <file>` / `pnpm test:e2e
   <file>` for just the touched spec. Full-suite run once at the end. (This is the
   one context where running tests IS authorized — the user pre-approved test work
   for that session.)
6. **README + MILESTONES bookkeeping** as each theme lands (features already exist,
   so this is marking them test-covered / moving backlog items, not new docs).
7. **Stop-and-flag, don't guess:** if a proposed behaviour turns out not to exist
   (e.g. there is no retry affordance in the real error UI, or no zero-result state),
   do NOT invent product behaviour — log it in MILESTONES as "needs product
   decision" and skip that test. Autonomy covers *testing*, not designing new UX.

**Rough budget:** demo scaffolding ~30%, e2e authoring ~50%, the few unit/integration
gaps ~10%, bookkeeping ~10%.

---

## 2. E2E test cases to add (priority-ordered)

Each is written as the behaviour to assert. "Scaffold?" = new demo work required.

### 🔴 P1 — core promises with zero real-browser coverage

**E1. Failed section load shows the error state and recovers on retry**
`e2e/errors.spec.ts` · Scaffold: yes (demo example with a `fetchContent` that
rejects for a flagged node, succeeds on 2nd call).
- **Given** a section whose `fetchContent` rejects **When** it enters the viewport
  **Then** it renders `data-status="error"` with the error fallback + a retry control.
- **When** I click retry and the refetch succeeds **Then** it becomes
  `data-status="loaded"` with real body text, and no other section is stuck.
- *(Unit already covers the ContentNode lifecycle; this proves it end-to-end in the
  real virtualized surface.)*

**E2. Aborted in-flight fetch never poisons the cache (rapid navigation)**
`e2e/errors.spec.ts` · Scaffold: reuse a slow-fetch demo example.
- **Given** slow async section fetches **When** I click through several tree targets
  faster than they resolve **Then** the final target lands `loaded` with real text and
  **no** section shows the empty "No content." state (guards the cache-poisoning /
  aborted-fetch regression at the interaction level, not just the cache unit).

**E3. Lazy branch whose `fetchChildren` rejects shows an error row + retries**
`e2e/errors.spec.ts` · Scaffold: yes (a lazy branch flagged to reject once).
- **Given** a lazy branch whose child fetch rejects **When** I expand it **Then** an
  error/retry affordance appears in place of `tree-lazy-loading` (not a silent empty
  branch). **When** I retry and it succeeds **Then** the real children render.

**E4. ~~Keyboard-only tree navigation + overlay focus~~ — REMOVED 2026-07-02.**
Accessibility is out of scope; the user has no plan to implement a11y. Do not
reintroduce keyboard/focus/ARIA tests. See [[no-accessibility-work]].

### 🟡 P2 — real gaps at any layer (untested anywhere)

**E5. Zero-result search leaves a coherent state**
`e2e/lazy-search.spec.ts` (extend) · Scaffold: maybe (a query the demo maps to no
results).
- **Given** the tree **When** I submit a query with no matches **Then** the reader
  shows a defined empty-results state (empty tree / message), does **not** crash or
  silently no-op, and **reset** still restores the original book. *(If no empty
  state exists → flag as product decision, don't invent one.)*

**E6. Empty book and single-section book**
`e2e/reader.spec.ts` (extend) or new example · Scaffold: yes (empty + single-node
fixtures in `demo/data.ts`).
- **Given** a book with no sections **Then** the reader renders an empty surface
  without error (virtualizer mount-all / zero-height path).
- **Given** a one-section book **Then** it renders fully, no spurious scroll, tree
  shows the single node.

**E7. Controlled `location` + `onLocationChange` (no echo loop)**
`e2e/location.spec.ts` · Scaffold: yes (a demo parent that controls `location` with
external buttons + a change log).
- **Given** a parent-controlled `location` **When** the parent sets it **Then** the
  reader scrolls that section to the top.
- **When** the user scrolls the reader **Then** `onLocationChange` fires with the new
  active id **and** the parent echoing it back does **not** cause a scroll jump / loop
  (echo-guard).

**E8. Custom `getNextNode` / `getPrevNode` reading-order override**
`e2e/location.spec.ts` · Scaffold: yes (demo passing custom order fns).
- **Given** custom next/prev overrides **When** I scroll past a node's end **Then**
  the *overridden* neighbour loads next (not the DFS default), proving the override
  drives the real scroll sequence. *(scrollSync unit covers the pure mapping; this
  proves the wiring.)*

### 🔴 P1 (added) — randomized interaction fuzzing with invariant oracle

**E12. Seeded random click/scroll walk that never violates the reader's invariants**
`e2e/fuzz.spec.ts` · Scaffold: no (runs against existing examples, incl. the lazy
one). **This is the single highest-value addition** — every historical bug in this
repo (cache poisoning by aborted fetch, StrictMode double-observer, anchor
over-correction) was a *sequence* bug that scripted tests would not have found.

Design (not pure monkey-testing — random actions + an assertion oracle):
- **Driver:** a **seeded** PRNG picks from an action set each step, for N steps
  (default ~60), across a few seeds:
  - click a random visible tree row (incl. organisational + lazy branches);
  - expand/collapse a random branch;
  - scroll the reading surface up/down by a random amount (small + large);
  - jump-scroll to top / bottom;
  - occasionally open/close the tree overlay (collapsed layout).
- **Oracle — assert ALL after every step** (this is the point):
  1. no `content-node` shows the empty "No content." state;
  2. no node stuck `data-status="loading"`/`"error"` after its fetch settled
     (poll-with-timeout, so async loads get to finish);
  3. `0 <= scrollTop <= scrollHeight - clientHeight` (viewport stays bounded);
  4. the **fold section moved by ≤ the scroll delta** since the last scroll step
     (continuous no-flicker guard, reusing the `rectsById`/fold logic);
  5. the active tree node (`aria-selected`) corresponds to the section at the top
     of the viewport;
  6. re-scrolling back over an already-read (non-evicted) section is a synchronous
     `loaded` hit — no loading flash.
- **Reproducibility:** the seed + the exact action log are printed on failure so a
  red run is replayable deterministically. Keep a couple of **fixed seeds** checked
  in (fast, stable CI) and allow an env-var seed for longer local soak runs.
- **Flake discipline:** every oracle check is a web-first / `expect.poll` assertion
  with a timeout — never a bare timeout — so async settling isn't mistaken for a bug.
  If the oracle trips, it's a real invariant violation, not a race.

Run it on: the Quickstart (sync-ish), the Styling&location (large async), and the
Lazy&search (lazy tree + scroll/expand triggers) examples — the three that stress
different subsystems.

*Optional stretch (only if cheap):* a `fast-check`-style property runner for the
same idea at the **integration** layer (jsdom) over `useVirtualList`/scroll-sync
reducers — but the real payoff is the real-browser walk above; do that first.

### 🟢 P3 — hardening / completeness

**E9. LRU eviction then scroll-back refetches without flicker**
`e2e/cache-eviction.spec.ts` · Scaffold: yes (a book + a tiny `cache.maxChars` so
scrolling forces eviction).
- **Given** a small cache budget **When** I scroll far enough to evict early sections,
  then scroll back **Then** an evicted section refetches and the **reading line stays
  put** (anchor correction holds even across a refetch, not just a cache hit).

**E10. Styling tiers 2 & 3 threading**
`e2e/reader.spec.ts` (extend) · Scaffold: minor (reuse Styling example).
- Per-slot `classNames` (`root`/`tree`/`treeNode`/`content`/`contentNode`) appear on
  the right elements; the **bare component renders/works without the opt-in skin**
  imported.

**E11. Example switch = clean teardown (no observer leak across remounts)**
`e2e/reader.spec.ts` (extend) · Scaffold: no.
- **When** I switch tabs repeatedly and return **Then** scroll/no-flicker still holds
  (guards against a re-introduced StrictMode-style double-`ResizeObserver` leak
  surviving remounts).

---

## 3. Unit / integration test cases to add (the few genuine gaps)

The unit layer is strong; only add where a real hole exists.

**U1. `resolveToNode` / `fetchPath` deep-link resolution — edge branches** —
✅ **DONE 2026-07-01** (`tests/core/resolveToNode.test.ts`, 9 tests: rejection,
not-found/undefined ancestry, unknown ancestor, pre-/mid-walk abort).

**U2. Search integration — empty results + re-search + reset-mid-load**
`tests/BookReader.search.test.tsx` (extend): submitting a no-match query yields the
empty-results tree; searching again replaces cleanly; reset while results are still
resolving restores the original tree without a stuck state.

**U3. Controlled-`location` echo-guard (integration)**
`tests/BookReader.scrollsync.test.tsx` (extend): a controlled `location` fed back
from `onLocationChange` does not oscillate (assert the guard at the React-wiring
level, complementing the e2e).

> Deliberately **not** adding: more cache/virtualizer/traversal/scrollSync unit
> tests (already thorough), or per-render-prop unit tests (covered). Extra unit depth
> here is against the stated philosophy.

---

## 4. New demo scaffolding required (build once, up front)

Consolidated so the autonomous session does it in a single pass:

- **`demo/data.ts`:** deterministic fixtures — (a) a book with a node flagged to make
  `fetchContent` reject-then-succeed; (b) a lazy branch flagged to make
  `fetchChildren` reject-once; (c) an empty book; (d) a single-section book; (e) a
  query string that maps to zero search results.
- **`demo/main.tsx`:** new switcher tab(s) exposing — an **Errors & retry** example
  (E1–E3), a **Controlled location** example with external nav buttons + change log
  (E7) and custom `getNextNode`/`getPrevNode` (E8), and a **small-cache** example for
  eviction (E9). Reuse existing tabs where possible (empty/zero-result can be toggles
  on an existing example rather than new tabs).
- Keep every fixture **seeded/deterministic** (matches the existing faker-seeded
  approach) so structural assertions are stable run-to-run.

*Risk flag:* if wiring a demo example reveals the underlying library prop/behaviour
doesn't exist (e.g. no retry UI, no empty-results state), STOP and log it as a
product question in MILESTONES rather than inventing behaviour.

---

## 5. Definition of done (for the autonomous session)

- Demo scaffolding built; `pnpm build` + lint + typecheck green.
- New specs pass locally: `pnpm test` (unit) + `pnpm test:e2e` (Playwright), full
  suite green, no flakes on a 2nd run.
- `MILESTONES.md`: PENDING-TESTS backlog updated (items moved to done / product-
  questions logged).
- `README.md`: no feature regressions in stability wording (all already Stable).
- This file (`TEST_PLAN.md`) updated with ✅/❌ per item, or deleted if fully folded
  into MILESTONES — your call at wrap-up.

---

## 6. Already covered — DO NOT duplicate

- **Unit:** ContentNode error+retry lifecycle (`ContentNode.test.tsx`); cache LRU /
  maxNodes / pinning / in-flight dedupe / rejected-not-cached (`cache.test.ts`);
  virtualizer windowing + anchor + mount-all (`virtualizer.test.ts`); tree keyboard
  nav in jsdom (`TreePane.test.tsx`); scrollSync mapping + reading overrides
  (`scrollSync.test.ts`); lazy treeStore/flatten/useLazyChildren; object content,
  renderContentNode, expandCollapse, autoExpand, collapse modes, styling threading.
- **E2E:** the 26 existing tests (content renders / bounded virtualized scroll /
  no-flicker / scroll-back cache hit / tree-click nav incl. organisational + branch-
  content + cross-branch DFS / responsive collapse / render hooks / object content /
  spacing tokens / lazy expand+scroll triggers / search replace+reset+custom /
  deep-link fetchPath / text-selection staging + virtualization survival).

New work targets the **real-browser gaps** those leave: error/retry UX, a11y/focus,
controlled location, custom reading order, eviction-under-pressure, empty/zero
states, styling-tier threading, and teardown.
