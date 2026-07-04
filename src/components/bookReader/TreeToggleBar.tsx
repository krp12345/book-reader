import type { JSX, ReactNode } from 'react';
import type {
  BookReaderClassNames,
  RenderTreeOverlay,
  RenderTreeToggle,
  TreeToggleApi,
} from '../../types';
import { cx } from '../../utils/common/cx';
import { TreeOverlay } from '../tree/overlay/TreeOverlay';

export interface TreeToggleBarProps {
  treeSide: 'left' | 'right';
  renderTreeToggle?: RenderTreeToggle | undefined;
  toggleApi: TreeToggleApi;
  classNames?: BookReaderClassNames | undefined;
  overlayOpen: boolean;
  renderTreeOverlay?: RenderTreeOverlay | undefined;
  closeOverlay: () => void;
  returnFocusEl: HTMLElement | null;
  width: string;
  overlayMinWidth?: string | undefined;
  overlayMinHeight?: string | undefined;
  children: ReactNode;
}

export function TreeToggleBar(props: TreeToggleBarProps): JSX.Element {
  const {
    treeSide,
    renderTreeToggle,
    toggleApi,
    classNames,
    overlayOpen,
    renderTreeOverlay,
    closeOverlay,
    returnFocusEl,
    width,
    overlayMinWidth,
    overlayMinHeight,
    children,
  } = props;

  return (
    <div
      data-part="tree-toggle-bar"
      style={{
        flex: '0 0 auto',
        position: 'relative',
        display: 'flex',
        justifyContent: treeSide === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      {renderTreeToggle ? (
        renderTreeToggle(toggleApi)
      ) : (
        <button
          type="button"
          data-part="tree-toggle"
          className={cx('br-tree-toggle', classNames?.treeToggle)}
          aria-haspopup="dialog"
          aria-expanded={overlayOpen}
          onClick={toggleApi.toggle}
        >
          {toggleApi.label}
        </button>
      )}
      {overlayOpen &&
        (renderTreeOverlay ? (
          renderTreeOverlay({ close: closeOverlay, children })
        ) : (
          <TreeOverlay
            onClose={closeOverlay}
            returnFocusTo={returnFocusEl}
            treeSide={treeSide}
            width={width}
            minWidth={overlayMinWidth}
            minHeight={overlayMinHeight}
            className={cx('br-tree-overlay', classNames?.treeOverlay)}
          >
            {children}
          </TreeOverlay>
        ))}
    </div>
  );
}
