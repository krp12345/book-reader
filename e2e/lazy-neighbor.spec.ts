/**
 * P1 — lazy **effective-neighbour** navigation (the user's core vision case),
 * against the "11 · Lazy depths" demo example in a real Chromium.
 *
 * The contract: from any reading position, scrolling up/down must land on the
 * **logical previous/next content node by tree traversal**, resolving lazy
 * branches **recursively** when the neighbour lives inside one — at any depth.
 * The fixture (`demo/data.ts` › makeAsymmetricBook) has neighbouring Parts of
 * *different* depths, so the recursion is proven depth-independent:
 *
 *   az/0  — 5 levels deep (deepest-LAST leaf: az/0/2/2/2)
 *   az/1  — 3 levels deep (leaves az/1/0..2)   ← the reading position
 *   az/2  — 4 levels deep (leftmost-deep leaf: az/2/0/0)
 *
 * [LZ-UP]  at az/1/0, the content directly ABOVE must become az/0/2/2/2 — whole
 *          subtrees insert above the viewport while the reading line stays put
 *          (the hardest anchor-correction case: placeholder→children swaps above
 *          the fold).
 * [LZ-DOWN] at az/1/2, the content directly BELOW must become az/2/0/0.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';

const content = (page: Page): Locator => page.locator('[data-part="content"]');
const nodes = (page: Page): Locator =>
  page.locator('[data-part="content-node"]');

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

/** The section straddling the viewport top (the reading line's anchor). */
function foldOf(
  m: Record<string, { top: number; bottom: number }>,
): string | undefined {
  for (const id of Object.keys(m)) {
    if (m[id]!.top <= 0 && m[id]!.bottom > 0) return id;
  }
  return undefined;
}

/** The id of the content node mounted immediately before `id` in visual order. */
async function nodeDirectlyAbove(
  page: Page,
  id: string,
): Promise<string | null> {
  return content(page).evaluate((el, target) => {
    const rows = [...el.querySelectorAll('[data-part="content-node"]')]
      .map((n) => ({
        id: n.getAttribute('data-node-id') ?? '',
        top: n.getBoundingClientRect().top,
      }))
      .sort((a, b) => a.top - b.top);
    const i = rows.findIndex((r) => r.id === target);
    return i > 0 ? rows[i - 1]!.id : null;
  }, id);
}

/** The id of the content node mounted immediately after `id` in visual order. */
async function nodeDirectlyBelow(
  page: Page,
  id: string,
): Promise<string | null> {
  return content(page).evaluate((el, target) => {
    const rows = [...el.querySelectorAll('[data-part="content-node"]')]
      .map((n) => ({
        id: n.getAttribute('data-node-id') ?? '',
        top: n.getBoundingClientRect().top,
      }))
      .sort((a, b) => a.top - b.top);
    const i = rows.findIndex((r) => r.id === target);
    return i !== -1 && i < rows.length - 1 ? rows[i + 1]!.id : null;
  }, id);
}

async function openDepths(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('tab', { name: /Lazy depths/ }).click();
  // The top placeholder self-resolves down to the first deep leaf on load.
  await expect(nodes(page).first()).toBeVisible({ timeout: 20000 });
}

test.beforeEach(async ({ page }) => {
  await openDepths(page);
});

test('[LZ-UP] scrolling up resolves the deep branch above to its deepest-LAST leaf, reading line staying put', async ({
  page,
}) => {
  test.setTimeout(90_000);

  // Start at the shallow Part's FIRST section: its DFS-previous lives inside
  // the *unresolved* 5-level Part above.
  await page.getByTestId('az-up').click();
  const anchor = page.locator('[data-node-id="az/1/0"]');
  await expect(anchor).toBeVisible({ timeout: 20000 });

  // A small user scroll up (the gesture that hands control from the navigation
  // anchor back to scroll anchoring — the previously-uncovered path). The reader
  // now sits just above az/1/0 while the deep Part recursively materialises
  // above the viewport, one placeholder→children swap at a time.
  await content(page).evaluate((el) => el.scrollBy(0, -60));
  await page.waitForTimeout(200);
  await content(page).evaluate((el) => el.scrollBy(0, -60));

  // Identity: WITHOUT further scrolling, the cascade must resolve the deep
  // Part down to its deepest-LAST leaf, mounted DIRECTLY above the anchor
  // section (one atomic read of the mounted order). This is the `prev of
  // 5.1.1 = 4.9.9.9.9` contract.
  await expect
    .poll(async () => nodeDirectlyAbove(page, 'az/1/0'), { timeout: 30000 })
    .toBe('az/0/2/2/2');

  // …and it is a real, loaded section (not a placeholder or a stuck state).
  await expect(page.locator('[data-node-id="az/0/2/2/2"]')).toHaveAttribute(
    'data-status',
    'loaded',
    { timeout: 15000 },
  );

  // Directly above means adjacent: no gap (and no lazy placeholder) between.
  const m0 = await rectsById(page);
  expect(
    Math.abs(m0['az/1/0']!.top - m0['az/0/2/2/2']!.bottom),
  ).toBeLessThan(4);

  // Meanwhile the reading line must not have jumped: az/1/0 was ~60–120px below
  // the viewport top when the swaps started and must still be in the viewport.
  expect(m0['az/1/0']!.top).toBeGreaterThan(-40);
  expect(m0['az/1/0']!.bottom).toBeLessThan(2000);

  // Now keep scrolling up through the still-resolving region. The section at
  // the fold must move only by the scroll step (less when clamped at the top):
  // a large overshoot or an upward yank = failed anchor correction across
  // above-fold subtree insertion.
  const STEP = 120;
  let worst = 0;
  let prev = await rectsById(page);
  for (let i = 0; i < 10; i++) {
    await content(page).evaluate((el, d) => el.scrollBy(0, -d), STEP);
    await page.waitForTimeout(350);
    const now = await rectsById(page);
    const fold = foldOf(prev);
    if (fold !== undefined && fold in now) {
      const moved = now[fold]!.top - prev[fold]!.top;
      if (moved > STEP + 40) worst = Math.max(worst, moved - (STEP + 40));
      if (moved < -40) worst = Math.max(worst, -moved - 40);
    }
    prev = now;
  }
  expect(worst, 'the reading line jumped while subtrees inserted above').toBe(0);
});

test('[LZ-DOWN] scrolling down resolves the next branch to its leftmost-deep leaf directly below', async ({
  page,
}) => {
  test.setTimeout(90_000);

  // Start at the shallow Part's LAST section: its DFS-next lives inside the
  // *unresolved* 4-level Part below.
  await page.getByTestId('az-down').click();
  const anchor = page.locator('[data-node-id="az/1/2"]');
  await expect(anchor).toBeVisible({ timeout: 20000 });

  // Nudge downward so the next Part's placeholder enters the window.
  await content(page).evaluate((el) => el.scrollBy(0, 200));

  // Identity: the next Part resolved recursively down its LEFTMOST chain, and
  // that specific leaf is the effective next — mounted directly below.
  await expect
    .poll(async () => nodeDirectlyBelow(page, 'az/1/2'), { timeout: 20000 })
    .toBe('az/2/0/0');

  await expect(page.locator('[data-node-id="az/2/0/0"]')).toHaveAttribute(
    'data-status',
    'loaded',
    { timeout: 15000 },
  );

  // Adjacent, with no placeholder or gap between the two Parts.
  const m = await rectsById(page);
  expect(Math.abs(m['az/2/0/0']!.top - m['az/1/2']!.bottom)).toBeLessThan(4);
});
