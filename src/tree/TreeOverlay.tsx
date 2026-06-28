import {
  useEffect,
  useRef,
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export interface TreeOverlayProps {
  /** Dismiss the overlay. */
  onClose: () => void;
  /** Element to restore focus to on close (the toggle that opened it). */
  returnFocusTo?: HTMLElement | null | undefined;
  /** Tree side — the popover aligns to this edge of the toggle. */
  treeSide: 'left' | 'right';
  /** Popover width (a resolved CSS length). */
  width: string;
  /** Popover minimum width (a resolved CSS length) — keeps it readable when narrow. */
  minWidth?: string | undefined;
  /** Popover minimum height (a resolved CSS length) — keeps it usable when short. */
  minHeight?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Default floated tree container: a popover anchored directly below the toggle
 * button (its parent `[data-part='tree-toggle-bar']` is the positioning
 * context). It is its own stacking context (`isolation:isolate` + z-index) and
 * lives inside the reader subtree, so the skin's scoped selectors + `--reader-*`
 * tokens reach it without a portal.
 *
 * Owns the dialog a11y: focus moves to the *current reading position* on open
 * (so it reads as "the tree, where you are"), Esc closes, an outside click
 * closes, and focus returns to the toggle on unmount.
 */
export function TreeOverlay(props: TreeOverlayProps): JSX.Element {
  const { onClose, treeSide, width, minWidth, minHeight, className, children } =
    props;
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef(props.returnFocusTo ?? null);
  returnFocusRef.current = props.returnFocusTo ?? returnFocusRef.current;

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

  const style: CSSProperties = {
    position: 'absolute',
    top: '100%',
    [treeSide === 'right' ? 'right' : 'left']: 0,
    marginBlockStart: 4,
    width,
    ...(minWidth ? { minWidth } : {}),
    ...(minHeight ? { minHeight } : {}),
    maxWidth: '90vw',
    maxHeight: '70vh',
    overflow: 'auto',
    zIndex: 10,
    isolation: 'isolate',
    outline: 'none',
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Book sections"
      data-part="tree-overlay"
      className={className}
      tabIndex={-1}
      style={style}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
