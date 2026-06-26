/**
 * Top-level component: the two-pane book reader.
 *
 * Composes the section {@link TreePane} (left/right) with the continuous
 * {@link ContentPane}, both reading from one shared {@link createTreeStore}.
 * The store is derived from `tree` (sync) and grown by `loadChildren` (lazy);
 * `fetchContent` resolves each node's body.
 *
 * M3 scope: structure + content rendering. M4 adds the bounded content cache
 * (created once per reader, shared by every content node) so re-entering a node
 * is a synchronous hit. Cross-pane scroll⟷tree sync, controlled `location`, and
 * virtualization arrive in M5–M6 and layer on without changing the prop contract.
 */
import { useMemo, useRef, useState, type JSX } from 'react';
import { createContentCache, type ContentCache } from './core/cache';
import { createTreeStore } from './core/treeStore';
import { TreePane } from './tree/TreePane';
import { ContentPane } from './content/ContentPane';
import type { BookReaderProps } from './types';

export function BookReader<Meta = unknown>(
  props: BookReaderProps<Meta>,
): JSX.Element {
  const {
    tree,
    loadChildren,
    fetchContent,
    cache: cacheConfig,
    treeSide = 'left',
    treeWidth = 320,
    sanitize,
    className,
    classNames,
    renderTreeNode,
    renderContent,
    renderLoading,
    renderError,
    renderEmpty,
  } = props;

  // `tree` is the only structural input; rebuild the store only when it changes.
  const store = useMemo(
    () => createTreeStore<Meta>(tree !== undefined ? { tree } : {}),
    [tree],
  );

  // One cache per reader instance, shared across all content nodes. Config is
  // captured at mount (a fresh `cache={{…}}` literal each render must not wipe
  // the cache); a `useRef` keeps the instance stable for the component's life.
  const cacheRef = useRef<ContentCache<string>>();
  if (cacheRef.current === undefined) {
    cacheRef.current = createContentCache(cacheConfig);
  }
  const cache = cacheRef.current;

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const width = typeof treeWidth === 'number' ? `${treeWidth}px` : treeWidth;

  return (
    <div
      className={['br-reader', className].filter(Boolean).join(' ')}
      data-part="book-reader"
      aria-label={props['aria-label'] ?? 'Book reader'}
      style={{
        display: 'flex',
        flexDirection: treeSide === 'right' ? 'row-reverse' : 'row',
      }}
    >
      <div
        className={['br-tree-pane', classNames?.tree].filter(Boolean).join(' ')}
        data-part="tree-pane"
        style={{ flex: `0 0 ${width}`, overflow: 'auto' }}
      >
        <TreePane
          store={store}
          loadChildren={loadChildren}
          selectedId={selectedId}
          onSelect={setSelectedId}
          renderTreeNode={renderTreeNode}
        />
      </div>
      <div
        className={['br-content-pane', classNames?.content]
          .filter(Boolean)
          .join(' ')}
        data-part="content-pane"
        style={{ flex: '1 1 0', overflow: 'auto' }}
      >
        <ContentPane
          store={store}
          fetchContent={fetchContent}
          cache={cache}
          sanitize={sanitize}
          renderContent={renderContent}
          renderLoading={renderLoading}
          renderError={renderError}
          renderEmpty={renderEmpty}
          contentNodeClassName={classNames?.contentNode}
        />
      </div>
    </div>
  );
}
