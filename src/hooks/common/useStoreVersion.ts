import { useSyncExternalStore } from 'react';
import type { TreeStore } from '../../core/tree/treeStore';

/**
 * Re-renders the caller whenever the (mutable) tree store changes, and returns
 * the current version. Include the returned value in `useMemo` deps for any data
 * derived from the store (flatten, reading order) so it recomputes after a lazy
 * insert / tree replace.
 */
export function useStoreVersion<Meta = unknown>(
  store: TreeStore<Meta>,
): number {
  return useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
}
