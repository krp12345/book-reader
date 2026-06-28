/**
 * Configurable expand/collapse control (`renderExpandCollapse`). Verified through
 * the public `<BookReader>`: the default caret keeps its data-part hook + the
 * row's `aria-expanded`, and a custom control replaces *only* the caret while its
 * `ExpandCollapseApi` still drives real tree state (expand reveals children).
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookReader } from '../../src/BookReader';
import type { BookNode, FetchContent, RenderExpandCollapse } from '../../src/types';

const book: BookNode = {
  id: 'root',
  title: 'Root',
  children: [{ id: 'c1', title: 'Child 1', hasChildren: false }],
};
const fc: FetchContent = (n) => `<p>${n.title}</p>`;

describe('BookReader — expand/collapse control', () => {
  it('default caret: data-part hook, data-expandable, drives expansion', async () => {
    const { container } = render(<BookReader tree={book} fetchContent={fc} />);

    const caret = container.querySelector('[data-part="tree-node-caret"]')!;
    expect(caret).not.toBeNull();
    // Root is expandable; the caret advertises it (the skin shows/hides on this).
    expect(caret).toHaveAttribute('data-expandable');
    // The row keeps its a11y contract regardless of the caret markup.
    expect(container.querySelector('[data-part="tree-node"]')).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    // Scoped to the tree (the content pane mounts every node's body regardless).
    expect(screen.queryByRole('treeitem', { name: /Child 1/ })).toBeNull();
    fireEvent.click(caret);
    expect(
      await screen.findByRole('treeitem', { name: /Child 1/ }),
    ).toBeInTheDocument();
  });

  it('renderExpandCollapse replaces the caret and its api drives state', async () => {
    const renderEC: RenderExpandCollapse = ({ expandable, expanded, toggle }) =>
      expandable ? (
        <button
          type="button"
          data-testid="ec"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
        >
          {expanded ? 'open' : 'closed'}
        </button>
      ) : (
        <span data-testid="leaf-ec" />
      );

    const { container } = render(
      <BookReader tree={book} fetchContent={fc} renderExpandCollapse={renderEC} />,
    );

    // The hard-coded caret is gone; the library still owns the row + aria-expanded.
    expect(container.querySelector('[data-part="tree-node-caret"]')).toBeNull();
    expect(container.querySelector('[data-part="tree-node"]')).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    const ec = screen.getByTestId('ec');
    expect(ec).toHaveTextContent('closed');

    fireEvent.click(ec);
    expect(
      await screen.findByRole('treeitem', { name: /Child 1/ }),
    ).toBeInTheDocument();
    // `expanded` from the api reflects the new state.
    expect(screen.getByTestId('ec')).toHaveTextContent('open');
  });
});
