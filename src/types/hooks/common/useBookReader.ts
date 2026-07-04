import type { RefObject } from 'react';
import type { ScrollRequest, TreeToggleApi } from '../../public';
import type { ContentCache } from '../../core/content/cache';
import type { TreeStore } from '../../core/tree/treeStore';
import type { TreeState } from '../tree/useTreeState';

export interface BookReaderState<Meta = unknown, Content = string> {
  store: TreeStore<Meta>;
  cache: ContentCache<Content>;
  treeState: TreeState;
  /** Fire-and-forget lazy-children resolution (tree expand / scroll trigger / retry). */
  ensureLazy: (id: string) => void;
  /** Whether a search/reset (tree replacement) is in flight. */
  searching: boolean;
  searchError: unknown;
  handleSearch: (query: string) => void;
  handleReset: () => void;
  /** Whether the search box should render at all. */
  searchVisible: boolean;
  /** The pending "scroll the reading surface here" request, if any. */
  scrollRequest: ScrollRequest | undefined;
  /** Scroll-derived active-node changes flow back into `location` through this. */
  handleActiveChange: (id: string, offset: number) => void;
  /** Ref for the reader root — drives the responsive-collapse width measurement. */
  rootRef: RefObject<HTMLDivElement>;
  /** Whether the tree pane is collapsed to the toggle + overlay. */
  collapsed: boolean;
  overlayOpen: boolean;
  closeOverlay: () => void;
  toggleApi: TreeToggleApi;
  /** Element to restore focus to when the overlay closes. */
  returnFocusEl: HTMLElement | null;
  /** Resolved CSS lengths for the tree pane / overlay sizing. */
  width: string;
  overlayMinWidth: string;
  overlayMinHeight: string;
}
