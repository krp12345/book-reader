/**
 * Edge-case books, against the "12 · Edge cases" demo example in a real
 * Chromium:
 *
 *  - [E6] an **empty** book and a **single-section** book render without error
 *    (the virtualizer's mount-all / zero-height paths; no spurious scroll) —
 *    the empty book showing the M11 book-level "no data" state, with the
 *    consumer `renderNoData` override replacing the default template;
 *  - [E8] custom `getNextNode`/`getPrevNode` drive the **real** scroll
 *    sequence: the "abridged" order reads only the even chapters, so odd
 *    chapters exist in the tree but never enter the reading surface.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';

const content = (page: Page): Locator => page.locator('[data-part="content"]');
const nodes = (page: Page): Locator =>
  page.locator('[data-part="content-node"]');
const noData = (page: Page): Locator =>
  page.locator('[data-part="content-nodata"]');

async function openEdge(
  page: Page,
  mode: 'Empty book' | 'Single section' | 'Custom order',
): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('tab', { name: /Edge cases/ }).click();
  await page.getByRole('button', { name: mode }).click();
  return errors;
}

test('[E6] the empty book renders the book-level no-data state; renderNoData overrides it', async ({
  page,
}) => {
  const errors = await openEdge(page, 'Empty book');

  // The default built-in template shows; no content nodes, no scroll.
  await expect(noData(page)).toBeVisible();
  await expect(noData(page)).toHaveText(/Nothing to show here\./);
  await expect(nodes(page)).toHaveCount(0);
  expect(
    await content(page).evaluate((el) => el.scrollTop),
  ).toBe(0);

  // The consumer override replaces the default template entirely.
  await page.getByRole('button', { name: 'Custom renderNoData' }).click();
  await expect(page.locator('.edge-empty')).toBeVisible();
  await expect(noData(page)).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('[E6] a single-section book renders its one section (mount-all path, no spurious scroll)', async ({
  page,
}) => {
  const errors = await openEdge(page, 'Single section');

  await expect(nodes(page)).toHaveCount(1);
  const only = nodes(page).first();
  await expect(only).toHaveAttribute('data-node-id', 'one.s0');
  await expect(only).toHaveAttribute('data-status', 'loaded');
  await expect(noData(page)).toHaveCount(0);
  expect(await content(page).evaluate((el) => el.scrollTop)).toBe(0);

  expect(errors).toEqual([]);
});

test('[E8] custom getNextNode/getPrevNode drive the real scroll sequence (abridged order)', async ({
  page,
}) => {
  const errors = await openEdge(page, 'Custom order');

  // The reading surface starts on the first even chapter.
  await expect(nodes(page).first()).toBeVisible();
  await expect(nodes(page).first()).toHaveAttribute('data-node-id', 'o.c0');

  // Scroll the whole flow. The mounted sequence is exactly the even chapters,
  // in override order — the odd chapters never enter the reading surface.
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) {
    for (const id of await nodes(page).evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-node-id') ?? ''),
    )) {
      seen.add(id);
    }
    await content(page).evaluate((el) => el.scrollBy(0, 400));
    await page.waitForTimeout(150);
  }
  await expect
    .poll(async () =>
      nodes(page).evaluateAll((els) =>
        els.some((el) => el.getAttribute('data-node-id') === 'o.c4'),
      ),
    )
    .toBe(true);
  for (const id of await nodes(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-node-id') ?? ''),
  )) {
    seen.add(id);
  }

  expect([...seen].sort()).toEqual(['o.c0', 'o.c2', 'o.c4']);

  // …and scrolling back up walks the same abridged order in reverse.
  await content(page).evaluate((el) => el.scrollTo(0, 0));
  await expect
    .poll(async () =>
      nodes(page).evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-node-id') ?? ''),
      ),
    )
    .toContain('o.c0');
  await expect(page.locator('[data-node-id="o.c1"]')).toHaveCount(0);
  await expect(page.locator('[data-node-id="o.c3"]')).toHaveCount(0);

  expect(errors).toEqual([]);
});
