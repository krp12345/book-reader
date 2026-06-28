/**
 * selectionBus — a tiny, decoupled staging channel used by the "Text selection"
 * demo (example 7).
 *
 * The point of the example: a custom content-node renderer (`renderContentNode`,
 * rendered *inside* <BookReader>) lets the user select text in many places and
 * **stage** each selection — without any prop/callback wiring back to the host.
 * Selections are published here; the outside UI (a staged list + a "show all"
 * button that have no reference to the reader) reads them back. This module *is*
 * the "somewhere" the messages are sent to.
 *
 * Each selection carries both its **text** and the **node** it came from — id,
 * title, and `meta` (proving `renderContentNode` gets the full node metadata) —
 * plus the character `start`/`end` range used to re-paint the highlight after
 * virtualization unmounts and remounts the section.
 *
 * Two streams:
 *  - **menu**: the transient right-click context menu (over a fresh selection, or
 *    over an already-staged highlight). At most one open at a time.
 *  - **staged**: the durable set the user is building up; supports unstaging.
 */
import type { HighlightRange } from './highlight';

export interface SelectionCore {
  /** The id of the book node the selection came from. */
  nodeId: string;
  /** That node's title (tracked alongside the id). */
  nodeTitle: string;
  /** A field pulled from the node's `meta` — proof metadata reaches the renderer. */
  category: string;
  /** The exact text the user selected. */
  text: string;
  /** Character range within the node body (text-node-concat model). */
  start: number;
  end: number;
}

export interface StagedSelection extends SelectionCore {
  /** Stable id for list keys + unstaging. */
  id: string;
  /** When it was staged (epoch ms). */
  at: number;
}

/** Right-click over a fresh (not-yet-staged) selection → offers Stage / Deselect. */
export interface FreshMenu {
  kind: 'fresh';
  x: number;
  y: number;
  selection: SelectionCore;
}
/** Right-click over an already-staged highlight → offers Unstage. */
export interface StagedMenu {
  kind: 'staged';
  x: number;
  y: number;
  stagedId: string;
}
export type SelMenu = FreshMenu | StagedMenu;

type StagedListener = (items: StagedSelection[]) => void;
type MenuListener = (menu: SelMenu | null) => void;

const staged: StagedSelection[] = [];
const stagedListeners = new Set<StagedListener>();

let menu: SelMenu | null = null;
const menuListeners = new Set<MenuListener>();

let seq = 0;

function emitStaged(): void {
  const snapshot = [...staged];
  stagedListeners.forEach((l) => l(snapshot));
}

function setMenu(m: SelMenu | null): void {
  menu = m;
  menuListeners.forEach((l) => l(menu));
}

export const selectionBus = {
  // --- context menu (transient) ----------------------------------------------
  openMenu: setMenu,
  closeMenu(): void {
    if (menu !== null) setMenu(null);
  },
  getMenu(): SelMenu | null {
    return menu;
  },
  subscribeMenu(l: MenuListener): () => void {
    menuListeners.add(l);
    return () => {
      menuListeners.delete(l);
    };
  },

  // --- staged (durable set the outside UI reads) -----------------------------
  /** Move a selection into the staged set (and close the menu). */
  stage(sel: SelectionCore): void {
    staged.push({ ...sel, id: `sel-${++seq}`, at: Date.now() });
    setMenu(null);
    emitStaged();
  },
  /** Remove an already-staged selection (and close the menu). */
  unstage(id: string): void {
    const i = staged.findIndex((s) => s.id === id);
    if (i >= 0) {
      staged.splice(i, 1);
      setMenu(null);
      emitStaged();
    }
  },
  /** Drop everything. */
  clear(): void {
    staged.length = 0;
    emitStaged();
  },
  list(): StagedSelection[] {
    return [...staged];
  },
  /** The highlight ranges to re-paint for a given node (used on remount); each
   *  tagged with its staged id so a painted mark can be unstaged on right-click. */
  rangesFor(nodeId: string): HighlightRange[] {
    return staged
      .filter((s) => s.nodeId === nodeId)
      .map((s) => ({ start: s.start, end: s.end, id: s.id }));
  },
  subscribe(l: StagedListener): () => void {
    stagedListeners.add(l);
    return () => {
      stagedListeners.delete(l);
    };
  },
};
