import { describe, it, expect } from 'vitest';
import { createTreeStore } from '../core/treeStore';
import { flattenVisible } from './flatten';
import type { BookNode } from '../types';

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
    expect(flattenVisible(store, new Set())).toEqual([{ id: 'root', depth: 0 }]);
  });

  it('reveals the children of expanded nodes at increasing depth', () => {
    const store = createTreeStore({ tree: sampleTree });
    expect(flattenVisible(store, new Set(['root']))).toEqual([
      { id: 'root', depth: 0 },
      { id: 'ch1', depth: 1 },
      { id: 'ch2', depth: 1 },
    ]);
  });

  it('descends recursively through nested expanded nodes', () => {
    const store = createTreeStore({ tree: sampleTree });
    expect(flattenVisible(store, new Set(['root', 'ch1']))).toEqual([
      { id: 'root', depth: 0 },
      { id: 'ch1', depth: 1 },
      { id: 'ch1a', depth: 2 },
      { id: 'ch1b', depth: 2 },
      { id: 'ch2', depth: 1 },
    ]);
  });

  it('does not descend into a node marked expanded but not yet loaded', () => {
    const store = createTreeStore({
      tree: { id: 'root', title: 'Root', hasChildren: true },
    });
    // "root" is in the expanded set, but its children haven't loaded.
    expect(flattenVisible(store, new Set(['root']))).toEqual([
      { id: 'root', depth: 0 },
    ]);
  });

  it('returns an empty list for an empty store', () => {
    const store = createTreeStore();
    expect(flattenVisible(store, new Set())).toEqual([]);
  });
});
