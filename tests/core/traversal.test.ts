import { describe, it, expect } from 'vitest';
import { createTreeStore } from '../../src/core/tree/treeStore';
import { createReadingOrder } from '../../src/core/tree/traversal';
import type { BookNode } from '../../src/types';

// The book used across most tests. Pre-order (depth-first) reading order is:
//   root → ch1 → ch1a → ch1b → ch2
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
        { id: 'ch1a', title: '1.a' },
        { id: 'ch1b', title: '1.b' },
      ],
    },
    { id: 'ch2', title: 'Chapter 2' },
  ],
};

/** Collect the full forward order by following getNext from getFirst. */
function forwardOrder(order: ReturnType<typeof createReadingOrder>): string[] {
  const out: string[] = [];
  let id = order.getFirst();
  while (id !== undefined) {
    out.push(id);
    id = order.getNext(id);
  }
  return out;
}

describe('createReadingOrder — depth-first forward order', () => {
  it('visits nodes in pre-order: parent before children, children left-to-right', () => {
    const store = createTreeStore({ tree: sampleTree });
    const order = createReadingOrder(store);
    expect(forwardOrder(order)).toEqual(['root', 'ch1', 'ch1a', 'ch1b', 'ch2']);
  });

  it('descends into the first child before moving to a sibling', () => {
    const store = createTreeStore({ tree: sampleTree });
    const order = createReadingOrder(store);
    expect(order.getNext('ch1')).toBe('ch1a');
  });

  it('climbs to an ancestor’s next sibling when a subtree is exhausted', () => {
    const store = createTreeStore({ tree: sampleTree });
    const order = createReadingOrder(store);
    // ch1b is the last child of ch1; next in reading order is ch1's sibling ch2.
    expect(order.getNext('ch1b')).toBe('ch2');
  });

  it('returns undefined past the very last node', () => {
    const store = createTreeStore({ tree: sampleTree });
    const order = createReadingOrder(store);
    expect(order.getNext('ch2')).toBeUndefined();
  });
});

describe('createReadingOrder — backward order', () => {
  it('is the exact inverse of forward order', () => {
    const store = createTreeStore({ tree: sampleTree });
    const order = createReadingOrder(store);
    const forward = ['root', 'ch1', 'ch1a', 'ch1b', 'ch2'];
    for (let i = 1; i < forward.length; i++) {
      const node = forward[i];
      const prev = forward[i - 1];
      if (node === undefined || prev === undefined) continue;
      expect(order.getPrev(node)).toBe(prev);
    }
  });

  it('steps from a node to its previous sibling’s deepest last descendant', () => {
    const store = createTreeStore({ tree: sampleTree });
    const order = createReadingOrder(store);
    // Before ch2 comes ch1's deepest last descendant: ch1b.
    expect(order.getPrev('ch2')).toBe('ch1b');
  });

  it('steps up to the parent when there is no previous sibling', () => {
    const store = createTreeStore({ tree: sampleTree });
    const order = createReadingOrder(store);
    expect(order.getPrev('ch1a')).toBe('ch1');
  });

  it('returns undefined before the very first node', () => {
    const store = createTreeStore({ tree: sampleTree });
    const order = createReadingOrder(store);
    expect(order.getPrev('root')).toBeUndefined();
  });
});

describe('createReadingOrder — first / last', () => {
  it('first is the first root, last is the deepest last descendant', () => {
    const store = createTreeStore({ tree: sampleTree });
    const order = createReadingOrder(store);
    expect(order.getFirst()).toBe('root');
    expect(order.getLast()).toBe('ch2');
  });
});

describe('createReadingOrder — getSequence', () => {
  it('returns every node id once, in forward reading order', () => {
    const store = createTreeStore({ tree: sampleTree });
    const order = createReadingOrder(store);
    expect(order.getSequence()).toEqual(['root', 'ch1', 'ch1a', 'ch1b', 'ch2']);
  });

  it('matches following getNext from getFirst', () => {
    const store = createTreeStore({ tree: sampleTree });
    const order = createReadingOrder(store);
    expect(order.getSequence()).toEqual(forwardOrder(order));
  });

  it('spans a forest of roots', () => {
    const store = createTreeStore({
      tree: [
        { id: 'a', title: 'A', children: [{ id: 'a1', title: 'A1' }] },
        { id: 'b', title: 'B' },
      ],
    });
    const order = createReadingOrder(store);
    expect(order.getSequence()).toEqual(['a', 'a1', 'b']);
  });

  it('is empty for an empty store', () => {
    const order = createReadingOrder(createTreeStore());
    expect(order.getSequence()).toEqual([]);
  });
});

