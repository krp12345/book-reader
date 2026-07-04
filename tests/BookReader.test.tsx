import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { BookReader } from '../src/components/BookReader';
import type { BookNode, FetchContent } from '../src/types';

const book: BookNode = {
  id: 'root',
  title: 'Root',
  children: [{ id: 'ch1', title: 'Chapter 1' }],
};

const fetchContent: FetchContent = (node) => `<p>Body of ${node.title}</p>`;

describe('BookReader — composition', () => {
  it('renders the tree pane and the content pane from one store', () => {
    const { container } = render(
      <BookReader tree={book} fetchContent={fetchContent} />,
    );
    expect(screen.getByRole('tree')).toBeInTheDocument();
    expect(container.querySelector('[data-part="content"]')).not.toBeNull();
    // Root content fetched into the reading surface.
    expect(screen.getByText('Body of Root')).toBeInTheDocument();
  });

  it('places the tree before the content by default (treeSide left)', () => {
    const { container } = render(
      <BookReader tree={book} fetchContent={fetchContent} />,
    );
    const root = container.querySelector(
      '[data-part="book-reader"]',
    ) as HTMLElement;
    expect(root).toHaveStyle({ flexDirection: 'row' });
    expect(within(root).getByRole('tree')).toBeInTheDocument();
  });

  it('reverses the layout when treeSide is right', () => {
    const { container } = render(
      <BookReader tree={book} fetchContent={fetchContent} treeSide="right" />,
    );
    const root = container.querySelector(
      '[data-part="book-reader"]',
    ) as HTMLElement;
    expect(root).toHaveStyle({ flexDirection: 'row-reverse' });
  });
});
