/**
 * Right pane: the continuous reading surface.
 *
 * Lays the book out top-to-bottom in depth-first reading order
 * (see {@link createReadingOrder}), one {@link ContentNode} per node that
 * carries content (`hasContent !== false`). Each node fetches its own body, so
 * the pane stays declarative — it owns ordering and the scroll container, not
 * the fetch lifecycle.
 *
 * M3 renders the currently-loaded sequence into one scroll surface. DOM
 * virtualization (M5) and scroll⟷tree sync / auto-advance (M6) layer on top
 * without changing this contract; pass a bumping `version` to recompute the
 * sequence after lazy children arrive.
 */
import { useMemo, type JSX } from 'react';
import type { ContentCache } from '../core/cache';
import type { TreeStore } from '../core/treeStore';
import { createReadingOrder } from '../core/traversal';
import type {
  FetchContent,
  RenderContent,
  RenderEmpty,
  RenderError,
  RenderLoading,
  SanitizeOption,
} from '../types';
import { ContentNode } from './ContentNode';

export interface ContentPaneProps<Meta = unknown> {
  /** The indexed tree whose nodes are read in order. */
  store: TreeStore<Meta>;
  fetchContent: FetchContent<Meta>;
  /** Bump to recompute the rendered sequence after lazy children load. */
  version?: number | undefined;
  sanitize?: SanitizeOption | undefined;
  /** Shared content cache (sanitized HTML keyed by node id). */
  cache?: ContentCache<string> | undefined;
  renderContent?: RenderContent<Meta> | undefined;
  renderLoading?: RenderLoading<Meta> | undefined;
  renderError?: RenderError<Meta> | undefined;
  renderEmpty?: RenderEmpty<Meta> | undefined;
  className?: string | undefined;
  /** Applied to each content node wrapper. */
  contentNodeClassName?: string | undefined;
  'aria-label'?: string | undefined;
}

export function ContentPane<Meta = unknown>(
  props: ContentPaneProps<Meta>,
): JSX.Element {
  const { store, version } = props;

  // Reading order reflects the store's *current* knowledge; recompute when lazy
  // children land (signalled via `version`).
  const ids = useMemo(() => {
    const order = createReadingOrder(store);
    return order
      .getSequence()
      .filter((id) => store.getNode(id)?.hasContent !== false);
  }, [store, version]);

  return (
    <div
      className={['br-content', props.className].filter(Boolean).join(' ')}
      data-part="content"
      aria-label={props['aria-label'] ?? 'Reading'}
    >
      {ids.map((id) => {
        const node = store.getNode(id);
        if (!node) return null;
        return (
          <ContentNode
            key={id}
            node={node}
            path={store.getPath(id)}
            fetchContent={props.fetchContent}
            sanitize={props.sanitize}
            cache={props.cache}
            renderContent={props.renderContent}
            renderLoading={props.renderLoading}
            renderError={props.renderError}
            renderEmpty={props.renderEmpty}
            className={props.contentNodeClassName}
          />
        );
      })}
    </div>
  );
}
