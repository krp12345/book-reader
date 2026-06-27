import { describe, it, expect } from 'vitest';
import { createTreeStore } from '../../src/core/treeStore';
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

  it('distinguishes a loaded-empty leaf from an unloaded node', () => {
    const store = createTreeStore({ tree: sampleTree });
    // ch2 has no children key at all → a leaf → "loaded" with empty children.
    expect(store.getChildren('ch2')).toEqual([]);
    expect(store.isLoaded('ch2')).toBe(true);
    expect(store.isExpandable('ch2')).toBe(false);
  });

  it('computes the ancestor path root → parent', () => {
    const store = createTreeStore({ tree: sampleTree });
    expect(store.getPath('ch1a')).toEqual(['root', 'ch1']);
    expect(store.getPath('root')).toEqual([]);
  });
});

describe('createTreeStore — lazy tree', () => {
  it('marks hasChildren nodes as expandable but not yet loaded', () => {
    const store = createTreeStore({
      tree: { id: 'root', title: 'Root', hasChildren: true },
    });
    expect(store.isExpandable('root')).toBe(true);
    expect(store.isLoaded('root')).toBe(false);
    expect(store.getChildren('root')).toBeUndefined();
  });

  it('absorbs lazily-loaded children and indexes them', () => {
    const store = createTreeStore({
      tree: { id: 'root', title: 'Root', hasChildren: true },
    });
    store.setChildren('root', [
      { id: 'x', title: 'X' },
      { id: 'y', title: 'Y', hasChildren: true },
    ]);

    expect(store.isLoaded('root')).toBe(true);
    expect(store.getChildren('root')).toEqual(['x', 'y']);
    expect(store.getNode('y')?.title).toBe('Y');
    expect(store.getParentId('x')).toBe('root');
    expect(store.getPath('x')).toEqual(['root']);
    // y was loaded as expandable-but-empty
    expect(store.isExpandable('y')).toBe(true);
    expect(store.isLoaded('y')).toBe(false);
  });
});
