import { describe, it, expect } from 'vitest';
import { createTreeStore } from '../../src/core/tree/treeStore';
import { flattenVisible } from '../../src/core/tree/flatten';
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
        { id: 'ch1a', title: '1.a' },
        { id: 'ch1b', title: '1.b' },
      ],
    },
    { id: 'ch2', title: 'Chapter 2' },
  ],
};

describe('flattenVisible', () => {
  it('lists only roots (depth 0) when nothing is expanded', () => {
    const store = createTreeStore({ tree: sampleTree });
    expect(flattenVisible(store, new Set())).toEqual([
      { kind: 'node', id: 'root', depth: 0 },
    ]);
  });

  it('reveals the children of expanded nodes at increasing depth', () => {
    const store = createTreeStore({ tree: sampleTree });
    expect(flattenVisible(store, new Set(['root']))).toEqual([
      { kind: 'node', id: 'root', depth: 0 },
      { kind: 'node', id: 'ch1', depth: 1 },
      { kind: 'node', id: 'ch2', depth: 1 },
    ]);
  });

  it('descends recursively through nested expanded nodes', () => {
    const store = createTreeStore({ tree: sampleTree });
    expect(flattenVisible(store, new Set(['root', 'ch1']))).toEqual([
      { kind: 'node', id: 'root', depth: 0 },
      { kind: 'node', id: 'ch1', depth: 1 },
      { kind: 'node', id: 'ch1a', depth: 2 },
      { kind: 'node', id: 'ch1b', depth: 2 },
      { kind: 'node', id: 'ch2', depth: 1 },
    ]);
  });

  it('does not descend into a childless node even if it is in the expanded set', () => {
    const store = createTreeStore({
      tree: { id: 'root', title: 'Root' },
    });
    // "root" is in the expanded set, but it has no children to reveal.
    expect(flattenVisible(store, new Set(['root']))).toEqual([
      { kind: 'node', id: 'root', depth: 0 },
    ]);
  });

  it('returns an empty list for an empty store', () => {
    const store = createTreeStore();
    expect(flattenVisible(store, new Set())).toEqual([]);
  });
});
