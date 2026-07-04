export interface BookNode<Meta = unknown> {
  id: string;
  title: string;
  children?: BookNode<Meta>[];
  hasContent?: boolean;
  /**
   * Marks a **branch placeholder** whose children are not in the initial tree
   * and are fetched on demand via `fetchChildren` (when the node is expanded in
   * the tree *or* the reading surface scrolls to it). A `lazy` node renders as
   * expandable even with no `children`. If `children` is already provided, the
   * node is treated as pre-resolved and never fetched. `lazy` governs *children
   * acquisition only* — orthogonal to the node's own content (`hasContent`).
   */
  lazy?: boolean;
  meta?: Meta;
}

export type ReadingDirection = 'forward' | 'backward';

/** The status of a `lazy` node's child fetch. */
export type LazyStatus = 'unloaded' | 'loading' | 'loaded' | 'error';
