/**
 * Integration coverage for the *wiring* of virtualization into the content pane
 * (the geometry itself is unit-tested in `core/virtualizer.test.ts`). jsdom has
 * no layout, so we stub the scroll container's `clientHeight`, each node's
 * measured height, and `ResizeObserver` to simulate a real viewport — then assert
 * only the window mounts, the cache pins the window + prefetch, and the next
 * nodes are warmed ahead of view.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { createTreeStore } from '../../src/core/treeStore';
import { createContentCache } from '../../src/core/cache';
import { ContentPane } from '../../src/content/ContentPane';
import type { BookNode, FetchContent } from '../../src/types';

const NODE_HEIGHT = 100;
const VIEWPORT_HEIGHT = 300;

// A flat book of 20 sibling chapters under one root → 21 content nodes.
const book: BookNode = {
  id: 'root',
  title: 'Root',
  children: Array.from({ length: 20 }, (_, i) => ({
    id: `c${i}`,
    title: `Chapter ${i}`,
  })),
};

class MockResizeObserver {
  private readonly cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe(el: Element): void {
    // Fire immediately, like a real RO does on observe.
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

const mountedIds = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('[data-part="content-node"]')).map(
    (el) => el.getAttribute('data-node-id') ?? '',
  );

describe('ContentPane — virtualization wiring', () => {
  it('mounts only the viewport + overscan window, not the whole book', async () => {
    const store = createTreeStore({ tree: book });
    const fetch: FetchContent = (n) => `<p>${n.title}</p>`;
    const { container } = render(
      <ContentPane store={store} fetchContent={fetch} estimateHeight={NODE_HEIGHT} />,
    );

    // 21 nodes × 100px, 300px viewport, overscan 2 → ~7 mounted, not all 21.
    await waitFor(() => {
      const ids = mountedIds(container);
      expect(ids.length).toBeLessThan(21);
      expect(ids).toContain('root');
      expect(ids).not.toContain('c19');
    });
  });

  it('pins the mounted window (+ prefetch) in the cache', async () => {
    const store = createTreeStore({ tree: book });
    const pinnedCalls: string[][] = [];
    const cache = createContentCache();
    const realSetPinned = cache.setPinned.bind(cache);
    cache.setPinned = (ids) => {
      const arr = [...ids];
      pinnedCalls.push(arr);
      realSetPinned(arr);
    };

    const fetch: FetchContent = (n) => `<p>${n.title}</p>`;
    render(
      <ContentPane
        store={store}
        fetchContent={fetch}
        cache={cache}
        estimateHeight={NODE_HEIGHT}
      />,
    );

    await waitFor(() => {
      const last = pinnedCalls[pinnedCalls.length - 1];
      // Windowed pin: the mounted head plus the prefetch tail, but not the whole book.
      expect(last).toBeDefined();
      expect(last).toContain('root');
      expect(last?.length).toBeLessThan(21);
      expect(last).not.toContain('c19');
    });
  });

  it('warms the next nodes ahead of view without mounting them', async () => {
    const store = createTreeStore({ tree: book });
    const cache = createContentCache();
    const fetch: FetchContent = async (n) => `<p>${n.title}</p>`;
    const { container } = render(
      <ContentPane
        store={store}
        fetchContent={fetch}
        cache={cache}
        prefetchCount={2}
        estimateHeight={NODE_HEIGHT}
      />,
    );

    await waitFor(() => {
      // A node just past the mounted window is in the cache (prefetched)...
      const ids = mountedIds(container);
      const justPast = ['root', ...book.children!.map((c) => c.id)].find(
        (id) => !ids.includes(id) && cache.has(id),
      );
      expect(justPast).toBeDefined();
    });
  });
});
