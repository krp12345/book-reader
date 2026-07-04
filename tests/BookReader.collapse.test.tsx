/**
 * Tree-collapse modes. The width-driven `'auto'` path needs real layout, so it
 * lives in the e2e suite; here we cover the deterministic, layout-free behaviour:
 * the forced modes, the default toggle opening the overlay, and the overlay
 * min-size props. jsdom has no layout, so we force the collapsed UI with
 * `collapseTree="always"` rather than mocking widths.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BookReader } from '../src/components/bookReader/BookReader';
import type { BookNode, FetchContent } from '../src/types';

const book: BookNode = {
  id: 'root',
  title: 'Root',
  children: [{ id: 'c1', title: 'Child 1' }],
};
const fc: FetchContent = (n) => `<p>${n.title}</p>`;

describe('BookReader — collapse modes', () => {
  it('"always" shows the toggle and drops the inline tree pane', () => {
    const { container } = render(
      <BookReader tree={book} fetchContent={fc} collapseTree="always" />,
    );
    expect(container.querySelector('[data-part="tree-toggle"]')).not.toBeNull();
    expect(container.querySelector('[data-part="tree-pane"]')).toBeNull();
  });

  it('"never" keeps the inline tree pane and no toggle', () => {
    const { container } = render(
      <BookReader tree={book} fetchContent={fc} collapseTree="never" />,
    );
    expect(container.querySelector('[data-part="tree-pane"]')).not.toBeNull();
    expect(container.querySelector('[data-part="tree-toggle"]')).toBeNull();
  });

  it('the default toggle opens the overlay and applies treeOverlayMin* sizes', () => {
    const { container } = render(
      <BookReader
        tree={book}
        fetchContent={fc}
        collapseTree="always"
        treeOverlayMinWidth={333}
        treeOverlayMinHeight={222}
      />,
    );
    expect(container.querySelector('[data-part="tree-overlay"]')).toBeNull();
    fireEvent.click(container.querySelector('[data-part="tree-toggle"]')!);

    const overlay = container.querySelector(
      '[data-part="tree-overlay"]',
    ) as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.style.minWidth).toBe('333px');
    expect(overlay.style.minHeight).toBe('222px');
  });
});
