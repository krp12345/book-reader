/**
 * Anchor-correction stability (the "no flicker / stable view" hard requirement).
 *
 * When a node *above* the viewport is re-measured to a different height, the
 * machinery nudges `scrollTop` to cancel the shift so the node under the reader's
 * eyes stays put. The bug this guards against: the correction wrote `scrollTop`
 * but didn't fold the new value into React state, so the measure-driven re-render
 * computed the window against a *stale* scrollTop — the active node jumped to an
 * earlier one for a frame (intermittently, depending on which nodes were measured
 * vs. estimated). The fix syncs metrics in the same batch as the correction.
 *
 * jsdom can't lay out, so (as in the sibling virtualize/scrollsync tests) we stub
 * `clientHeight`, per-node `getBoundingClientRect`, and a *manually flushed*
 * `ResizeObserver`. jsdom never fires the browser's compensating scroll event,
 * which turns the otherwise-transient bad frame into a permanent, assertable
 * state — exactly what makes this regression deterministic.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { createTreeStore } from '../../src/core/treeStore';
import { ContentPane } from '../../src/components/content/ContentPane';
import type { BookNode, FetchContent } from '../../src/types';

const ESTIMATE = 100;
const VIEWPORT = 300;

// Per-node measured heights (mutable, so a test can grow a node and re-measure).
const heights = new Map<string, number>();

interface ROInstance {
  cb: ResizeObserverCallback;
  targets: Set<Element>;
}
const roInstances: ROInstance[] = [];

class MockResizeObserver {
  private readonly inst: ROInstance;
  constructor(cb: ResizeObserverCallback) {
    this.inst = { cb, targets: new Set() };
    roInstances.push(this.inst);
  }
  observe(el: Element): void {
    this.inst.targets.add(el);
  }
  unobserve(el: Element): void {
    this.inst.targets.delete(el);
  }
  disconnect(): void {
    this.inst.targets.clear();
  }
}

/**
 * Fire the *node* ResizeObservers only — never the container's (whose callback is
 * `syncMetrics`). Flushing that one too would sync scrollTop for free and mask the
 * very bug under test; a real measurement only runs the node observer.
 */
function flushNodeMeasurements(): void {
  for (const inst of roInstances) {
    const nodeTargets = [...inst.targets].filter(
      (t) => (t as HTMLElement).dataset.part === 'content-node',
    );
    if (nodeTargets.length === 0) continue;
    inst.cb(
      nodeTargets.map((t) => ({ target: t }) as ResizeObserverEntry),
      inst as unknown as ResizeObserver,
    );
  }
}

const origGBCR = HTMLElement.prototype.getBoundingClientRect;

beforeAll(() => {
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.part === 'content' ? VIEWPORT : 0;
    },
  });
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this.dataset.part === 'content-node') {
      const id = this.getAttribute('data-node-id') ?? '';
      const h = heights.get(id) ?? ESTIMATE;
      return { height: h, width: 0, top: 0, left: 0, right: 0, bottom: h, x: 0, y: 0, toJSON: () => ({}) };
    }
    return origGBCR.call(this);
  };
});

afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = origGBCR;
  delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
});

// root + c0..c9 → 11 content nodes in reading order, all 100px to start.
const book: BookNode = {
  id: 'root',
  title: 'Root',
  children: Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, title: `Chapter ${i}` })),
};

const fetchContent: FetchContent = (n) => `<p>${n.title}</p>`;
const scroller = (c: HTMLElement): HTMLElement =>
  c.querySelector('[data-part="content"]') as HTMLElement;

describe('ContentPane — anchor correction keeps the active node stable', () => {
  it('re-measuring a node above the viewport does not jump the reader to it', () => {
    heights.clear();
    roInstances.length = 0;
    const onActiveChange = vi.fn();

    // Reading order is root,c0..c9 → indices 0..10 at 100px each. Scroll so c5
    // (index 6, start 600) sits at the viewport top.
    const store = createTreeStore({ tree: book });
    const { container } = render(
      <ContentPane
        store={store}
        fetchContent={fetchContent}
        estimateHeight={ESTIMATE}
        onActiveChange={onActiveChange}
      />,
    );

    const el = scroller(container);
    act(() => {
      el.scrollTop = 600;
      fireEvent.scroll(el);
    });

    const lastActive = (): string | undefined => {
      const calls = onActiveChange.mock.calls;
      return calls.length === 0 ? undefined : calls[calls.length - 1]?.[0];
    };
    // The reader is on c5 before the height change above it.
    expect(lastActive()).toBe('c5');

    // c3 (index 4, start 400 — above the viewport top) grows 100 → 250px.
    act(() => {
      heights.set('c3', 250);
      flushNodeMeasurements();
    });

    // Anchor correction adds the +150 to scrollTop so c5 stays under the eyes…
    expect(el.scrollTop).toBe(750);
    // …and — the regression — the active node must still be c5, not the grown c3
    // (which a stale-scrollTop window recompute would report).
    expect(lastActive()).toBe('c5');
  });

  it('growing the node that straddles the viewport top does not jump the view', () => {
    heights.clear();
    roInstances.length = 0;
    const onActiveChange = vi.fn();

    // Scroll to 650: that lands *inside* c5 (index 6, span [600,700)), so c5
    // straddles the viewport top — the reader is partway through it.
    const store = createTreeStore({ tree: book });
    const { container } = render(
      <ContentPane
        store={store}
        fetchContent={fetchContent}
        estimateHeight={ESTIMATE}
        onActiveChange={onActiveChange}
      />,
    );

    const el = scroller(container);
    act(() => {
      el.scrollTop = 650;
      fireEvent.scroll(el);
    });

    // c5's content settles taller (100 → 300) — e.g. an async body arrives. It
    // grows at its *bottom* (below the viewport top at 650), so the pixels under
    // the reader's eyes don't move: scrollTop must stay put. The old code corrected
    // by the full +200 (because start 600 < 650), jerking the view down to 850.
    act(() => {
      heights.set('c5', 300);
      flushNodeMeasurements();
    });

    expect(el.scrollTop).toBe(650);
  });
});
