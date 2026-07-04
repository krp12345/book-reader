import type { BookNode } from './node';

export interface TreeNodeState {
  depth: number;
  expandable: boolean;
  expanded: boolean;
  selected: boolean;
}

export type RenderTreeNode<Meta = unknown> = (
  node: BookNode<Meta>,
  state: TreeNodeState,
) => import('react').ReactNode;

/**
 * The control surface handed to `renderExpandCollapse`. Lets a custom
 * disclosure control (chevron, +/− button, twisty, …) drive a row's
 * expand/collapse state. The library still owns the row wrapper,
 * `aria-expanded`, and keyboard nav — the custom control is presentation +
 * the click handler only.
 */
export interface ExpandCollapseApi {
  /** Whether this row has children. */
  expandable: boolean;
  /** Whether this row is currently expanded. */
  expanded: boolean;
  /** This row's depth in the tree (0 = root). */
  depth: number;
  /** Toggle this row open/closed. */
  toggle(): void;
  /** Expand this row. */
  expand(): void;
  /** Collapse this row. */
  collapse(): void;
}

/**
 * Replaces *only* the hard-coded disclosure caret in a tree row. The library
 * keeps `data-part="tree-node-caret"` as the no-JS CSS hook for the default
 * caret; a custom control owns its own markup and wires its `onClick` to the
 * `toggle`/`expand`/`collapse` it receives (call `stopPropagation` to avoid
 * also selecting the row).
 */
export type RenderExpandCollapse = (
  api: ExpandCollapseApi,
) => import('react').ReactNode;

/**
 * The control surface handed to `renderTreeToggle`. Lets a custom collapsed
 * trigger drive the floated tree overlay open/closed.
 */
export interface TreeToggleApi {
  /** Whether the tree overlay is currently open. */
  isOpen: boolean;
  /** Open the tree overlay (a new stacking context). */
  open: () => void;
  /** Close the tree overlay. */
  close: () => void;
  /** Toggle the tree overlay open/closed. */
  toggle: () => void;
  /** The configured `treeCollapseLabel`. */
  label: string;
}

export type RenderTreeToggle = (
  api: TreeToggleApi,
) => import('react').ReactNode;

/**
 * The control surface handed to `renderTreeOverlay`. `children` is the fully
 * wired TreePane (same selection/expansion state as the main tree); the custom
 * container owns its own size/position/stacking and calls `close()` to dismiss.
 */
export interface TreeOverlayApi {
  /** Close the overlay. */
  close: () => void;
  /** The wired tree to render inside your container. */
  children: import('react').ReactNode;
}

export type RenderTreeOverlay = (
  api: TreeOverlayApi,
) => import('react').ReactNode;
