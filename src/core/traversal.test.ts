import { describe, it, expect } from 'vitest';
import { createTreeStore } from './treeStore';
import { createReadingOrder } from './traversal';
import type { BookNode } from '../types';

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

  it('stops at an unloaded expandable node, then descends once loaded', () => {
    const store = createTreeStore({
      tree: {
        id: 'root',
        title: 'Root',
        children: [{ id: 'lazy', title: 'Lazy', hasChildren: true }],
      },
    });
    const order = createReadingOrder(store);
    expect(order.getSequence()).toEqual(['root', 'lazy']);
    store.setChildren('lazy', [{ id: 'kid', title: 'Kid' }]);
    expect(order.getSequence()).toEqual(['root', 'lazy', 'kid']);
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

describe('createReadingOrder — lazy trees reflect current knowledge', () => {
  it('treats an unloaded expandable node as a leaf until its children arrive', () => {
    const store = createTreeStore({
      tree: {
        id: 'root',
        title: 'Root',
        children: [
          { id: 'lazy', title: 'Lazy', hasChildren: true },
          { id: 'after', title: 'After' },
        ],
      },
    });
    const order = createReadingOrder(store);
    // Children of `lazy` aren't known yet, so we cannot descend into it.
    expect(order.getNext('lazy')).toBe('after');

    store.setChildren('lazy', [{ id: 'kid', title: 'Kid' }]);
    // Now descent is possible.
    expect(order.getNext('lazy')).toBe('kid');
    expect(order.getNext('kid')).toBe('after');
  });
});
