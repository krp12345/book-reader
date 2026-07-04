/**
 * Randomized interaction fuzzing with an **invariant oracle**, against the real
 * demo in a real Chromium. This is deliberately NOT a scripted flow: a *seeded*
 * PRNG drives a random walk of clicks / scrolls / expand-collapse, and after every
 * step a set of invariants that must hold *no matter the sequence* is asserted.
 *
 * Why this exists: every historically nasty bug in this reader was a **sequence**
 * bug — cache poisoning by an aborted fetch (rapid nav), the StrictMode
 * double-ResizeObserver leak (scroll during async settle), anchor over-correction
 * (scroll straddling a growing node). Scripted tests only catch the sequences we
 * think to write; this explores the ones we didn't.
 *
 * Reproducibility: the seed + the exact action log are printed on failure, so a red
 * run is replayable deterministically. Fixed seeds are checked in for stable CI; set
 * FUZZ_SEED / FUZZ_STEPS in the env for a longer local soak.
 *
 * Oracle (asserted every step):
 *  - the reading surface is never blank (≥1 content node mounted);
 *  - no section shows the empty "No content." state (these books have no empty
 *    nodes — that state here would mean a poisoned/aborted cache entry);
 *  - after settling, no mounted section is stuck `loading`/`error`;
 *  - scrollTop stays within [0, scrollHeight - clientHeight];
 *  - on every random scroll step, the section at the fold moves by no more than
 *    the scroll delta (anchor correction holds under random interleavings);
 *  - after settling, the reported reading position (the demo readout — i.e. the
 *    active/highlighted node) is actually visible in the viewport;
 *  - no uncaught page error fires during the whole walk.
 * Plus one post-walk probe (cache-backed examples only): scrolling away from a
 * read section and back is a synchronous `loaded` cache hit, never a refetch.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';

// The walk does many polling assertions; give it room so a slow settle doesn't get
// mistaken for a stuck state (which the oracle catches deliberately, with a repro).
test.setTimeout(120_000);
// Cap every action (click, etc.): a momentarily non-actionable row must fail fast
// and let the walk continue — NOT auto-wait the whole test budget. Without this a
// single covered/relaying-out row hangs the test until the suite timeout.
test.use({ actionTimeout: 2500 });

const content = (page: Page): Locator => page.locator('[data-part="content"]');
const nodes = (page: Page): Locator =>
  page.locator('[data-part="content-node"]');

/** Deterministic PRNG (mulberry32) — same seed ⇒ same walk. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EXAMPLES: { name: RegExp; label: string }[] = [
  { name: /Quickstart/, label: 'quickstart' },
  { name: /Styling & location/, label: 'styling' },
  { name: /Lazy & search/, label: 'lazy' },
  // Tiny cache: random scroll forces LRU eviction + refetch — the invariants
  // (no blank, nothing stuck, bounded scroll) must hold across evictions too.
  { name: /Tiny cache/, label: 'tiny-cache' },
];

const CHECKED_IN_SEEDS = process.env.FUZZ_SEED
  ? [Number(process.env.FUZZ_SEED)]
  : [1, 7];
const STEPS = process.env.FUZZ_STEPS ? Number(process.env.FUZZ_STEPS) : 18;

/** Each mounted node's top/bottom, relative to the scroll viewport top. */
async function rectsById(
  page: Page,
): Promise<Record<string, { top: number; bottom: number }>> {
  return content(page).evaluate((el) => {
    const base = el.getBoundingClientRect().top;
    const out: Record<string, { top: number; bottom: number }> = {};
    el.querySelectorAll('[data-part="content-node"]').forEach((n) => {
      const id = n.getAttribute('data-node-id') ?? '';
      const r = (n as HTMLElement).getBoundingClientRect();
      out[id] = { top: r.top - base, bottom: r.bottom - base };
    });
    return out;
  });
}

