/**
 * Lazy-tree integration through <BookReader>: expanding a `lazy` branch shows the
 * in-branch loading row and then its fetched children; a failing fetch shows a
 * Retry that succeeds; a `lazy` node with no `fetchChildren` configured surfaces
 * the error state. (Trigger *isolation* — expand vs. scroll — and virtualization
 * live in the Playwright e2e, since jsdom has no layout and mounts every node.)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BookReader } from '../src/components/BookReader';
import type { BookNode, FetchChildren, FetchContent } from '../src/types';

// root + branch are pure organisational (`hasContent:false`); the branch's
// fetched children are leaves (carry content, not lazy) so nothing cascades.
const book: BookNode = {
  id: 'root',
  title: 'Root',
  hasContent: false,
  children: [{ id: 'branch', title: 'Branch', lazy: true, hasContent: false }],
};
const fc: FetchContent = (n) => `<p>${n.title}</p>`;
const children: BookNode[] = [
  { id: 'branch.a', title: 'Section A' },
  { id: 'branch.b', title: 'Section B' },
];

const caretOf = (name: RegExp): HTMLElement =>
  screen
    .getByRole('treeitem', { name })
    .querySelector('[data-part="tree-node-caret"]') as HTMLElement;

describe('BookReader — lazy tree', () => {
  it('shows a loading row then the fetched children, fetching once', async () => {
    let resolve!: (c: BookNode[]) => void;
    const fetchChildren = vi.fn<FetchChildren>(
      () => new Promise<BookNode[]>((r) => (resolve = r)),
    );
    render(
      <BookReader tree={book} fetchContent={fc} fetchChildren={fetchChildren} />,
    );

    // The branch is revealed (root auto-opens onto the first showable node).
    fireEvent.click(caretOf(/Branch/));

    // The in-branch loading row shows while the fetch is pending.
    expect(
      await screen.findByText('Loading…', {
        selector: '[data-part="tree-lazy-loading"]',
      }),
    ).toBeInTheDocument();

    resolve(children);

    // Children render under the (expanded) branch; the loading row is gone.
    expect(
      await screen.findByRole('treeitem', { name: /Section A/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: /Section B/ })).toBeInTheDocument();
    expect(
      screen.queryByText('Loading…', {
        selector: '[data-part="tree-lazy-loading"]',
      }),
    ).toBeNull();

    // Deduped: expand + scroll triggers collapse to a single fetch for the node.
    expect(fetchChildren).toHaveBeenCalledTimes(1);
  });

  it('offers Retry after a failed fetch and succeeds on retry', async () => {
    let attempt = 0;
    const fetchChildren = vi.fn<FetchChildren>(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('network down');
      return children;
    });
    render(
      <BookReader tree={book} fetchContent={fc} fetchChildren={fetchChildren} />,
    );

    fireEvent.click(caretOf(/Branch/));

    // Scope to the *tree* error row (the reading surface renders its own lazy
    // placeholder + Retry for the same branch, so "Retry" alone is ambiguous).
    const treeError = await screen.findByText(/Couldn’t load\./, {
      selector: '[data-part="tree-lazy-error"]',
    });
    const retry = treeError.querySelector(
      '[data-part="tree-lazy-retry"]',
    ) as HTMLElement;

    fireEvent.click(retry);

    expect(
      await screen.findByRole('treeitem', { name: /Section A/ }),
    ).toBeInTheDocument();
    expect(fetchChildren).toHaveBeenCalledTimes(2);
  });

  it('surfaces the error state for a lazy node with no fetchChildren configured', async () => {
    render(<BookReader tree={book} fetchContent={fc} />);

    fireEvent.click(caretOf(/Branch/));

    await waitFor(() =>
      expect(
        screen.getByText(/Couldn’t load\./, {
          selector: '[data-part="tree-lazy-error"]',
        }),
      ).toBeInTheDocument(),
    );
  });
});
