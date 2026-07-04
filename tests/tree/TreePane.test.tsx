import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTreeStore } from '../../src/core/treeStore';
import { TreePane } from '../../src/components/tree/TreePane';
import type { BookNode } from '../../src/types';

//   root
//   ├─ ch1
//   │   ├─ ch1a
//   │   └─ ch1b
//   └─ ch2
const sampleTree: BookNode = {
  id: 'root',
  title: 'Root',
  children: [
    {
      id: 'ch1',
      title: 'Chapter 1',
      children: [
        { id: 'ch1a', title: 'Section 1.a' },
        { id: 'ch1b', title: 'Section 1.b' },
      ],
    },
    { id: 'ch2', title: 'Chapter 2' },
  ],
};

function treeitem(name: RegExp | string): HTMLElement {
  return screen.getByRole('treeitem', { name });
}

// The expand caret is aria-hidden (the treeitem itself carries aria-expanded and
// is toggled with arrow keys), so it must be queried with `hidden: true`.
function caretOf(item: HTMLElement): HTMLElement {
  return within(item).getByRole('button', { hidden: true });
}

describe('TreePane — rendering & expand/collapse', () => {
  it('shows only roots until expanded', () => {
    const store = createTreeStore({ tree: sampleTree });
    render(<TreePane store={store} />);
    expect(treeitem(/Root/)).toBeInTheDocument();
    expect(screen.queryByText('Chapter 1')).not.toBeInTheDocument();
  });

  it('reveals and hides children when the caret is toggled', async () => {
    const user = userEvent.setup();
    const store = createTreeStore({ tree: sampleTree });
    render(<TreePane store={store} />);

    const root = treeitem(/Root/);
    expect(root).toHaveAttribute('aria-expanded', 'false');

    await user.click(within(root).getByRole('button', { hidden: true }));
    expect(root).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
    expect(screen.getByText('Chapter 2')).toBeInTheDocument();

    await user.click(within(root).getByRole('button', { hidden: true }));
    expect(root).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Chapter 1')).not.toBeInTheDocument();
  });

  it('marks leaf nodes as non-expandable (no aria-expanded)', async () => {
    const user = userEvent.setup();
    const store = createTreeStore({ tree: sampleTree });
    render(<TreePane store={store} />);
    await user.click(caretOf(treeitem(/Root/)));
    expect(treeitem(/Chapter 2/)).not.toHaveAttribute('aria-expanded');
  });
});

describe('TreePane — selection', () => {
  it('calls onSelect and marks the row selected on click', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const store = createTreeStore({ tree: sampleTree });
    render(<TreePane store={store} onSelect={onSelect} />);

    const root = treeitem(/Root/);
    await user.click(root);
    expect(onSelect).toHaveBeenCalledWith('root');
    expect(root).toHaveAttribute('aria-selected', 'true');
  });

  it('toggling the caret does not select the row', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const store = createTreeStore({ tree: sampleTree });
    render(<TreePane store={store} onSelect={onSelect} />);
    await user.click(caretOf(treeitem(/Root/)));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('TreePane — keyboard navigation', () => {
  it('moves focus with arrows and expands/selects via keys', async () => {
    const user = userEvent.setup();
    const store = createTreeStore({ tree: sampleTree });
    const onSelect = vi.fn();
    render(<TreePane store={store} onSelect={onSelect} />);

    await user.tab(); // focus the single tab stop (the root)
    expect(treeitem(/Root/)).toHaveFocus();

    await user.keyboard('{ArrowRight}'); // expand root
    expect(treeitem(/Root/)).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{ArrowRight}'); // enter → first child
    expect(treeitem(/Chapter 1/)).toHaveFocus();

    await user.keyboard('{ArrowDown}'); // move to Chapter 2
    expect(treeitem(/Chapter 2/)).toHaveFocus();

    await user.keyboard('{Enter}'); // select it
    expect(onSelect).toHaveBeenCalledWith('ch2');
  });

  it('collapses with ArrowLeft, then steps to the parent', async () => {
    const user = userEvent.setup();
    const store = createTreeStore({ tree: sampleTree });
    render(<TreePane store={store} />);

    await user.tab();
    await user.keyboard('{ArrowRight}{ArrowRight}'); // expand root, focus Chapter 1
    expect(treeitem(/Chapter 1/)).toHaveFocus();

    await user.keyboard('{ArrowLeft}'); // Chapter 1 is collapsed → go to parent
    expect(treeitem(/Root/)).toHaveFocus();

    await user.keyboard('{ArrowLeft}'); // Root is expanded → collapse it
    expect(treeitem(/Root/)).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('TreePane — custom renderer', () => {
  it('uses renderTreeNode for the row label', () => {
    const store = createTreeStore({ tree: sampleTree });
    render(
      <TreePane
        store={store}
        renderTreeNode={(node, state) => (
          <span>{`${node.title} @${state.depth}`}</span>
        )}
      />,
    );
    expect(screen.getByText('Root @0')).toBeInTheDocument();
  });
});