describe('createReadingOrder — forest of roots', () => {
  const forest: BookNode[] = [
    { id: 'a', title: 'A', children: [{ id: 'a1', title: 'A1' }] },
    { id: 'b', title: 'B' },
  ];

  it('reads across roots in order', () => {
    const store = createTreeStore({ tree: forest });
    const order = createReadingOrder(store);
    expect(forwardOrder(order)).toEqual(['a', 'a1', 'b']);
    expect(order.getNext('a1')).toBe('b');
    expect(order.getPrev('b')).toBe('a1');
    expect(order.getFirst()).toBe('a');
    expect(order.getLast()).toBe('b');
  });
});

describe('createReadingOrder — edges', () => {
  it('returns undefined for unknown ids', () => {
    const store = createTreeStore({ tree: sampleTree });
    const order = createReadingOrder(store);
    expect(order.getNext('nope')).toBeUndefined();
    expect(order.getPrev('nope')).toBeUndefined();
  });

  it('handles an empty store', () => {
    const store = createTreeStore();
    const order = createReadingOrder(store);
    expect(order.getFirst()).toBeUndefined();
    expect(order.getLast()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Cross-branch reading order (the "click a deep node, then scroll" scenario).
//
// A deep, multi-branch book — 3 Parts × 3 Chapters × 4 Sections. Parts and
// Chapters are organisational (`hasContent:false`); only Sections carry content.
// The reader shows *content* nodes, so the effective neighbour of a section is
// the previous/next *section* in depth-first order — even across Part/Chapter
// boundaries. This is what makes "click §2.1.1, scroll up ⇒ §1.3.4" (last
// section of the previous Part) and "click §2.3.4, scroll down ⇒ §3.1.1" (first
// section of the next Part) behave correctly. This mirrors ContentPane's `ids`.
// ---------------------------------------------------------------------------
const PARTS = 3;
const CH = 3;
const SEC = 4;
const sec = (p: number, c: number, s: number): string =>
  `d.p${p}.c${c}.s${s}`;

function deepBook(): BookNode {
  return {
    id: 'd',
    title: 'Deep Book',
    hasContent: false, // organisational root
    children: Array.from({ length: PARTS }, (_, p) => ({
      id: `d.p${p}`,
      title: `Part ${p + 1}`,
      hasContent: false,
      children: Array.from({ length: CH }, (_, c) => ({
        id: `d.p${p}.c${c}`,
        title: `Chapter ${p + 1}.${c + 1}`,
        hasContent: false,
        children: Array.from({ length: SEC }, (_, s) => ({
          id: sec(p, c, s),
          title: `§${p + 1}.${c + 1}.${s + 1}`,
        })),
      })),
    })),
  };
}

/** The reader's content order: DFS sequence filtered to content-bearing nodes. */
function contentSequence(store: ReturnType<typeof createTreeStore>): string[] {
  const order = createReadingOrder(store);
  return order
    .getSequence()
    .filter((id) => store.getNode(id)?.hasContent !== false);
}

describe('createReadingOrder — cross-branch content navigation', () => {
  const store = createTreeStore({ tree: deepBook() });
  const seq = contentSequence(store);
  const prevOf = (id: string): string | undefined => seq[seq.indexOf(id) - 1];
  const nextOf = (id: string): string | undefined => seq[seq.indexOf(id) + 1];

  it('content order is exactly the sections in depth-first Part→Chapter→Section order', () => {
    const expected: string[] = [];
    for (let p = 0; p < PARTS; p++)
      for (let c = 0; c < CH; c++)
        for (let s = 0; s < SEC; s++) expected.push(sec(p, c, s));
    expect(seq).toEqual(expected);
  });

  it('scrolling up from a Part’s first section lands on the previous Part’s LAST section', () => {
    // §2.1.1 ← previous ← §1.3.4 (last section of Part 1). The organisational
    // Part/Chapter nodes in between are skipped.
    expect(prevOf(sec(1, 0, 0))).toBe(sec(0, CH - 1, SEC - 1));
    // …and Part 3’s first section reaches back to Part 2’s last section.
    expect(prevOf(sec(2, 0, 0))).toBe(sec(1, CH - 1, SEC - 1));
  });

  it('scrolling down from a Part’s last section lands on the next Part’s FIRST section', () => {
    // §2.3.4 → next → §3.1.1 (first section of Part 3).
    expect(nextOf(sec(1, CH - 1, SEC - 1))).toBe(sec(2, 0, 0));
    // …and Part 1’s last section advances into Part 2’s first section.
    expect(nextOf(sec(0, CH - 1, SEC - 1))).toBe(sec(1, 0, 0));
  });

  it('crosses Chapter boundaries within a Part too', () => {
    // First section of Chapter 2.2 ← previous ← last section of Chapter 2.1.
    expect(prevOf(sec(1, 1, 0))).toBe(sec(1, 0, SEC - 1));
    expect(nextOf(sec(1, 0, SEC - 1))).toBe(sec(1, 1, 0));
  });

  it('the very first/last sections have no previous/next (start/end of book)', () => {
    expect(prevOf(sec(0, 0, 0))).toBeUndefined();
    expect(nextOf(sec(PARTS - 1, CH - 1, SEC - 1))).toBeUndefined();
  });
});

