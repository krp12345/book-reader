import type { CSSProperties, JSX, ReactNode } from 'react';
import { useTreeOverlay } from '../../hooks/useTreeOverlay';

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

/**
 * Default floated tree container: a popover anchored directly below the toggle
 * button (its parent `[data-part='tree-toggle-bar']` is the positioning
 * context). It is its own stacking context (`isolation:isolate` + z-index) and
 * lives inside the reader subtree, so the skin's scoped selectors + `--reader-*`
 * tokens reach it without a portal. Purely presentational: the dialog behavior
 * (focus, Esc, outside click) lives in `hooks/useTreeOverlay.ts`.
 */
export function TreeOverlay(props: TreeOverlayProps): JSX.Element {
  const { treeSide, width, minWidth, minHeight, className, children } = props;
  const { panelRef, onKeyDown } = useTreeOverlay(props);

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
