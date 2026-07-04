/**
 * End-to-end for controlled `location` and remount/teardown, in a real Chromium.
 *
 *  - E7: the Styling example wires a **controlled** `location` (parent state) with
 *    `onLocationChange` echoing back. Prove the parent can drive the reader (Jump),
 *    that scrolling still moves the view + reports back (the readout follows), and
 *    that the controlled+echoed location does NOT freeze/loop the view.
 *  - E11: switching examples repeatedly remounts the reader; prove no observer leak
 *    survives (scroll + no-flicker still hold after several remounts) and the
 *    surface is never left blank.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';

const content = (page: Page): Locator => page.locator('[data-part="content"]');
const nodes = (page: Page): Locator =>
  page.locator('[data-part="content-node"]');

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

async function topNodeId(page: Page): Promise<string | undefined> {
  const m = await rectsById(page);
  for (const id of Object.keys(m)) {
    if (m[id]!.top <= 1 && m[id]!.bottom > 1) return id;
  }
  return undefined;
}

async function readout(page: Page): Promise<string> {
  return page.locator('.demo-readout code').innerText();
}

async function openExample(page: Page, name: RegExp): Promise<void> {
  await page.getByRole('tab', { name }).click();
  await expect(nodes(page).first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'book-reader demo' })).toBeVisible();
});

test.describe('controlled location drives the reader and echoes back without locking it', () => {
  test('Jump navigates; a subsequent scroll still moves the view and updates the readout', async ({
    page,
  }) => {
    await openExample(page, /Styling & location/);
    await page.waitForTimeout(400);

    // When the parent sets location via Jump, the reader scrolls to that section.
    await page.getByRole('button', { name: /Jump to/ }).click();
    await expect.poll(async () => topNodeId(page), { timeout: 5000 }).toBe(
      'l.p5.c5.s10',
    );
    const afterJump = await readout(page);
    expect(afterJump).toContain('l.p5.c5.s10');

    // The controlled+echoed location must NOT freeze the view: scrolling still
    // moves it, and onLocationChange reports the new active node back to the parent
    // (the readout changes) — proving no echo lock/loop.
    await content(page).evaluate((el) => el.scrollBy(0, 900));
    await expect
      .poll(async () => readout(page), { timeout: 5000 })
      .not.toBe(afterJump);
    // The top section is no longer the jumped-to one — the view genuinely moved.
    await expect.poll(async () => topNodeId(page)).not.toBe('l.p5.c5.s10');
  });
});

test.describe('remounting across examples leaves no leaked observers (no double-jump)', () => {
  test('after several tab switches, scroll + no-flicker still hold', async ({
    page,
  }) => {
    // The StrictMode double-ResizeObserver bug double-applied anchor correction.
    // Churn the reader through remounts, then verify the reading line stays put on
    // scroll (a leaked observer from a prior mount would double the correction).
    const tabs: RegExp[] = [
      /Quickstart/,
      /Styling & location/,
      /Object content/,
      /Render hooks/,
      /Styling & location/,
    ];
    for (const t of tabs) {
      await openExample(page, t);
      await expect(nodes(page).first()).toBeVisible();
    }
    // Let the freshly-remounted book settle fully before measuring — an unsettled
    // async body arriving mid-measure looks like a jump (measurement noise, not a
    // leaked observer, which would double *every* step by ~2×).
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
        { timeout: 10000 },
      )
      .toBe(true);

    // Fold-stability check on the freshly-remounted large book.
    const foldNode = (m: Record<string, { top: number; bottom: number }>) => {
      for (const id of Object.keys(m)) {
        if (m[id]!.top <= 0 && m[id]!.bottom > 0) return id;
      }
      return undefined;
    };
    const STEP = 80;
    let worst = 0;
    let prev = await rectsById(page);
    for (let i = 0; i < 15; i++) {
      await content(page).evaluate((el, d) => el.scrollBy(0, d), STEP);
      await page.waitForTimeout(150);
      const now = await rectsById(page);
      const anchor = foldNode(prev);
      if (anchor !== undefined && anchor in now) {
        const moved = now[anchor]!.top - prev[anchor]!.top;
        worst = Math.max(worst, Math.abs(moved - -STEP));
      }
      prev = now;
    }
    expect(worst).toBeLessThan(40);
    await expect(nodes(page).first()).toBeVisible();
  });
});
