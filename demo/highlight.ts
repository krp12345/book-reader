/**
 * highlight — pure DOM helpers that paint persistent <mark> highlights onto a
 * content node's prose, used by the "Text selection" demo (example 7).
 *
 * Why this exists: the reader **virtualizes**, so a section's DOM is destroyed
 * when it scrolls out of view and recreated when it scrolls back. The native
 * browser selection can't survive that. So instead of relying on the live
 * selection, we record each staged selection as a **character range** and
 * re-paint it (`applyHighlights`) every time the node (re)mounts.
 *
 * Offset model: the concatenation of every descendant text node's value, in
 * document order, with **no** separators between blocks. Both the capture side
 * (`pointOffset`) and the paint side (`wrapRange`) use exactly this model, so an
 * offset captured against one render is valid against an identical later render.
 */
export interface OffsetRange {
  start: number;
  end: number;
}

/** An `OffsetRange` tagged with the staged-selection id it belongs to, so a
 *  painted `<mark>` can be mapped back to its staged entry (e.g. to unstage it
 *  from a right-click). */
export interface HighlightRange extends OffsetRange {
  id?: string;
}

/**
 * Character offset of a DOM boundary point `(container, offset)` within `root`,
 * in the text-node-concatenation model. Works for text-node *and* element
 * boundaries (uses `cloneContents().textContent`, which — unlike
 * `Selection.toString()`/`innerText` — adds no block separators).
 */
export function pointOffset(root: Node, container: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(container, offset);
  return range.cloneContents().textContent?.length ?? 0;
}

/** Strip every highlight this module injected, restoring the plain text + structure. */
export function unwrapHighlights(root: Element): void {
  root.querySelectorAll('mark[data-sel-highlight]').forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });
  // Merge the text nodes we split, so offsets stay consistent for the next pass.
  root.normalize();
}

/** Wrap the half-open [start, end) character range in a `<mark>` (may span tags). */
export function wrapRange(
  root: Element,
  start: number,
  end: number,
  id?: string,
): void {
  if (end <= start) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: { node: Text; from: number; to: number }[] = [];
  let pos = 0;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const len = node.data.length;
    const s = Math.max(start, pos);
    const e = Math.min(end, pos + len);
    if (s < e) targets.push({ node, from: s - pos, to: e - pos });
    pos += len;
    if (pos >= end) break;
    node = walker.nextNode() as Text | null;
  }
  // Mutate after walking so splits don't disturb the in-progress traversal.
  for (const { node: textNode, from, to } of targets) {
    let target = textNode;
    if (from > 0) target = target.splitText(from);
    if (to - from < target.data.length) target.splitText(to - from);
    const mark = document.createElement('mark');
    mark.setAttribute('data-sel-highlight', '');
    if (id !== undefined) mark.setAttribute('data-sel-id', id);
    mark.className = 'sel-highlight';
    target.parentNode?.insertBefore(mark, target);
    mark.appendChild(target);
  }
}

/** Re-paint `ranges` from scratch: clear any existing highlights, then wrap each. */
export function applyHighlights(
  root: Element,
  ranges: readonly HighlightRange[],
): void {
  unwrapHighlights(root);
  for (const r of ranges) wrapRange(root, r.start, r.end, r.id);
}
