/**
 * End-to-end tests for the core reading loop, run against the **real** Vite demo
 * in a **real** Chromium — nothing is stubbed or mocked. These cover the things
 * jsdom physically cannot: real layout, a bounded scroll viewport, live
 * `scroll`/`ResizeObserver` events, and virtualization windowing.
 *
 * They guard behaviours that broke (or couldn't be verified) before:
 *  1. content actually renders — no spurious "No content." (the cache-poisoning
 *     bug where an aborted fetch's empty body got cached);
 *  2. the reading surface is a bounded, virtualized scroller (not full-height),
 *     and scroll-back over read content is a stable cache hit (no flicker).
 *
 * The demo's book data is faker-generated but deterministic (seeded), so the
 * structural assertions below are stable run-to-run.
 *
 * Also covers the M9 features whose contracts are layout/real-DOM dependent:
 * responsive tree-collapse, the render hooks (custom caret + content wrapper),
 * object content payloads, and the split inter-node spacing tokens.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';

const content = (page: Page): Locator => page.locator('[data-part="content"]');
const nodes = (page: Page): Locator => page.locator('[data-part="content-node"]');

/** The set of section ids currently mounted in the reading surface. */
async function mountedIds(page: Page): Promise<string[]> {
  return nodes(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-node-id') ?? ''),
  );
}

/** Geometry of the content scroll viewport. */
async function viewport(page: Page): Promise<{
  clientH: number;
  scrollH: number;
  scrollTop: number;
}> {
  return content(page).evaluate((el) => ({
    clientH: el.clientHeight,
    scrollH: el.scrollHeight,
    scrollTop: el.scrollTop,
  }));
}

async function openExample(page: Page, name: RegExp): Promise<void> {
  await page.getByRole('tab', { name }).click();
  // Wait for the freshly-mounted reading surface to have content.
  await expect(nodes(page).first()).toBeVisible();
}

const treePane = (page: Page): Locator => page.locator('[data-part="tree-pane"]');
const treeToggle = (page: Page): Locator =>
  page.locator('[data-part="tree-toggle"]');
const treeOverlay = (page: Page): Locator =>
  page.locator('[data-part="tree-overlay"]');

/** Drive the Responsive example's controlled width slider (a React input). */
async function setFrameWidth(page: Page, value: number): Promise<void> {
  await page.locator('.resp-width input[type="range"]').evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;
    setter.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'book-reader demo' })).toBeVisible();
});

test.describe('content renders (no spurious "No content.")', () => {
  test('Quickstart shows real section bodies and never the empty state', async ({
    page,
  }) => {
    // Quickstart is the default tab.
    await expect(nodes(page).first()).toBeVisible();

    // At least one section is fully loaded with body text…
    await expect(
      page.locator('[data-part="content-node"][data-status="loaded"]').first(),
    ).toBeVisible();

    // …and *nothing* is stuck on the empty state (the regression that showed
    // "No content." for every section because an aborted fetch cached '').
    await expect(page.getByText('No content.')).toHaveCount(0);

    // The first article carries real prose (a non-trivial amount of text).
    const firstText = await nodes(page).first().innerText();
    expect(firstText.trim().length).toBeGreaterThan(40);
  });

});

test.describe('the reading surface is a bounded, virtualized scroller', () => {
  test('the surface scrolls internally (bounded viewport, virtualized)', async ({
    page,
  }) => {
    // Regression guard for the layout bug where the reader ignored its sized
    // frame: the content pane must be a *bounded* scroller, not full-height.
    await expect(nodes(page).first()).toBeVisible();
    const vp = await viewport(page);
    expect(vp.scrollH).toBeGreaterThan(vp.clientH); // there is something to scroll to
    expect(vp.clientH).toBeLessThan(900); // bounded to the frame, not the whole book
  });
});

test.describe('reading line stays put while scrolling (no flicker)', () => {
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

  test('the section at the fold moves only by the scroll step as content settles', async ({
    page,
  }) => {
    // The large, virtualized, *async*-loading book — the hardest case: sections
    // mount at an estimated height and grow when their body arrives, right as the
    // reader scrolls through them. Anchor correction must absorb every such change
    // so the line the reader is on never jumps. (This caught a StrictMode
    // double-ResizeObserver leak that double-applied the correction.)
    await openExample(page, /Styling & location/);
    await page.waitForTimeout(600);

    // The reading anchor = the section straddling the top edge of the viewport.
    const foldNode = (m: Record<string, { top: number; bottom: number }>) => {
      for (const id of Object.keys(m)) {
        if (m[id]!.top <= 0 && m[id]!.bottom > 0) return id;
      }
      return undefined;
    };

    const STEP = 80;
    let worst = 0;
    let prev = await rectsById(page);
    for (let i = 0; i < 25; i++) {
      await content(page).evaluate((el, d) => el.scrollBy(0, d), STEP);
      await page.waitForTimeout(140); // let async bodies arrive mid-scroll
      const now = await rectsById(page);
      const anchor = foldNode(prev);
      if (anchor !== undefined && anchor in now) {
        // With working anchor correction the fold section moves by exactly the
        // scroll step, even as sections above/below settle. A bigger move = a jump.
        const moved = now[anchor]!.top - prev[anchor]!.top;
        worst = Math.max(worst, Math.abs(moved - -STEP));
      }
      prev = now;
    }

    expect(worst).toBeLessThan(40);
  });
});

