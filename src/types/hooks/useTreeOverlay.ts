import type { KeyboardEvent, RefObject } from 'react';

export interface UseTreeOverlayOptions {
  /** Dismiss the overlay. */
  onClose: () => void;
  /** Element to restore focus to on close (the toggle that opened it). */
  returnFocusTo?: HTMLElement | null | undefined;
}

export interface TreeOverlayState {
  panelRef: RefObject<HTMLDivElement>;
  /** Esc closes. */
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}
