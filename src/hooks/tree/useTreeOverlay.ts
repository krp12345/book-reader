import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { TreeOverlayState, UseTreeOverlayOptions } from '../../types/hooks';

export type { TreeOverlayState, UseTreeOverlayOptions } from '../../types/hooks';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The floated tree popover's dialog behavior: focus moves to the *current
 * reading position* on open (so it reads as "the tree, where you are"), Esc
 * closes, an outside click closes, and focus returns to the toggle on unmount.
 * The component only renders the positioned container.
 */
export function useTreeOverlay(options: UseTreeOverlayOptions): TreeOverlayState {
  const { onClose } = options;
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef(options.returnFocusTo ?? null);
  returnFocusRef.current = options.returnFocusTo ?? returnFocusRef.current;

  // On open: move focus to the active (selected) row and scroll it into view so
  // the tree opens "as if it was never collapsed" — at the current position.
  useEffect(() => {
    const panel = panelRef.current;
    const selected = panel?.querySelector<HTMLElement>(
      '[data-part="tree-node"][data-selected]',
    );
    const target = selected ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    (target ?? panel)?.focus();
    selected?.scrollIntoView({ block: 'nearest' });
    return () => {
      returnFocusRef.current?.focus();
    };
  }, []);

  // An outside click (anywhere not within the toggle bar) dismisses the popover.
  useEffect(() => {
    function onDocMouseDown(event: MouseEvent): void {
      const bar = panelRef.current?.closest('[data-part="tree-toggle-bar"]');
      if (bar && !bar.contains(event.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [onClose]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  }

  return { panelRef, onKeyDown };
}
