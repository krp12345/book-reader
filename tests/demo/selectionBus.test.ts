/**
 * selectionBus — the decoupled staging channel behind the "Text selection" demo.
 * Verifies the stage / unstage / menu semantics the right-click context menu
 * relies on (pure module state; no DOM).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { selectionBus, type SelectionCore } from '../../demo/selectionBus';

const core = (over: Partial<SelectionCore> = {}): SelectionCore => ({
  nodeId: 'n1',
  nodeTitle: 'Node 1',
  category: 'history',
  text: 'hello',
  start: 0,
  end: 5,
  ...over,
});

beforeEach(() => {
  selectionBus.clear();
  selectionBus.closeMenu();
});

describe('demo/selectionBus — staging', () => {
  it('stage() appends a staged entry carrying id + node metadata', () => {
    selectionBus.stage(core({ nodeId: 'n1', category: 'theory', text: 'abc' }));
    const list = selectionBus.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      nodeId: 'n1',
      nodeTitle: 'Node 1',
      category: 'theory',
      text: 'abc',
    });
    expect(list[0]!.id).toBeTruthy();
  });

  it('unstage() removes the matching entry', () => {
    selectionBus.stage(core({ text: 'one' }));
    selectionBus.stage(core({ text: 'two' }));
    const id = selectionBus.list()[0]!.id;
    selectionBus.unstage(id);
    expect(selectionBus.list().map((s) => s.text)).toEqual(['two']);
  });

  it('rangesFor() returns id-tagged ranges scoped to one node', () => {
    selectionBus.stage(core({ nodeId: 'n1', start: 0, end: 3 }));
    selectionBus.stage(core({ nodeId: 'n2', start: 5, end: 9 }));
    const ranges = selectionBus.rangesFor('n1');
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toMatchObject({ start: 0, end: 3 });
    expect(ranges[0]!.id).toBe(selectionBus.list()[0]!.id);
  });

  it('notifies subscribers on stage/unstage/clear', () => {
    const seen: number[] = [];
    const unsub = selectionBus.subscribe((items) => seen.push(items.length));
    selectionBus.stage(core());
    selectionBus.stage(core());
    selectionBus.unstage(selectionBus.list()[0]!.id);
    selectionBus.clear();
    unsub();
    expect(seen).toEqual([1, 2, 1, 0]);
  });
});

describe('demo/selectionBus — context menu', () => {
  it('openMenu/closeMenu drive the transient menu + notify subscribers', () => {
    const seen: (string | null)[] = [];
    const unsub = selectionBus.subscribeMenu((m) => seen.push(m?.kind ?? null));
    selectionBus.openMenu({ kind: 'fresh', x: 1, y: 2, selection: core() });
    expect(selectionBus.getMenu()?.kind).toBe('fresh');
    selectionBus.closeMenu();
    expect(selectionBus.getMenu()).toBeNull();
    unsub();
    expect(seen).toEqual(['fresh', null]);
  });

  it('staging or unstaging closes an open menu', () => {
    selectionBus.openMenu({ kind: 'fresh', x: 0, y: 0, selection: core() });
    selectionBus.stage(core());
    expect(selectionBus.getMenu()).toBeNull();

    const id = selectionBus.list()[0]!.id;
    selectionBus.openMenu({ kind: 'staged', x: 0, y: 0, stagedId: id });
    selectionBus.unstage(id);
    expect(selectionBus.getMenu()).toBeNull();
  });
});
