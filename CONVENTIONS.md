# BookReader — Code Conventions

> Auto-relevant every session (linked from `CLAUDE.md`). These are binding rules
> for how code and tests are written in this repo.

## TypeScript

### The `any` rule
- **`any` is banned by default.** Strict mode is on; the lint config flags
  `no-explicit-any` as an error.
- **Reach for these first, in order**, before ever considering `any`:
  1. A concrete type / interface.
  2. **Generics** (`<T>`) — the right tool for "varies by caller" (e.g. `Node`
     payloads, `fetchContent` return shaping).
  3. `unknown` + a narrowing type guard — for genuinely dynamic input
     (e.g. unsanitized fetch results, external JSON).
  4. Union / discriminated-union types.
  5. Utility types (`Partial`, `Pick`, `Record`, conditional/mapped types).
- **`any` is permitted only as a last resort**, specifically when avoiding it
  would require type-system gymnastics that are clear over-engineering for the
  value gained. When used:
  - Scope it as narrowly as possible (a single cast, never a whole signature).
  - Add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a
    **one-line reason** on why the alternative is over-engineering.
  - Prefer `unknown` over `any` whenever the value is consumed, not just passed.

### Other TS rules
- `strict: true` (all strict flags), `noUncheckedIndexedAccess: true`.
- No non-null `!` assertions unless provably safe with a short comment.
- Public API types live in `src/types/` (split by domain, re-exported through the
  `src/types/index.ts` barrel) and are exported from `src/index.ts`.
- Prefer `type` for unions/props, `interface` for extendable object contracts —
  be consistent within a file.

## Testing — code first, tests after approval

> **We do NOT use TDD on this project (changed 2026-06-27, by the user).** Do not
> write tests before the implementation, and do not write tests for a change until
> the user has tested it in the running app and **approved** it. Writing tests up
> front here slows the loop and locks in behavior that isn't settled yet.

**The working loop per change:**
1. **Think** — understand the behavior and the failure; state the plan.
2. **Code** — implement the simplest change that makes the behavior correct and
   predictable. Keep `pnpm build` + lint + typecheck green.
3. **Hand off** — let the **user** run the app and test the behavior manually.
   Don't add tests yet.
4. **After the user approves** — *then* write tests to lock the behavior in
   (regression guard). If the user hasn't approved, don't write tests unless they
   ask.

**When tests are written (post-approval), what deserves them:**
- `traversal.ts` — depth-first next/prev order, edge cases (first/last/empty).
- `cache.ts` — LRU eviction by `maxChars`/`maxNodes`, pinning, in-flight dedup.
- `treeStore.ts` — normalized id-indexed tree (provided up front).
- `virtualizer.ts` — height-map updates and anchor-correction math (pure parts).
- Reading-order + scroll-sync logic at the integration level.
- Browser-only behavior (real scroll/layout/ResizeObserver, StrictMode) that jsdom
  can't model → a Playwright `e2e/` test, not a jsdom one.

These are the core's contract; once a behavior is approved, a regression test for it
is expected. But the test follows approval — it never gates the implementation.

### Test mechanics (for when tests are written)
- Vitest + React Testing Library + `@testing-library/user-event`.
- Tests live in the top-level `tests/` directory, mirroring `src/` by topic:
  `src/core/cache.ts` → `tests/core/cache.test.ts`.
- Test **behavior and public contracts**, not private internals.
- Name tests as behavior statements: `evicts least-recently-used node when
  maxChars exceeded`.
- A change is **shippable** when `pnpm build` + lint + typecheck are green and the
  user has approved the behavior; the regression tests land right after approval.

## README & feature stability (HARD RULE — 2026-06-28, by the user)

Documentation and stability tier track the same code-first loop as testing:

1. **The moment a milestone/feature is coded, document it in `README.md`** — do not
   defer README updates to "later." Every shipped feature must be discoverable there.
2. **A newly-coded feature is marked ⚠️ Experimental in the README** ("API may change;
   not yet test-covered"). Use the inline ⚠️ callout + the **Feature stability**
   section.
3. **A feature graduates to Stable only after its tests are written** — and test
   timing is **controlled by the user** (see the test HARD RULE: no tests written/run
   unless the user explicitly asks in that turn). When the user has had the tests
   added, drop the ⚠️ markers and move it to Stable.

So the lifecycle is: **code → document as Experimental → (user calls for tests) →
tests added → mark Stable.** Never leave shipped behavior undocumented; never mark a
feature Stable before its tests exist.

## General code style
- Match surrounding code; keep modules small and single-purpose per the
  architecture map in `CLAUDE.md`.
- Pure logic in `core/` must not import React — keeps it unit-testable and reused.
- No dead code, no speculative abstraction beyond current milestones.
