/**
 * Tree-collapse modes + headless (controlled) overlay open state. The width-driven
 * `'auto'` path needs real layout, so it lives in the e2e suite; here we cover the
 * deterministic, layout-free behaviour: the forced modes, the controlled
 * `treeOpen`/`onTreeOpenChange` contract (external toggle outside `<BookReader>`),
 * and the overlay min-size props. jsdom has no layout, so we force the collapsed
 * UI with `collapseTree="always"` rather than mocking widths.
 */
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { BookReader } from '../src/BookReader';
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

describe('BookReader — headless / controlled tree-collapse', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        {/* Lives OUTSIDE <BookReader> — the headless use case. */}
        <button data-testid="ext" onClick={() => setOpen((o) => !o)}>
          {open ? 'close' : 'open'}
        </button>
        <BookReader
          tree={book}
          fetchContent={fc}
          collapseTree="always"
          treeOpen={open}
          onTreeOpenChange={setOpen}
        />
      </>
    );
  }

  it('an external toggle drives the overlay via treeOpen/onTreeOpenChange', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();

    // External button opens it…
    fireEvent.click(screen.getByTestId('ext'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByTestId('ext')).toHaveTextContent('close');

    // …and selecting a section from the overlay closes it and syncs the button
    // (onTreeOpenChange fired for the library-initiated close).
    fireEvent.click(within(dialog).getByText('Root'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('ext')).toHaveTextContent('open');
  });

  it('reports open/close to onTreeOpenChange when uncontrolled', () => {
    const onTreeOpenChange = vi.fn();
    const { container } = render(
      <BookReader
        tree={book}
        fetchContent={fc}
        collapseTree="always"
        onTreeOpenChange={onTreeOpenChange}
      />,
    );
    fireEvent.click(container.querySelector('[data-part="tree-toggle"]')!);
    expect(onTreeOpenChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(container.querySelector('[data-part="tree-toggle"]')!);
    expect(onTreeOpenChange).toHaveBeenLastCalledWith(false);
  });
});