test.describe('scroll-back is stable (cache hit, no flicker)', () => {
  test('scrolling away and back shows the same first section, no reload flash', async ({
    page,
  }) => {
    await expect(nodes(page).first()).toBeVisible();
    const firstId = (await mountedIds(page))[0];
    const firstText = await nodes(page).first().innerText();

    // Scroll well down, then back to the very top.
    await content(page).evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(400);
    await content(page).evaluate((el) => el.scrollTo(0, 0));
    await page.waitForTimeout(300);

    // The same first section is back, with identical text and no loading flash —
    // a synchronous cache hit, not a re-fetch.
    const backIds = await mountedIds(page);
    expect(backIds[0]).toBe(firstId);
    expect(await nodes(page).first().innerText()).toBe(firstText);
    await expect(nodes(page).first()).toHaveAttribute('data-status', 'loaded');
  });
});

test.describe('tree click navigates the reading surface', () => {
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

  /** The id of the section whose top sits flush with the viewport top. */
  async function topNodeId(page: Page): Promise<string | undefined> {
    const m = await rectsById(page);
    for (const id of Object.keys(m)) {
      if (m[id]!.top <= 1 && m[id]!.bottom > 1) return id;
    }
    return undefined;
  }

  const row = (page: Page, text: RegExp): Locator =>
    page.locator('[data-part="tree-node"]', { hasText: text }).first();

  // Reveal the Parts: open the root via its caret (the styling book starts with
  // the root row collapsed — the root itself is the active node at the top).
  async function expandRoot(page: Page): Promise<void> {
    await openExample(page, /Styling & location/);
    await page.waitForTimeout(500);
    await page
      .locator('[data-part="tree-node"]')
      .first()
      .locator('[data-part="tree-node-caret"]')
      .click();
    await expect(row(page, /Part 3\./)).toBeVisible();
  }

  test('clicking an organisational (no-content) Part jumps to its first section', async ({
    page,
  }) => {
    // The styling example's Parts/Chapters are `hasContent: false` — clicking one
    // must resolve to its first content-bearing descendant in reading order, not
    // silently do nothing (the "sometimes it is not taking there" report).
    await expandRoot(page);

    await row(page, /Part 3\./).click(); // l.p2 — a pure organisational branch
    await expect
      .poll(async () => topNodeId(page), { timeout: 4000 })
      .toBe('l.p2.c0.s0'); // its first content-bearing section lands at the top
  });

  test('clicking successive Parts each navigates to the right section', async ({
    page,
  }) => {
    await expandRoot(page);

    // Each click resolves the organisational Part to its first section; the last
    // click wins and lands its title at the top — rapid navigation stays correct.
    const targets: [RegExp, string][] = [
      [/Part 1\./, 'l.p0.c0.s0'],
      [/Part 4\./, 'l.p3.c0.s0'],
      [/Part 2\./, 'l.p1.c0.s0'],
    ];
    for (const [text, id] of targets) {
      await row(page, text).click();
      await expect.poll(async () => topNodeId(page), { timeout: 4000 }).toBe(id);
    }
  });

  test('clicking a non-leaf node that has content loads it, shows its text, and makes it active', async ({
    page,
  }) => {
    // "Branch content" book: Parts carry their own content (no hasContent:false),
    // so a Part is a first-class reading target — clicking it must navigate to the
    // Part itself (its intro), not jump past it to a child.
    await openExample(page, /Branch content/);
    await page.waitForTimeout(300);

    // Open the root to reveal the Parts (the root itself is active at the top).
    await page
      .locator('[data-part="tree-node"]')
      .first()
      .locator('[data-part="tree-node-caret"]')
      .click();
    const partII = row(page, /Part II/);
    await expect(partII).toBeVisible();

    await partII.click(); // a non-leaf node WITH content (id b.p1)

    // The Part's own content node lands at the top…
    await expect.poll(async () => topNodeId(page), { timeout: 4000 }).toBe('b.p1');

    // …fully loaded with real body text (not loading/empty/error)…
    const node = page.locator('[data-part="content-node"][data-node-id="b.p1"]');
    await expect(node).toHaveAttribute('data-status', 'loaded');
    expect((await node.innerText()).trim().length).toBeGreaterThan(40);

    // …and the Part itself is the active (highlighted) tree node, not a chapter.
    await expect(partII).toHaveAttribute('aria-selected', 'true');
  });

  test('jumping to a deep section pins its title at the top as bodies settle', async ({
    page,
  }) => {
    // A far jump lands the target at the top, then async bodies above it arrive
    // and change height. The navigation anchor must re-align so the clicked
    // title never drifts above the fold ("title beginning is gone above").
    await openExample(page, /Styling & location/);
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: /Jump to/ }).click();

    let lastTop = 999;
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(150);
      const m = await rectsById(page);
      const target = m['l.p5.c5.s10'];
      if (target) lastTop = target.top;
    }
    // The clicked section's title sits at the top (~0), never scrolled above it.
    expect(Math.abs(lastTop)).toBeLessThan(8);
  });
});

