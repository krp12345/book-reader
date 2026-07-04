/**
 * Auto-open active branch. When the active node is itself a branch, the reader
 * now opens its *own* children (not just its ancestors), so landing on a Part
 * reveals its sections. Driven with a controlled `location` so the active node is
 * deterministic without needing real scroll.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookReader } from '../src/components/BookReader';
import type { BookNode, FetchContent } from '../src/types';

const book: BookNode = {
  id: 'root',
  title: 'Root',
  children: [
    {
      id: 'p1',
      title: 'Part 1',
      children: [{ id: 'p1s1', title: 'Section 1.1' }],
    },
    {
      id: 'p2',
      title: 'Part 2',
      children: [{ id: 'p2s1', title: 'Section 2.1' }],
    },
  ],
};
const fc: FetchContent = (n) => `<p>${n.title}</p>`;

describe('BookReader — auto-open active branch', () => {
  it('opens a branch’s own children when you navigate onto it', async () => {
    render(<BookReader tree={book} fetchContent={fc} />);

    // Top of the book: nothing is auto-dumped — open the root to reach the Parts.
    fireEvent.click(
      screen
        .getByRole('treeitem', { name: /Root/ })
        .querySelector('[data-part="tree-node-caret"]')!,
    );
    const part1 = await screen.findByRole('treeitem', { name: /Part 1/ });
    // The branch is closed until navigated onto.
    expect(screen.queryByRole('treeitem', { name: /Section 1.1/ })).toBeNull();

    // Selecting the branch (a real navigation) opens its own children.
    fireEvent.click(part1);
    expect(
      await screen.findByRole('treeitem', { name: /Section 1.1/ }),
    ).toBeInTheDocument();

    // A sibling branch that was never navigated to stays closed.
    expect(
      screen.queryByRole('treeitem', { name: /Section 2.1/ }),
    ).toBeNull();
  });
});
