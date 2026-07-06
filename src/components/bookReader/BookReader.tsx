import type { JSX } from 'react';
import { useBookReader } from '../../hooks/bookReader/useBookReader';
import { cx } from '../../utils/common/cx';
import { TreePaneView } from '../tree/view/TreePaneView';
import { TreeSearch } from '../tree/search/TreeSearch';
import { ContentPane } from '../content/ContentPane';
import { TreeToggleBar } from './TreeToggleBar';
import type { BookReaderProps } from '../../types';

/**
 * The two-pane reader shell. Purely presentational: every behavior (store +
 * cache ownership, lazy resolution, location, search/reset, responsive
 * collapse, overlay state) lives in `hooks/bookReader/useBookReader.ts` — this component
 * only composes the panes.
 */
export function BookReader<Meta = unknown, Content = string>(
  props: BookReaderProps<Meta, Content>,
): JSX.Element {
  const {
    fetchContent,
    onReset,
    searchPlaceholder,
    renderSearch,
    prefetchCount,
    getNextNode,
    getPrevNode,
    treeSide = 'left',
    renderTreeToggle,
    renderTreeOverlay,
    sanitize,
    overscan,
    estimateHeight,
    className,
    classNames,
    renderTreeNode,
    renderExpandCollapse,
    renderContent,
    renderContentNode,
    renderLoading,
    renderError,
    renderEmpty,
    renderNoData,
  } = props;

  const {
    store,
    cache,
    treeState,
    ensureLazy,
    searching,
    searchError,
    handleSearch,
    handleReset,
    searchVisible,
    scrollRequest,
    handleActiveChange,
    rootRef,
    collapsed,
    overlayOpen,
    closeOverlay,
    toggleApi,
    returnFocusEl,
    width,
    overlayMinWidth,
    overlayMinHeight,
  } = useBookReader<Meta, Content>(props);

  // The wired tree — shared by the inline pane and the floated overlay so both
  // reflect the same selection/expansion state. The optional search box sits on
  // top; while a search/reset runs the old tree is replaced by a loading panel.
  const treeView = (
    <>
      {searchVisible && (
        <TreeSearch
          onSearch={handleSearch}
          onReset={onReset !== undefined ? handleReset : undefined}
          isSearching={searching}
          error={searchError}
          placeholder={searchPlaceholder}
          renderSearch={renderSearch}
          className={classNames?.search}
        />
      )}
      {searching ? (
        <p className="br-tree-loading" data-part="tree-loading">
          Loading…
        </p>
      ) : (
        <TreePaneView
          store={store}
          state={treeState}
          renderTreeNode={renderTreeNode}
          renderExpandCollapse={renderExpandCollapse}
          onRetryLazy={ensureLazy}
          treeNodeClassName={classNames?.treeNode}
        />
      )}
    </>
  );

  return (
    <div
      ref={rootRef}
      className={cx('br-reader', className, classNames?.root)}
      data-part="book-reader"
      aria-label={props['aria-label'] ?? 'Book reader'}
      style={{
        // Fill the height the consumer gives the reader (e.g. a sized wrapper),
        // so the content pane becomes a *bounded* scroll viewport — which is what
        // lets virtualization engage and the two panes scroll independently. With
        // an auto-height parent this resolves to auto (fine for tiny inline books).
        height: '100%',
        display: 'flex',
        // Collapsed → stack the toggle above the reading surface (a column);
        // otherwise the two panes sit side-by-side.
        flexDirection: collapsed
          ? 'column'
          : treeSide === 'right'
            ? 'row-reverse'
            : 'row',
      }}
    >
      {!collapsed && (
        <div
          className={cx('br-tree-pane', classNames?.tree)}
          data-part="tree-pane"
          style={{ flex: `0 0 ${width}`, overflow: 'auto' }}
        >
          {treeView}
        </div>
      )}
      {/* Collapsed: the tree reduces to a toggle row stacked above the reading
          surface (it never overlaps the text), with the tree popover anchored
          beneath it. position:relative makes this bar the popover's anchor. */}
      {collapsed && (
        <TreeToggleBar
          treeSide={treeSide}
          renderTreeToggle={renderTreeToggle}
          toggleApi={toggleApi}
          classNames={classNames}
          overlayOpen={overlayOpen}
          renderTreeOverlay={renderTreeOverlay}
          closeOverlay={closeOverlay}
          returnFocusEl={returnFocusEl}
          width={width}
          overlayMinWidth={overlayMinWidth}
          overlayMinHeight={overlayMinHeight}
        >
          {treeView}
        </TreeToggleBar>
      )}
      <div
        className={cx('br-content-pane', classNames?.content)}
        data-part="content-pane"
        style={{
          flex: '1 1 0',
          minWidth: 0,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* ContentPane owns the scroll surface (virtualization needs to read its
            own scrollTop/clientHeight); this wrapper only sizes it. While a
            search/reset runs, the old reading surface is replaced by a loading
            panel (the new tree's first page resolves before it remounts). */}
        {searching ? (
          <p
            className="br-content__loading"
            data-part="content-loading"
            style={{ margin: 'auto' }}
          >
            Loading…
          </p>
        ) : (
          <ContentPane
            store={store}
            fetchContent={fetchContent}
            cache={cache}
            sanitize={sanitize}
            overscan={overscan}
            prefetchCount={prefetchCount}
            estimateHeight={estimateHeight}
            getNextNode={getNextNode}
            getPrevNode={getPrevNode}
            onActiveChange={handleActiveChange}
            ensureLazy={ensureLazy}
            scrollRequest={scrollRequest}
            renderContent={renderContent}
            renderContentNode={renderContentNode}
            renderLoading={renderLoading}
            renderError={renderError}
            renderEmpty={renderEmpty}
            renderNoData={renderNoData}
            contentNodeClassName={classNames?.contentNode}
          />
        )}
      </div>
    </div>
  );
}