test.describe('responsive tree-collapse (reading width wins)', () => {
  // Real layout only: the collapse decision is width-driven (tree 300 +
  // contentMinWidth 420 ⇒ collapse under ~720px frame). jsdom can't do this.
  test('narrowing collapses the tree to a popover; widening restores the pane', async ({
    page,
  }) => {
    await openExample(page, /Responsive tree/);

    // Wide: both panes fit, the inline tree is shown.
    await setFrameWidth(page, 900);
    await expect(treePane(page)).toBeVisible();
    await expect(treeToggle(page)).toHaveCount(0);

    // Narrow under the floor: the tree collapses to a toggle (no inline pane).
    await setFrameWidth(page, 340);
    await expect(treeToggle(page)).toBeVisible();
    await expect(treePane(page)).toHaveCount(0);

    // The toggle opens the floated tree at the current position…
    await treeToggle(page).click();
    await expect(treeOverlay(page)).toBeVisible();

    // …selecting a section navigates and dismisses the popover.
    await treeOverlay(page)
      .locator('[data-part="tree-node"]')
      .first()
      .click();
    await expect(treeOverlay(page)).toHaveCount(0);

    // Widening past the floor brings the inline pane back (no orphaned popover).
    await setFrameWidth(page, 900);
    await expect(treePane(page)).toBeVisible();
    await expect(treeOverlay(page)).toHaveCount(0);
  });
});

test.describe('render hooks: custom caret + content wrapper', () => {
  test('the caret is replaced and the content wrapper is the consumer element', async ({
    page,
  }) => {
    await openExample(page, /Render hooks/);

    // renderExpandCollapse replaced the default caret entirely.
    await expect(page.locator('[data-part="tree-node-caret"]')).toHaveCount(0);
    await expect(page.locator('.rh-caret').first()).toBeVisible();

    // renderContentNode owns the wrapper: each section is a <section> (not the
    // default <article>) and still carries the data-part hook + the status badge.
    const first = nodes(page).first();
    await expect(first).toBeVisible();
    expect(
      await first.evaluate((el) => el.tagName),
    ).toBe('SECTION');
    await expect(first.locator('.rh-node-badge')).toBeVisible();

    // The custom +/− control still drives real expansion (library kept the nav).
    const rowsBefore = await page.locator('[data-part="tree-node"]').count();
    await page.locator('.rh-caret').first().click();
    await expect
      .poll(async () => page.locator('[data-part="tree-node"]').count())
      .toBeGreaterThan(rowsBefore);
  });
});

test.describe('object content payload', () => {
  test('a structured object renders without any HTML injection', async ({
    page,
  }) => {
    await openExample(page, /Object content/);

    // The consumer's renderContent drew the typed object…
    await expect(page.locator('.obj-section').first()).toBeVisible();
    await expect(page.locator('.obj-head h2').first()).toBeVisible();

    // …and the string-only HTML path never ran for the object payload.
    await expect(page.locator('[data-part="content-html"]')).toHaveCount(0);
  });
});

test.describe('inter-node spacing tokens (independent block/inline padding)', () => {
  test('content padding splits into block + inline, tunable separately', async ({
    page,
  }) => {
    // Defaults from the real skin: 1.5rem block (24px) / 2rem inline (32px).
    const first = nodes(page).first();
    await expect(first).toBeVisible();
    const pad = (el: Locator) =>
      el.evaluate((n) => {
        const s = getComputedStyle(n as HTMLElement);
        return { top: s.paddingTop, left: s.paddingLeft };
      });
    expect(await pad(first)).toEqual({ top: '24px', left: '32px' });

    // Overriding only the *block* token changes vertical spacing, not horizontal —
    // the whole point of the split (gap between sections, independent of inset).
    await page
      .locator('[data-part="book-reader"]')
      .evaluate((el) =>
        (el as HTMLElement).style.setProperty(
          '--reader-content-padding-block',
          '40px',
        ),
      );
    await expect
      .poll(async () => (await pad(first)).top)
      .toBe('40px');
    expect((await pad(first)).left).toBe('32px');
  });
});