/** The section straddling the viewport's top edge (the reading line). */
function foldOf(
  m: Record<string, { top: number; bottom: number }>,
): string | undefined {
  for (const id of Object.keys(m)) {
    if (m[id]!.top <= 0 && m[id]!.bottom > 0) return id;
  }
  return undefined;
}

/** One random action. Returns a short label for the action log. */
async function step(
  page: Page,
  rnd: () => number,
  log: string[],
): Promise<string> {
  const surface = content(page);
  const roll = rnd();

  // 40%: scroll the reading surface by a random signed amount. Oracle: the
  // section at the fold must move by no more than the scroll delta (+slack for
  // sub-pixel/settle noise) — a bigger move means anchor correction failed
  // (double-applied, or a placeholder→children swap above the fold went
  // uncompensated).
  if (roll < 0.4) {
    const delta = Math.round((rnd() * 2 - 1) * 500);
    const before = await rectsById(page);
    await surface.evaluate((el, d) => el.scrollBy(0, d), delta);
    await page.waitForTimeout(300);
    const after = await rectsById(page);
    const fold = foldOf(before);
    if (fold !== undefined && fold in after) {
      const moved = after[fold]!.top - before[fold]!.top;
      expect(
        Math.abs(moved),
        `fold section ${fold} moved ${moved.toFixed(1)}px on scrollBy(${delta}) — ` +
          `an anchor-correction jump. walk so far:\n  ${log.join('\n  ')}\n  #now: scrollBy(${delta})`,
      ).toBeLessThanOrEqual(Math.abs(delta) + 40);
    }
    return `scrollBy(${delta})`;
  }
  // 15%: jump to top or bottom.
  if (roll < 0.55) {
    const toBottom = rnd() < 0.5;
    await surface.evaluate(
      (el, b) => el.scrollTo(0, b ? el.scrollHeight : 0),
      toBottom,
    );
    return `scrollTo(${toBottom ? 'bottom' : 'top'})`;
  }
  // 10%: if a collapsed-tree toggle is present, toggle the overlay.
  if (roll < 0.65) {
    const toggle = page.locator('[data-part="tree-toggle"]');
    if ((await toggle.count()) > 0) {
      await toggle.first().click().catch(() => {});
      return 'toggle-tree';
    }
  }
  // Remainder: act on a currently-visible tree row — click it (navigate) or its
  // caret (expand/collapse). Works whether the tree is inline or in the overlay.
  const rows = page.locator('[data-part="tree-node"]:visible');
  const n = await rows.count();
  if (n === 0) return 'noop(no-rows)';
  const idx = Math.floor(rnd() * n);
  const rowRef = rows.nth(idx);
  const caret = rowRef.locator('[data-part="tree-node-caret"]');
  if (rnd() < 0.5 && (await caret.count()) > 0) {
    await caret.first().click().catch(() => {});
    return `caret(row ${idx})`;
  }
  await rowRef.click().catch(() => {});
  return `clickRow(${idx})`;
}

/**
 * Assert every invariant. Throws (fails the test) on the first violation.
 *
 * The core check is a *settle* poll: after any action the surface may transition
 * (a tree-overlay open, a search tree-replace) and briefly have no mounted /
 * still-loading nodes — that's valid. We poll until it recovers to a steady state
 * (≥1 node, none stuck `loading`/`error`). If it never recovers, THAT is the bug,
 * and the poll fails with the full action log as a deterministic repro.
 */
