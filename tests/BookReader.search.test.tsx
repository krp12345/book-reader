/**
 * Search = tree replacement (M10). Submitting `onSearch` swaps the whole book and
 * the reader resolves down to the first content-bearing node ("first page");
 * `onReset` restores it. A custom `renderSearch` replaces the default box but
 * drives the same replacement, and a second in-flight submit aborts the first so
 * only the latest result is applied.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BookReader } from '../src/components/BookReader';
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

  it('a no-match search renders the book-level empty state (M11 default template)', async () => {
    const noResults: BookNode = {
      id: 'qq',
      title: 'No Matches',
      hasContent: false,
      children: [],
    };
    const onSearch: SearchFn = vi.fn(async () => noResults);
    const { container } = render(
      <BookReader
        tree={originalBook}
        fetchContent={fc}
        showSearch
        onSearch={onSearch}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    // The default book-level template shows; no content node is mounted.
    expect(await screen.findByText('Nothing to show here.')).toBeInTheDocument();
    expect(
      container.querySelector('[data-part="content-nodata"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-part="content-node"]')).toBeNull();
  });

  it('renderNoData replaces the default book-level template (empty book)', () => {
    const emptyBook: BookNode = {
      id: 'e',
      title: 'Empty',
      hasContent: false,
      children: [],
    };
    const { container } = render(
      <BookReader
        tree={emptyBook}
        fetchContent={fc}
        renderNoData={() => <div data-testid="custom-nodata">nothing here</div>}
      />,
    );

    expect(screen.getByTestId('custom-nodata')).toBeInTheDocument();
    expect(screen.queryByText('Nothing to show here.')).toBeNull();
    expect(container.querySelector('[data-part="content-nodata"]')).toBeNull();
  });

  it('a re-search replaces the previous results cleanly', async () => {
    const secondResults: BookNode = {
      id: 'q2',
      title: 'Second Results',
      hasContent: false,
      children: [{ id: 'q2.s0', title: 'Second Match' }],
    };
    let call = 0;
    const onSearch: SearchFn = vi.fn(async () =>
      ++call === 1 ? resultsBook : secondResults,
    );
    render(
      <BookReader tree={originalBook} fetchContent={fc} showSearch onSearch={onSearch} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText('Search Results');

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('Second Results')).toBeInTheDocument();
    // The first results tree is fully gone — no stale rows or content nodes.
    expect(screen.queryByText('Search Results')).toBeNull();
    expect(screen.queryByText('First Match Section')).toBeNull();
    expect(
      await screen.findByRole('treeitem', { name: /Second Match/ }),
    ).toBeInTheDocument();
  });

  it('reset during an in-flight search aborts it and leaves no stuck state', async () => {
    let gate: ((t: BookNode) => void) | undefined;
    const onSearch: SearchFn = vi.fn(
      () => new Promise<BookNode>((resolve) => (gate = resolve)),
    );
    const onReset: ResetFn = vi.fn(async () => originalBook);
    // A custom box whose controls are never disabled, so Reset can fire while
    // the search is still pending.
    const renderSearch: RenderSearch = ({ submit, reset }) => (
      <div>
        <button type="button" onClick={submit}>
          Go
        </button>
        <button type="button" onClick={reset}>
          Wipe
        </button>
      </div>
    );
    render(
      <BookReader
        tree={originalBook}
        fetchContent={fc}
        showSearch
        onSearch={onSearch}
        onReset={onReset}
        renderSearch={renderSearch}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Go' })); // search hangs
    await waitFor(() => expect(gate).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Wipe' })); // reset mid-load

    // The reset lands: the original book is back and nothing is stuck loading.
    expect(
      await screen.findByRole('treeitem', { name: /Original Book/ }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryAllByText('Loading…')).toHaveLength(0),
    );

    // The aborted search resolving late must be discarded, not applied.
    gate!(resultsBook);
    await waitFor(() => {
      expect(screen.queryByText('Search Results')).toBeNull();
      expect(
        screen.getByRole('treeitem', { name: /Original Book/ }),
      ).toBeInTheDocument();
    });
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
