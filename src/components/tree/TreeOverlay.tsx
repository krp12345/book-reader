import type { CSSProperties, JSX } from 'react';
import { useTreeOverlay } from '../../hooks/useTreeOverlay';
import type { TreeOverlayProps } from '../../types/components';

export type { TreeOverlayProps } from '../../types/components';

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
