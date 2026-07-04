/**
 * Integration coverage for the M6 cross-pane wiring (scroll ⟷ tree sync &
 * auto-advance). jsdom has no layout, so — as in `ContentPane.virtualize.test` —
 * we stub the scroll container's `clientHeight`, each node's measured height, and
 * `ResizeObserver`, then drive real `scroll` events. The pure mapping is unit-
 * tested in `core/scrollSync.test.ts`; here we assert the three flows hang
 * together: scroll → active node → tree highlight + auto-expand + onLocationChange;
 * tree click → content scrolls; bottom → next lazy subtree auto-loads.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookReader } from '../src/components/BookReader';
import type { BookNode, FetchContent } from '../src/types';

const NODE_HEIGHT = 100;
const VIEWPORT_HEIGHT = 300;

class MockResizeObserver {
  private readonly cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe(el: Element): void {
    this.cb([{ target: el } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

const origGBCR = HTMLElement.prototype.getBoundingClientRect;

beforeAll(() => {
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.part === 'content' ? VIEWPORT_HEIGHT : 0;
    },
  });
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this.dataset.part === 'content-node') {
      return { height: NODE_HEIGHT, width: 0, top: 0, left: 0, right: 0, bottom: NODE_HEIGHT, x: 0, y: 0, toJSON: () => ({}) };
    }
    return origGBCR.call(this);
  };
});

afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = origGBCR;
  delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
});

const scroller = (container: HTMLElement): HTMLElement =>
  container.querySelector('[data-part="content"]') as HTMLElement;

// root → c0..c5, all with content. Heights 100 → c3 starts at 400.
const flatBook: BookNode = {
  id: 'root',
  title: 'Root',
  children: Array.from({ length: 6 }, (_, i) => ({
    id: `c${i}`,
    title: `Chapter ${i}`,
  })),
};

const fetchContent: FetchContent = (n) => `<p>Body of ${n.title}</p>`;

describe('BookReader — scroll → tree sync', () => {
  it('highlights the active node, auto-expands its path, and reports location', async () => {
    const onLocationChange = vi.fn();
    const { container } = render(
      <BookReader
        tree={flatBook}
        fetchContent={fetchContent}
        estimateHeight={NODE_HEIGHT}
        onLocationChange={onLocationChange}
      />,
    );

    // Scroll so Chapter 3's top (offset 400) sits at the viewport top.
    const el = scroller(container);
    el.scrollTop = 400;
    fireEvent.scroll(el);

    await waitFor(() => {
      // Root auto-expanded so the active child shows, and it's highlighted.
      const ch3 = screen.getByRole('treeitem', { name: /Chapter 3/ });
      expect(ch3).toHaveAttribute('aria-selected', 'true');
    });
    expect(onLocationChange).toHaveBeenCalledWith({ nodeId: 'c3', offset: 0 });
  });
});

describe('BookReader — controlled location echo-guard', () => {
  it('an echoed location never re-scrolls; a genuinely new one does', async () => {
    const onLocationChange = vi.fn();
    const props = {
      tree: flatBook,
      fetchContent,
      estimateHeight: NODE_HEIGHT,
      onLocationChange,
    };
    const { container, rerender } = render(
      <BookReader {...props} location={{ nodeId: 'root' }} />,
    );
    const el = scroller(container);

    // The user scrolls to Chapter 3 (offset 400) — the reader emits it…
    el.scrollTop = 400;
    fireEvent.scroll(el);
    await waitFor(() =>
      expect(onLocationChange).toHaveBeenCalledWith({ nodeId: 'c3', offset: 0 }),
    );

    // …then keeps scrolling a bit further before the parent state lands.
    el.scrollTop = 420;
    fireEvent.scroll(el);
    await waitFor(() => expect(el.scrollTop).toBe(420));

    // The parent echoes the *earlier* emit back as the controlled location.
    // The echo-guard must swallow it — without the guard this would snap the
    // surface back to 400 and oscillate against the user's live scroll.
    rerender(<BookReader {...props} location={{ nodeId: 'c3', offset: 0 }} />);
    await waitFor(() => expect(el.scrollTop).toBe(420));

    // A location the reader never emitted is a real navigation and does scroll.
    // (Heights are 100 and the root renders too, so c1 starts at 200.)
    rerender(<BookReader {...props} location={{ nodeId: 'c1', offset: 0 }} />);
    await waitFor(() => expect(el.scrollTop).toBe(200));
  });
});

describe('BookReader — tree click → scroll content', () => {
  it('scrolls the reading surface to a clicked node', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BookReader tree={flatBook} fetchContent={fetchContent} estimateHeight={NODE_HEIGHT} />,
    );

    // The reader is at the top, where the root itself is the active node; its
    // path has no ancestors to auto-expand, so open it via its caret, then click
    // Chapter 3 in the tree.
    const root = screen.getByRole('treeitem', { name: /Root/ });
    await user.click(within(root).getByRole('button', { hidden: true }));
    await user.click(await screen.findByRole('treeitem', { name: /Chapter 3/ }));

    await waitFor(() => {
      expect(scroller(container).scrollTop).toBe(400);
    });
  });
});
