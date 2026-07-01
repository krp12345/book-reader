/**
 * End-to-end for the M10 lazy-tree + tree-search features, against the real demo
 * (example "3 · Lazy & search") in a real Chromium — the trigger paths depend on
 * layout/scroll/virtualization that jsdom can't produce, so they can only be
 * trusted here.
 *
 * Note: in the demo this example renders next to a fetch-inspector sidecar, so the
 * reader is narrow enough that the tree is **collapsed** into the floated overlay.
 * Tree + search interactions therefore go through the "Contents" toggle — the same
 * wired tree, just floated. Search/scroll outcomes are asserted on the reading
 * surface (mounted section ids) + the demo's reading-position readout rather than
 * the fetch counters (which are capped/noisy under StrictMode).
 *
 * Covered:
 *  - expand-trigger: opening a lazy branch fetches + shows its children, and a
 *    re-expand is served from cache (no loading row, no refetch);
 *  - scroll-trigger: scrolling the reading surface resolves lazy branches all the
 *    way down to real leaf sections whose bodies load;
 *  - search: submitting replaces the whole tree and the reader descends (through
 *    lazy result branches) to the first real section;
 *  - reset: restores the original book;
 *  - custom renderSearch drives the same replacement.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';

const content = (page: Page): Locator => page.locator('[data-part="content"]');
const nodes = (page: Page): Locator =>
  page.locator('[data-part="content-node"]');
const overlay = (page: Page): Locator =>
  page.locator('[data-part="tree-overlay"]');
const row = (scope: Locator | Page, text: RegExp): Locator =>
  scope.locator('[data-part="tree-node"]', { hasText: text }).first();
const caret = (r: Locator): Locator =>
  r.locator('[data-part="tree-node-caret"]');

/** The demo's reading-position readout (the active node id). */
async function readout(page: Page): Promise<string> {
  return page.locator('.demo-readout code').innerText();
}

async function openLazy(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('tab', { name: /Lazy & search/ }).click();
  await expect(nodes(page).first()).toBeVisible();
}

/** Open the floated tree overlay (the tree is collapsed in this example). */
async function openTree(page: Page): Promise<Locator> {
  await page.locator('[data-part="tree-toggle"]').click();
  const ov = overlay(page);
  await expect(ov).toBeVisible();
  return ov;
}

test.beforeEach(async ({ page }) => {
  await openLazy(page);
});

test.describe('lazy tree — expand trigger', () => {
  test('opening a lazy branch shows its children; re-expand is cached (no refetch)', async ({
    page,
  }) => {
    const ov = await openTree(page);

    // Reveal the Parts (the root starts collapsed — its own content is active).
    await caret(row(ov, /Lazy Atlas/)).click();
    const part4 = row(ov, /Part 4\./);
    await expect(part4).toBeVisible();

    // Opening the branch fetches + renders its chapters.
    await caret(part4).click();
    await expect(row(ov, /Chapter 1\./)).toBeVisible({ timeout: 6000 });

    // Collapse, then re-expand: the chapters come straight back with no loading
    // row — proof the resolved children were cached, not refetched.
    await caret(part4).click(); // collapse
    await expect(row(ov, /Chapter 1\./)).toHaveCount(0);
    await caret(part4).click(); // re-expand
    await expect(row(ov, /Chapter 1\./)).toBeVisible();
    await expect(ov.locator('[data-part="tree-lazy-loading"]')).toHaveCount(0);
  });
});

test.describe('lazy tree — scroll trigger', () => {
  test('scrolling resolves lazy branches down to real leaf sections that load', async ({
    page,
  }) => {
    // Drive the reading surface downward in small steps; lazy parts → chapters →
    // sections resolve as their placeholders enter the window.
    for (let i = 0; i < 14; i++) {
      await content(page).evaluate((el) => el.scrollBy(0, 300));
      await page.waitForTimeout(300);
    }

    // A deep *leaf* section (id "lz/p/c/s" — three slashes) is mounted and loaded,
    // which is only reachable if scrolling resolved the intervening lazy branches.
    await expect
      .poll(
        async () =>
          nodes(page).evaluateAll((els) =>
            els.some(
              (el) =>
                /^lz(\/\d+){3}$/.test(el.getAttribute('data-node-id') ?? '') &&
                el.getAttribute('data-status') === 'loaded',
            ),
          ),
        { timeout: 10000 },
      )
      .toBe(true);
  });
});

test.describe('tree search — replace + descend + reset', () => {
  test('submitting replaces the tree and lands on the first real section', async ({
    page,
  }) => {
    await openTree(page);
    const input = page.locator('[data-part="tree-search-input"]');
    await input.fill('atlas');
    await input.press('Enter');

    // The reader descended through the (lazy) result branches to the first real
    // section — its id lives under the "q/…" results root (proof of replacement +
    // recursive first-page descent). The overlay auto-dismisses on landing.
    await expect.poll(async () => readout(page), { timeout: 10000 }).toMatch(/^q\//);
    await expect(nodes(page).first()).toBeVisible();
  });

  test('reset restores the original book and its first page', async ({ page }) => {
    await openTree(page);
    await page.locator('[data-part="tree-search-input"]').fill('atlas');
    await page.locator('[data-part="tree-search-input"]').press('Enter');
    await expect.poll(async () => readout(page), { timeout: 10000 }).toMatch(/^q\//);

    // Reopen the tree and reset — the original "lz" book comes back.
    await openTree(page);
    await page.locator('[data-part="tree-search-reset"]').click();
    await expect.poll(async () => readout(page), { timeout: 10000 }).toMatch(/^lz/);
  });
});

test.describe('tree search — custom renderSearch', () => {
  test('the custom box replaces the default and drives the same replacement', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Custom renderSearch/ }).click();
    await openTree(page);

    // The default box is gone; the bespoke one drives the replacement.
    await expect(page.locator('[data-part="tree-search-input"]')).toHaveCount(0);
    const custom = page.locator('.cs-search-input');
    await expect(custom).toBeVisible();

    await custom.fill('north');
    await custom.press('Enter');

    await expect.poll(async () => readout(page), { timeout: 10000 }).toMatch(/^q\//);
  });
});
