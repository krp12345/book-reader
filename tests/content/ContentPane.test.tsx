import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createTreeStore } from '../../src/core/treeStore';
import { ContentPane } from '../../src/components/content/ContentPane';
import type { BookNode, FetchContent } from '../../src/types';

//   root
//   ├─ ch1
//   │   └─ ch1a
//   └─ ch2 (hasContent: false — organizational)
const book: BookNode = {
  id: 'root',
  title: 'Root',
  children: [
    { id: 'ch1', title: 'Chapter 1', children: [{ id: 'ch1a', title: '1.a' }] },
    { id: 'ch2', title: 'Chapter 2', hasContent: false },
  ],
};

const fetchByTitle: FetchContent = (node) => `<p>Body of ${node.title}</p>`;

describe('ContentPane — book-order rendering', () => {
  it('renders content nodes in depth-first reading order', () => {
    const store = createTreeStore({ tree: book });
    const { container } = render(
      <ContentPane store={store} fetchContent={fetchByTitle} />,
    );
    const ids = Array.from(
      container.querySelectorAll('[data-part="content-node"]'),
    ).map((el) => el.getAttribute('data-node-id'));
    // ch2 has no content → skipped; the rest follow reading order.
    expect(ids).toEqual(['root', 'ch1', 'ch1a']);
  });

  it('renders each node’s fetched body', () => {
    const store = createTreeStore({ tree: book });
    render(<ContentPane store={store} fetchContent={fetchByTitle} />);
    expect(screen.getByText('Body of Root')).toBeInTheDocument();
    expect(screen.getByText('Body of Chapter 1')).toBeInTheDocument();
  });

  it('forwards each node’s ancestor path to the fetcher', () => {
    const store = createTreeStore({ tree: book });
    const fetchContent = vi.fn<FetchContent>(() => '<p>x</p>');
    render(<ContentPane store={store} fetchContent={fetchContent} />);
    const ch1a = fetchContent.mock.calls.find((c) => c[0].id === 'ch1a');
    expect(ch1a?.[1].path).toEqual(['root', 'ch1']);
  });

  it('renders nothing but the container for an empty book', () => {
    const store = createTreeStore();
    const { container } = render(
      <ContentPane store={store} fetchContent={fetchByTitle} />,
    );
    const pane = container.querySelector('[data-part="content"]');
    expect(pane).not.toBeNull();
    expect(
      within(pane as HTMLElement).queryByRole('article'),
    ).not.toBeInTheDocument();
  });
});
