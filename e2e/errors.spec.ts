/**
 * End-to-end for the **failure + recovery** paths, against the real demo (example
 * "9 · States & errors") in a real Chromium. These are the payoff of the
 * refcounted, signal-owning `cache.load` (aborted fetches never poison the cache)
 * and the error/retry affordances for both content and lazy-tree loading — none of
 * which the happy-path specs exercise.
 *
 * BDD style: each test body reads Given / When / Then. Deterministic staging: the
 * States book flags specific node ids to fail-then-recover (`st.err`), resolve
 * empty (`st.empty`), or fail their child fetch once (`st.lazy`), so nothing here
 * depends on timing luck.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';

const nodes = (page: Page): Locator =>
  page.locator('[data-part="content-node"]');
const node = (page: Page, id: string): Locator =>
  page.locator(`[data-part="content-node"][data-node-id="${id}"]`);
const treeRow = (page: Page, text: RegExp): Locator =>
  page.locator('[data-part="tree-node"]', { hasText: text }).first();

async function openStates(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('tab', { name: /States & errors/ }).click();
  await expect(nodes(page).first()).toBeVisible();
}

test.describe('a failed section load shows the error state and recovers on retry', () => {
  test('error state → Retry → loaded with real body text', async ({ page }) => {
    // Given the first section's fetchContent rejects on the first attempt…
    await openStates(page);
    const err = node(page, 'st.err');

    // Then it settles into the error state with a Retry control (not stuck loading,
    // not a silent blank).
    await expect(err).toHaveAttribute('data-status', 'error');
    await expect(err.locator('[data-part="content-error"]')).toBeVisible();
    const retry = err.locator('[data-part="content-retry"]');
    await expect(retry).toBeVisible();

    // When I click Retry (the 2nd attempt succeeds)…
    await retry.click();

    // Then the same section becomes loaded with real prose — the retry re-ran the
    // fetch and the cache accepted the good result.
    await expect(err).toHaveAttribute('data-status', 'loaded');
    expect((await err.innerText()).trim().length).toBeGreaterThan(20);
  });

  test('a section that resolves empty renders the empty state (not an error)', async ({
    page,
  }) => {
    // Given a section whose fetch resolves to blank content…
    await openStates(page);
    const empty = node(page, 'st.empty');

    // It may be just below the fold in the small viewport — bring it in.
    await empty.scrollIntoViewIfNeeded();

    // Then it renders the empty state, distinct from an error.
    await expect(empty).toHaveAttribute('data-status', 'empty');
    await expect(empty.locator('[data-part="content-error"]')).toHaveCount(0);
  });
});

test.describe('rapid navigation never poisons the cache (aborted fetches)', () => {
  test('clicking through several sections fast leaves none stuck empty/loading', async ({
    page,
  }) => {
    // The regression: an aborted in-flight fetch used to resolve to '' and get
    // cached, so a section showed the empty state forever. Drive rapid nav (each
    // click aborts the previous fetch) and prove the surface still settles clean.
    await page.goto('/');
    await page.getByRole('tab', { name: /Styling & location/ }).click();
    await expect(nodes(page).first()).toBeVisible();

    // Given the large async book with the root expanded…
    await treeRow(page, /./)
      .locator('[data-part="tree-node-caret"]')
      .first()
      .click();

    // When I click several Parts in quick succession (no waiting between)…
    for (const re of [/Part 1\./, /Part 4\./, /Part 2\./, /Part 3\./]) {
      await treeRow(page, re).click();
    }

    // Then the surface settles: nothing stuck loading, and no section shows the
    // "No content." empty state that the poisoning bug produced.
    await expect(nodes(page).first()).toBeVisible();
    await expect
      .poll(
        async () =>
          nodes(page).evaluateAll((els) =>
            els.every((el) => el.getAttribute('data-status') !== 'loading'),
          ),
        { timeout: 10000 },
      )
      .toBe(true);
    await expect(page.getByText('No content.')).toHaveCount(0);
  });
});

test.describe('a lazy branch whose children fail shows an error placeholder and retries', () => {
  test('scroll resolves the lazy branch → child fetch fails → Retry recovers it', async ({
    page,
  }) => {
    // The reading surface renders a placeholder for the lazy branch and self-resolves
    // it; its fetchChildren rejects on the first attempt. (Driving this through the
    // content surface is deterministic — the top-of-window placeholder resolves on
    // its own, unlike a tree expand which races the scroll trigger.)
    await openStates(page);
    const surface = page.locator('[data-part="content"]');

    // Given the lazy branch's child fetch has rejected once…
    // Then the surface shows a lazy error placeholder with a Retry control.
    const lazyError = page.locator('[data-part="content-lazy-error"]');
    await expect(lazyError).toBeVisible({ timeout: 8000 });
    const retry = page.locator('[data-part="content-lazy-retry"]');
    await expect(retry).toBeVisible();

    // When I click Retry (the 2nd attempt succeeds)…
    await retry.click();

    // Then the recovered child sections resolve into the reading surface and the
    // error placeholder is gone. (Scroll down to bring the freshly-added children
    // into the window.)
    await surface.evaluate((el) => el.scrollBy(0, 400));
    await expect(node(page, 'st.lazy/0')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-part="content-lazy-error"]')).toHaveCount(0);
  });
});