async function checkInvariants(page: Page, log: string[]): Promise<void> {
  const ctx = `seed-walk so far:\n  ${log.join('\n  ')}`;

  // 1+2. The surface settles to a steady state: non-blank and nothing stuck
  // loading/error (async bodies get up to the timeout to land).
  await expect
    .poll(
      async () =>
        nodes(page).evaluateAll(
          (els) =>
            els.length > 0 &&
            els.every((el) => {
              const s = el.getAttribute('data-status');
              return s === 'loaded' || s === 'empty';
            }),
        ),
      { timeout: 10000, message: `surface never settled. ${ctx}` },
    )
    .toBe(true);

  // 3. No poisoned/aborted empty state (these books stage no empty nodes, so a
  // "No content." here means an aborted fetch's '' got cached).
  await expect(page.getByText('No content.'), ctx).toHaveCount(0);

  // 3b. The reported reading position tracks the viewport: the active node the
  // reader last emitted (the demo readout) — or, when it is an organisational
  // branch from a tree click, one of its descendants — is actually visible.
  // A readout pointing at something far from the viewport is the class of bug
  // the P1 lazy-neighbour case exposed (stale active across lazy resolution).
  await expect
    .poll(
      async () => {
        const text = await page.locator('.demo-readout code').innerText();
        const id = /^(.+?)(?: \(|$)/.exec(text.trim())?.[1];
        if (id === undefined || id === '—') return true; // nothing reported yet
        return content(page).evaluate(
          (el, active) => {
            const vh = el.clientHeight;
            const base = el.getBoundingClientRect().top;
            return [...el.querySelectorAll('[data-part="content-node"]')].some(
              (n) => {
                const nid = n.getAttribute('data-node-id') ?? '';
                if (
                  nid !== active &&
                  !nid.startsWith(`${active}.`) &&
                  !nid.startsWith(`${active}/`)
                )
                  return false;
                const r = n.getBoundingClientRect();
                return r.bottom - base > 0 && r.top - base < vh;
              },
            );
          },
          id,
        );
      },
      {
        timeout: 10000,
        message: `active node not visible in the viewport. ${ctx}`,
      },
    )
    .toBe(true);

  // 4. scrollTop bounded (allow 2px slack for sub-pixel rounding).
  const bounded = await content(page).evaluate((el) => {
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    return el.scrollTop >= -2 && el.scrollTop <= max + 2;
  });
  expect(bounded, `scrollTop out of bounds. ${ctx}`).toBe(true);
}

for (const example of EXAMPLES) {
  for (const seed of CHECKED_IN_SEEDS) {
    test(`random walk holds all invariants — ${example.label} · seed ${seed}`, async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));

      await page.goto('/');
      await page.getByRole('tab', { name: example.name }).click();
      await expect(nodes(page).first()).toBeVisible();

      const rnd = mulberry32(seed);
      const log: string[] = [];
      await checkInvariants(page, log); // baseline

      for (let i = 0; i < STEPS; i++) {
        const action = await step(page, rnd, log);
        log.push(`#${i}: ${action}`);
        await checkInvariants(page, log);
      }

      // Post-walk probe — re-scrolling over a read section is a synchronous
      // cache hit (`loaded` on remount, no refetch flash). Skipped for the
      // tiny-cache example, where eviction + refetch is the *expected* path.
      if (example.label !== 'tiny-cache') {
        const surface = content(page);
        const t0 = await surface.evaluate((el) => el.scrollTop);
        const m = await rectsById(page);
        const target = foldOf(m) ?? Object.keys(m)[0];
        if (target !== undefined) {
          await surface.evaluate((el) => el.scrollBy(0, 2500));
          await page.waitForTimeout(700);
          await surface.evaluate((el, top) => el.scrollTo(0, top), t0);
          const node = page.locator(`[data-node-id="${target}"]`);
          await expect(
            node,
            `section ${target} did not come back after scroll-away. walk:\n  ${log.join('\n  ')}`,
          ).toBeVisible({ timeout: 3000 });
          expect(
            await node.getAttribute('data-status'),
            `section ${target} remounted un-loaded (cache miss on scroll-back). walk:\n  ${log.join('\n  ')}`,
          ).toBe('loaded');
        }
      }

      // 5. No uncaught exception fired anywhere during the walk.
      expect(
        pageErrors,
        `page errors during walk:\n  ${log.join('\n  ')}`,
      ).toEqual([]);
    });
  }
}
