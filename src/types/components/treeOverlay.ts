import type { ReactNode } from 'react';

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
