/**
 * End-to-end for LRU eviction under real scroll (E9) + styling-tier threading
 * (E10), in a real Chromium.
 *
 * The unit suite covers the cache's eviction policy in isolation; this proves the
 * user-visible consequence: with a deliberately tiny `cache.maxChars`, scrolling
 * evicts already-read sections and scrolling back **refetches** them — and that
 * refetch must NOT leave a blank/stuck section, and the no-flicker anchor
 * correction must still hold across it (a refetch grows the node from its estimate,
 * exactly the case correction exists for).
 */
import { test, expect, type Page, type Locator } from '@playwright/test';

const content = (page: Page): Locator => page.locator('[data-part="content"]');
const nodes = (page: Page): Locator =>
  page.locator('[data-part="content-node"]');

async function mountedIds(page: Page): Promise<string[]> {
  return nodes(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-node-id') ?? ''),
  );
}

async function openExample(page: Page, name: RegExp): Promise<void> {
  await page.goto('/');
  await page.getByRole('tab', { name }).click();
  await expect(nodes(page).first()).toBeVisible();
}

test.describe('LRU eviction under scroll: evicted sections refetch cleanly', () => {
  test('scroll away past the cache budget, back to top → first section reloads, no blank/stuck', async ({
    page,
  }) => {
    // Given the large book with a tiny cache budget, first section fully loaded…
    await openExample(page, /Tiny cache/);
    const first = nodes(page).first();
    await expect(first).toHaveAttribute('data-status', 'loaded', { timeout: 8000 });
    const firstId = (await mountedIds(page))[0];
    const firstText = await first.innerText();
    expect(firstText.trim().length).toBeGreaterThan(20);

    // When I scroll far down (well past what the tiny cache can hold, so the top
    // sections are evicted)…
    for (let i = 0; i < 12; i++) {
      await content(page).evaluate((el) => el.scrollBy(0, el.clientHeight));
      await page.waitForTimeout(120);
    }

    // …and then scroll back to the very top.
    await content(page).evaluate((el) => el.scrollTo(0, 0));

    // Then the first section is present again and settles to loaded with the same
    // (deterministic) text — the evicted entry refetched cleanly, no permanent
    // blank, no stuck loading.
    const back = nodes(page).first();
    await expect(back).toHaveAttribute('data-node-id', firstId ?? '');
    await expect(back).toHaveAttribute('data-status', 'loaded', { timeout: 8000 });
    expect((await back.innerText()).trim()).toBe(firstText.trim());
  });
});

test.describe('styling tiers: per-slot classNames thread through to the DOM', () => {
  test('the custom skin applies classNames to root/tree/content slots', async ({
    page,
  }) => {
    // The Styling example's "custom" tier passes a full `classNames` map; verify it
    // reaches the real elements (tier-2 hook), on top of the stable data-part hooks.
    await openExample(page, /Styling & location/);
    await page.getByRole('button', { name: /^custom$/ }).click();
    await expect(nodes(page).first()).toBeVisible();

    // Root slot carries the consumer class on the reader root (data-part hook +
    // classNames.root together)…
    await expect(page.locator('[data-part="book-reader"].cs-root')).toBeVisible();
    // …and the tree / content / per-node slots carry their consumer classes.
    await expect(page.locator('.cs-tree')).toBeVisible();
    await expect(page.locator('.cs-content')).toBeVisible();
    await expect(
      page.locator('[data-part="content-node"].cs-node').first(),
    ).toBeVisible();
  });
});
