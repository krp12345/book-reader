/**
 * M7 styling-system wiring. CSS itself is visual (not unit-tested); what *is*
 * testable is that the stable `data-part` hooks render and that per-slot
 * `classNames` + the `--reader-tree-indent` token reach the right elements.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BookReader } from '../src/BookReader';
import type { BookNode, FetchContent } from '../src/types';

const book: BookNode = {
  id: 'root',
  title: 'Root',
  children: [{ id: 'ch1', title: 'Chapter 1' }],
};

const fetchContent: FetchContent = (node) => `<p>Body of ${node.title}</p>`;

describe('BookReader — styling hooks', () => {
  it('exposes the stable data-part hooks for the default skin', () => {
    const { container } = render(
      <BookReader tree={book} fetchContent={fetchContent} />,
    );
    for (const part of [
      'book-reader',
      'tree-pane',
      'tree',
      'tree-node',
      'tree-node-caret',
      'tree-node-label',
      'content-pane',
      'content',
      'content-node',
      'content-html',
      'content-spacer-top',
      'content-spacer-bottom',
    ]) {
      expect(
        container.querySelector(`[data-part="${part}"]`),
        `missing data-part="${part}"`,
      ).not.toBeNull();
    }
  });

  it('threads per-slot classNames to their matching elements', () => {
    const { container } = render(
      <BookReader
        tree={book}
        fetchContent={fetchContent}
        classNames={{
          root: 'x-root',
          tree: 'x-tree',
          treeNode: 'x-row',
          content: 'x-content',
          contentNode: 'x-node',
        }}
      />,
    );
    expect(
      container.querySelector('[data-part="book-reader"]'),
    ).toHaveClass('br-reader', 'x-root');
    expect(container.querySelector('[data-part="tree-pane"]')).toHaveClass(
      'x-tree',
    );
    // Applied to every tree row alongside the base class.
    expect(container.querySelector('[data-part="tree-node"]')).toHaveClass(
      'br-tree-node',
      'x-row',
    );
    expect(container.querySelector('[data-part="content-pane"]')).toHaveClass(
      'x-content',
    );
    expect(container.querySelector('[data-part="content-node"]')).toHaveClass(
      'br-content-node',
      'x-node',
    );
  });

  it('exposes each row depth as data (skin owns the indent, not inline style)', () => {
    const { container } = render(
      <BookReader tree={book} fetchContent={fetchContent} />,
    );
    // Indentation moved out of inline style into the opt-in skin: the row carries
    // its depth as data (`data-depth` + the `--br-tree-depth` custom property),
    // and the skin turns that into `padding-inline-start`. So the bare component
    // carries no inline presentational indent.
    const row = container.querySelector('[data-part="tree-node"]') as HTMLElement;
    expect(row).toHaveAttribute('data-depth', '0');
    expect(row.style.getPropertyValue('--br-tree-depth')).toBe('0');
    expect(row.style.paddingInlineStart).toBe('');
  });
});
