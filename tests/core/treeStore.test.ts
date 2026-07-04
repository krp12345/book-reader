import { describe, it, expect } from 'vitest';
import { createTreeStore } from '../../src/core/tree/treeStore';
import type { BookNode } from '../../src/types';

// A small fixed book used across the sync tests.
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

describe('createTreeStore — sync tree', () => {
  it('indexes every node by id', () => {
    const store = createTreeStore({ tree: sampleTree });
    expect(store.getNode('root')?.title).toBe('Root');
    expect(store.getNode('ch1a')?.title).toBe('1.a');
    expect(store.getNode('missing')).toBeUndefined();
  });

  it('exposes root ids in order', () => {
    const store = createTreeStore({ tree: sampleTree });
    expect(store.getRootIds()).toEqual(['root']);
  });

  it('accepts an array of roots (forest)', () => {
    const store = createTreeStore({
      tree: [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
      ],
    });
    expect(store.getRootIds()).toEqual(['a', 'b']);
  });

  it('returns ordered children, and parent links', () => {
    const store = createTreeStore({ tree: sampleTree });
    expect(store.getChildren('ch1')).toEqual(['ch1a', 'ch1b']);
    expect(store.getParentId('ch1a')).toBe('ch1');
    expect(store.getParentId('root')).toBeUndefined();
  });

  it('treats a node with no children key as a non-expandable leaf', () => {
    const store = createTreeStore({ tree: sampleTree });
    // ch2 has no children key at all → a leaf with empty children.
    expect(store.getChildren('ch2')).toEqual([]);
    expect(store.isExpandable('ch2')).toBe(false);
  });

  it('computes the ancestor path root → parent', () => {
    const store = createTreeStore({ tree: sampleTree });
    expect(store.getPath('ch1a')).toEqual(['root', 'ch1']);
    expect(store.getPath('root')).toEqual([]);
  });
});
