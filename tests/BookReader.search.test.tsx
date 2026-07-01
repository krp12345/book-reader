/**
 * Search = tree replacement (M10). Submitting `onSearch` swaps the whole book and
 * the reader resolves down to the first content-bearing node ("first page");
 * `onReset` restores it. A custom `renderSearch` replaces the default box but
 * drives the same replacement, and a second in-flight submit aborts the first so
 * only the latest result is applied.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BookReader } from '../src/BookReader';
import type {
  BookNode,
  FetchContent,
  RenderSearch,
  ResetFn,
  SearchFn,
} from '../src/types';

const originalBook: BookNode = {
  id: 'orig',
  title: 'Original Book',
  hasContent: false,
  children: [{ id: 'orig.s0', title: 'Original Section' }],
};

// A results tree whose first two levels are pure organisational branches, so the
// reader must descend past them to reach the first real section.
const resultsBook: BookNode = {
  id: 'q',
  title: 'Search Results',
  hasContent: false,
  children: [
    {
      id: 'q.g0',
      title: 'Match Group',
      hasContent: false,
      children: [
        { id: 'q.g0.s0', title: 'First Match Section' },
        { id: 'q.g0.s1', title: 'Second Match Section' },
      ],
    },
  ],
};

const fc: FetchContent = (n) => `<p>${n.title}</p>`;

describe('BookReader — search (tree replacement)', () => {
  it('replaces the tree and lands on the first page', async () => {
    const onSearch: SearchFn = vi.fn(async () => resultsBook);
    const onLocationChange = vi.fn();
    render(
      <BookReader
        tree={originalBook}
        fetchContent={fc}
        showSearch
        onSearch={onSearch}
        onLocationChange={onLocationChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Search the book'), {
      target: { value: 'atlas' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    // The new tree is in, the old one is gone.
    expect(await screen.findByText('Search Results')).toBeInTheDocument();
    expect(screen.queryByText('Original Book')).toBeNull();
    expect(onSearch).toHaveBeenCalledWith('atlas', expect.anything());

    // It descended past the two `hasContent:false` branches to the first section.
    await waitFor(() =>
      expect(onLocationChange).toHaveBeenCalledWith(
        expect.objectContaining({ nodeId: 'q.g0.s0' }),
      ),
    );
  });

  it('restores the original tree on reset (and hides Reset when no onReset)', async () => {
    const onSearch: SearchFn = vi.fn(async () => resultsBook);
    const onReset: ResetFn = vi.fn(async () => originalBook);
    const onLocationChange = vi.fn();
    const { rerender } = render(
      <BookReader
        tree={originalBook}
        fetchContent={fc}
        showSearch
        onSearch={onSearch}
        onLocationChange={onLocationChange}
      />,
    );
    // With no onReset configured, the Reset control is hidden.
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();

    rerender(
      <BookReader
        tree={originalBook}
        fetchContent={fc}
        showSearch
        onSearch={onSearch}
        onReset={onReset}
        onLocationChange={onLocationChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText('Search Results');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(await screen.findByText('Original Book')).toBeInTheDocument();
    expect(screen.queryByText('Search Results')).toBeNull();
    expect(onReset).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(onLocationChange).toHaveBeenCalledWith(
        expect.objectContaining({ nodeId: 'orig.s0' }),
      ),
    );
  });

  it('drives replacement from a custom renderSearch (no default box)', async () => {
    const onSearch: SearchFn = vi.fn(async () => resultsBook);
    const renderSearch: RenderSearch = ({ setQuery, submit }) => (
      <div>
        <input
          aria-label="custom query"
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" onClick={submit}>
          Go
        </button>
      </div>
    );
    render(
      <BookReader
        tree={originalBook}
        fetchContent={fc}
        showSearch
        onSearch={onSearch}
        renderSearch={renderSearch}
      />,
    );

    // The default search box UI is replaced entirely.
    expect(screen.queryByLabelText('Search the book')).toBeNull();

    fireEvent.change(screen.getByLabelText('custom query'), {
      target: { value: 'hi' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    expect(await screen.findByText('Search Results')).toBeInTheDocument();
    expect(onSearch).toHaveBeenCalledWith('hi', expect.anything());
  });

  it('aborts an earlier in-flight search so only the latest result applies', async () => {
    // Two distinct results, resolved on demand, to prove which one wins.
    const gates: Array<(t: BookNode) => void> = [];
    const trees: BookNode[] = [
      { id: 'first', title: 'First Result' },
      { id: 'second', title: 'Second Result' },
    ];
    const onSearch: SearchFn = vi.fn(
      () => new Promise<BookNode>((resolve) => gates.push(resolve)),
    );
    // A custom box whose button is never disabled → two rapid submits are possible.
    const renderSearch: RenderSearch = ({ submit }) => (
      <button type="button" onClick={submit}>
        Go
      </button>
    );
    render(
      <BookReader
        tree={originalBook}
        fetchContent={fc}
        showSearch
        onSearch={onSearch}
        renderSearch={renderSearch}
      />,
    );

    const go = screen.getByRole('button', { name: 'Go' });
    fireEvent.click(go); // search #1 starts
    fireEvent.click(go); // search #2 starts, aborting #1
    await waitFor(() => expect(gates).toHaveLength(2));

    // Resolve the FIRST (aborted) search last — it must be discarded. Assert on
    // the tree row (the title also renders in the reading surface).
    gates[1]!(trees[1]!); // second wins
    expect(
      await screen.findByRole('treeitem', { name: /Second Result/ }),
    ).toBeInTheDocument();

    gates[0]!(trees[0]!); // first resolves late → ignored
    await waitFor(() => {
      expect(screen.queryByRole('treeitem', { name: /First Result/ })).toBeNull();
      expect(
        screen.getByRole('treeitem', { name: /Second Result/ }),
      ).toBeInTheDocument();
    });
  });
});
