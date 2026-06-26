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
- Public API types live in `src/types.ts` and are exported.
- Prefer `type` for unions/props, `interface` for extendable object contracts —
  be consistent within a file.

## Testing & TDD

### Philosophy: pragmatic TDD, not dogma
We use **test-driven development as the default rhythm**, with the explicit
freedom to break the rule when it stops adding value. Don't overwhelm the work
with ceremony.

**The default loop per unit of behavior:**
1. **Red** — write a failing test that states the behavior (not the
   implementation).
2. **Green** — write the simplest code that passes.
3. **Refactor** — clean up with the test as a safety net.

**When to bend the rule (allowed, and expected):**
- **Spikes/exploration:** when the right shape is unknown, prototype first, then
  backfill tests once the design settles. Don't TDD your way through discovery.
- **Hard-to-unit-test surfaces:** real DOM scroll geometry, layout measurement,
  and virtualization are awkward in jsdom. Test the **pure logic** (traversal,
  cache eviction, height-map math, anchor-correction math) thoroughly in
  isolation; cover the wiring with a few integration/RTL tests; don't chase 100%
  on browser-only behavior.
- **Trivial glue:** pure pass-through props or one-line re-exports don't each
  need a test.

**Always test (non-negotiable, these are the core's contract):**
- `traversal.ts` — depth-first next/prev order, edge cases (first/last/empty).
- `cache.ts` — LRU eviction by `maxChars`/`maxNodes`, pinning, in-flight dedup.
- `treeStore.ts` — sync load, lazy `loadChildren`, normalization.
- `virtualizer.ts` — height-map updates and anchor-correction math (pure parts).
- Reading-order + scroll-sync logic at the integration level.

### Test mechanics
- Vitest + React Testing Library + `@testing-library/user-event`.
- Tests sit next to source: `cache.ts` → `cache.test.ts`.
- Test **behavior and public contracts**, not private internals.
- Name tests as behavior statements: `evicts least-recently-used node when
  maxChars exceeded`.
- A milestone is **not done** until its "Always test" items are green.

## General code style
- Match surrounding code; keep modules small and single-purpose per the
  architecture map in `CLAUDE.md`.
- Pure logic in `core/` must not import React — keeps it unit-testable and reused.
- No dead code, no speculative abstraction beyond current milestones.
