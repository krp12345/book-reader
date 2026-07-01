/**
 * End-to-end for the text-selection / staging demo (example "8 · Text selection")
 * in a real Chromium. The whole point of the feature is a `renderContentNode`
 * that lets the user select + stage text onto a decoupled channel, and that
 * staged highlights **survive virtualization** (the section's DOM is destroyed on
 * scroll-out and its <mark> re-painted from a stored character range on
 * scroll-back). None of that can be exercised in jsdom (no layout/virtualization,
 * no native selection), so it lives here.
 *
 * Selections are created programmatically (a DOM Range + a dispatched
 * `contextmenu`) so they're deterministic — but everything downstream (the menu,
 * staging, the persistent <mark>, the out-of-reader "show all" channel) is the
 * real demo, unmocked.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';

// A tall viewport + scrolling the reader to the top (below) keeps the fixed
// right-click menu on-screen: the demo page stacks a lot above the reader, so a
// selection low in a short viewport would open the menu below the fold.
test.use({ viewport: { width: 1280, height: 1200 } });

const content = (page: Page): Locator => page.locator('[data-part="content"]');
const menu = (page: Page): Locator => page.locator('.sel-menu');
const marks = (page: Page): Locator => page.locator('mark[data-sel-highlight]');

interface Staged {
  text: string;
  nodeId: string;
}

/**
 * Select ~15 chars in the first loaded, *selectable* section and fire a
 * right-click over it. Returns the selected text + the owning node id, or null.
 */
async function selectInFirstSelectable(page: Page): Promise<Staged | null> {
  // A selectable section is often mounted *below the fold* (virtualization
  // overscan), so scroll it to the middle of the viewport first — otherwise the
  // fixed menu, placed at the selection's viewport coords, opens off-screen.
  const target = page
    .locator('article.sel-node:not(.sel-node--locked)[data-status="loaded"]')
    .first();
  await target.waitFor();
  const nodeId = await target.getAttribute('data-node-id');
  await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);

  return page.evaluate((id) => {
    const sec = document.querySelector(`article.sel-node[data-node-id="${id}"]`);
    const body = sec?.querySelector('.sel-body');
    if (!body) return null;
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let tn = walker.nextNode() as Text | null;
    while (tn && tn.data.trim().length < 20) tn = walker.nextNode() as Text | null;
    if (!tn) return null;

    const s = tn.data.search(/\S/);
    const e = Math.min(tn.data.length, s + 15);
    const range = document.createRange();
    range.setStart(tn, s);
    range.setEnd(tn, e);
    const sel = window.getSelection();
    if (!sel) return null;
    sel.removeAllRanges();
    sel.addRange(range);

    const rect = range.getBoundingClientRect();
    tn.parentElement?.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: Math.round(rect.x + 2),
        clientY: Math.round(rect.y + 2),
      }),
    );
    return { text: sel.toString(), nodeId: id ?? '' };
  }, nodeId);
}

async function openSelection(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('tab', { name: /Text selection/ }).click();
  // Wait until at least one selectable section has finished loading.
  await expect(
    page
      .locator('article.sel-node:not(.sel-node--locked)[data-status="loaded"]')
      .first(),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await openSelection(page);
});

test('staging a selection paints a persistent highlight and lists a chip', async ({
  page,
}) => {
  const staged = await selectInFirstSelectable(page);
  expect(staged).not.toBeNull();

  // The right-click menu offers Stage / Deselect for a fresh selection.
  await expect(menu(page)).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Stage/ })).toBeVisible();
  await page.getByRole('menuitem', { name: /Stage/ }).click();

  // The section now carries a yellow <mark> with exactly the selected text…
  const mark = page.locator(
    `[data-node-id="${staged!.nodeId}"] mark[data-sel-highlight]`,
  );
  await expect(mark).toBeVisible();
  expect((await mark.innerText()).trim()).toBe(staged!.text.trim());

  // …and the outside staged list (no reference to the reader) shows a chip.
  await expect(page.locator('.sel-chip')).toHaveCount(1);
});

test('a staged highlight survives scrolling out of view and back (virtualization)', async ({
  page,
}) => {
  const staged = await selectInFirstSelectable(page);
  expect(staged).not.toBeNull();
  await page.getByRole('menuitem', { name: /Stage/ }).click();
  await expect(marks(page)).toHaveCount(1);

  // Scroll the section far out of view so virtualization unmounts its DOM…
  await content(page).evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForTimeout(400);
  await expect(
    page.locator(`[data-node-id="${staged!.nodeId}"]`),
  ).toHaveCount(0); // proven unmounted

  // …then scroll back to the top: the mark is re-painted from the stored range.
  await content(page).evaluate((el) => el.scrollTo(0, 0));
  const mark = page.locator(
    `[data-node-id="${staged!.nodeId}"] mark[data-sel-highlight]`,
  );
  await expect(mark).toBeVisible();
  expect((await mark.innerText()).trim()).toBe(staged!.text.trim());
});

test('right-clicking a staged highlight offers Unstage, which removes it live', async ({
  page,
}) => {
  const staged = await selectInFirstSelectable(page);
  await page.getByRole('menuitem', { name: /Stage/ }).click();
  const mark = page.locator(
    `[data-node-id="${staged!.nodeId}"] mark[data-sel-highlight]`,
  );
  await expect(mark).toBeVisible();

  // Right-click the highlight itself → the menu offers Unstage only.
  await mark.dispatchEvent('contextmenu');
  await expect(menu(page)).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Unstage/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Stage$/ })).toHaveCount(0);

  await page.getByRole('menuitem', { name: /Unstage/ }).click();

  // The highlight and its chip disappear live.
  await expect(marks(page)).toHaveCount(0);
  await expect(page.locator('.sel-chip')).toHaveCount(0);
});

test('Deselect on a fresh selection stages nothing', async ({ page }) => {
  await selectInFirstSelectable(page);
  await expect(menu(page)).toBeVisible();

  await page.getByRole('menuitem', { name: /Deselect/ }).click();

  await expect(menu(page)).toHaveCount(0);
  await expect(marks(page)).toHaveCount(0);
  await expect(page.locator('.sel-chip')).toHaveCount(0);
});

test('the outside "show all staged" button dumps text + node id + meta', async ({
  page,
}) => {
  const staged = await selectInFirstSelectable(page);
  await page.getByRole('menuitem', { name: /Stage/ }).click();
  await expect(page.locator('.sel-chip')).toHaveCount(1);

  // The reveal button lives *outside* <BookReader> — it reads the decoupled bus.
  await page.locator('.sel-reveal-btn').click();

  const proof = page.locator('.sel-proof');
  await expect(proof).toBeVisible();
  await expect(proof).toContainText(staged!.text.trim());
  // The node id + meta.category came across the boundary with the text.
  await expect(proof.locator('code', { hasText: staged!.nodeId })).toBeVisible();
});

test('a locked (user-select:none) section yields no menu on right-click', async ({
  page,
}) => {
  const locked = page.locator('article.sel-node--locked').first();
  await expect(locked).toBeVisible();
  await expect(locked).toContainText('not selectable');

  await locked.dispatchEvent('contextmenu');

  // No handler is wired on locked sections, so no menu opens.
  await expect(menu(page)).toHaveCount(0);
});
