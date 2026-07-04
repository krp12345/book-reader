import { lengthToPx } from './length';

/**
 * The responsive-collapse decision: the tree pane collapses to a toggle +
 * overlay when forced (`true`/`'always'`), or — in `'auto'` mode — when the
 * measured reader width can't fit the tree *and* the reading-surface floor
 * (reading width wins). An unmeasured root (width 0) never auto-collapses.
 */
export function shouldCollapseTree(input: {
  collapseTree: 'auto' | 'always' | 'never' | boolean;
  rootWidth: number;
  treeWidth: number | string;
  contentMinWidth: number | string;
}): boolean {
  const { collapseTree, rootWidth, treeWidth, contentMinWidth } = input;
  const forceCollapsed = collapseTree === true || collapseTree === 'always';
  const forceExpanded = collapseTree === false || collapseTree === 'never';
  return (
    forceCollapsed ||
    (!forceExpanded &&
      rootWidth > 0 &&
      rootWidth - lengthToPx(treeWidth) < lengthToPx(contentMinWidth))
  );
}
