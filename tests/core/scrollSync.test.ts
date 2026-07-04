import { describe, it, expect } from 'vitest';
import { createTreeStore } from '../../src/core/tree/treeStore';
import { createReadingOrder } from '../../src/core/tree/traversal';
import type { NodeSpan } from '../../src/types/core';
import type { GetNextNode, GetPrevNode, BookNode } from '../../src/types';
import {
  activeNodeAt,
  isNearBottom,
  withReadingOverrides,
} from '../../src/core/content/scrollSync';

const spans: NodeSpan[] = [
  { id: 'a', start: 0, height: 100 },
  { id: 'b', start: 100, height: 100 },
  { id: 'c', start: 200, height: 100 },
];

describe('activeNodeAt — which node the reference line sits in', () => {
  it('returns the node whose span contains the reference line', () => {
    expect(activeNodeAt(spans, 0)).toBe('a');
    expect(activeNodeAt(spans, 50)).toBe('a');
    expect(activeNodeAt(spans, 100)).toBe('b');
    expect(activeNodeAt(spans, 150)).toBe('b');
    expect(activeNodeAt(spans, 250)).toBe('c');
  });

  it('clamps a reference line above the last node to the last node', () => {
    expect(activeNodeAt(spans, 99999)).toBe('c');
  });

  it('clamps a negative reference line to the first node', () => {
    expect(activeNodeAt(spans, -42)).toBe('a');
  });

  it('returns undefined for an empty span list', () => {
    expect(activeNodeAt([], 0)).toBeUndefined();
  });
});

describe('isNearBottom — bottom-approach detection', () => {
  it('is true once the viewport bottom is within the threshold of the end', () => {
    // total 1000, viewport 300, threshold 100.
    expect(isNearBottom(600, 300, 1000, 100)).toBe(true); // gap 100
    expect(isNearBottom(650, 300, 1000, 100)).toBe(true); // gap 50
    expect(isNearBottom(700, 300, 1000, 100)).toBe(true); // at the very bottom
  });

  it('is false when more than the threshold remains below the viewport', () => {
    expect(isNearBottom(500, 300, 1000, 100)).toBe(false); // gap 200
  });

  it('is true when the whole book already fits in the viewport', () => {
    expect(isNearBottom(0, 300, 200, 100)).toBe(true);
  });
});

//   root → ch1 → ch1a → ch1b → ch2  (pre-order)
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

describe('withReadingOverrides — custom reading order', () => {
  it('passes through to the base DFS order when no overrides are given', () => {
    const store = createTreeStore({ tree: sampleTree });
    const order = withReadingOverrides(store, createReadingOrder(store));
    expect(order.getSequence()).toEqual(['root', 'ch1', 'ch1a', 'ch1b', 'ch2']);
    expect(order.getNext('ch1')).toBe('ch1a');
    expect(order.getPrev('ch1a')).toBe('ch1');
  });

  it('uses getNextNode to redefine the forward sequence', () => {
    const store = createTreeStore({ tree: sampleTree });
    // Skip the subsections: root → ch2 → end.
    const getNextNode: GetNextNode = (node) => {
      if (node.id === 'root') return store.getNode('ch2') ?? null;
      return null;
    };
    const order = withReadingOverrides(store, createReadingOrder(store), {
      getNextNode,
    });
    expect(order.getSequence()).toEqual(['root', 'ch2']);
  });

  it('hands the override the node, its path and the direction', () => {
    const store = createTreeStore({ tree: sampleTree });
    const seen: { id: string; path: string[]; direction: string }[] = [];
    const getNextNode: GetNextNode = (node, ctx) => {
      seen.push({ id: node.id, path: ctx.path, direction: ctx.direction });
      return null;
    };
    withReadingOverrides(store, createReadingOrder(store), {
      getNextNode,
    }).getNext('ch1a');
    expect(seen).toEqual([
      { id: 'ch1a', path: ['root', 'ch1'], direction: 'forward' },
    ]);
  });

  it('uses getPrevNode for the backward neighbour', () => {
    const store = createTreeStore({ tree: sampleTree });
    const getPrevNode: GetPrevNode = (node) =>
      node.id === 'ch2' ? (store.getNode('root') ?? null) : null;
    const order = withReadingOverrides(store, createReadingOrder(store), {
      getPrevNode,
    });
    expect(order.getPrev('ch2')).toBe('root');
  });

  it('terminates the sequence even if an override cycles', () => {
    const store = createTreeStore({ tree: sampleTree });
    // Pathological override: every node points back to itself.
    const getNextNode: GetNextNode = (node) => store.getNode(node.id) ?? null;
    const order = withReadingOverrides(store, createReadingOrder(store), {
      getNextNode,
    });
    expect(order.getSequence()).toEqual(['root']);
  });
});
