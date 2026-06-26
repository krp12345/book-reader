/**
 * Bounded, in-memory content cache (§3 layer 1).
 *
 * Sanitized HTML (or any `Content`) keyed by node id. Three guarantees make the
 * "auto-cache + virtualized + no flicker" promise possible (see CLAUDE.md):
 *
 * - **Bounded**: never grows without limit. Default budget is total character
 *   count (`maxChars`); an optional `maxNodes` caps entry count too. Eviction is
 *   least-recently-used, or a fully custom `evict` policy.
 * - **Pinned window**: ids in the pinned set (viewport + overscan + prefetch)
 *   are exempt from eviction, so re-entering view is always a synchronous hit.
 * - **In-flight de-duplication**: a node is never fetched twice concurrently;
 *   `dedupe` hands every concurrent caller the same promise.
 *
 * Pure: no React. Recency is maintained with a `Map` (insertion order = LRU
 * order, oldest first); touching an entry re-inserts it at the end.
 */
import type {
  CacheConfig,
  CacheEntry,
  EvictionInput,
  ResolvedCacheConfig,
} from '../types';

/** ~5M characters: enough to keep a long reading session warm (REQUIREMENTS §3). */
const DEFAULT_MAX_CHARS = 5_000_000;

export interface ContentCache<Content = string> {
  /** Read content, marking the entry most-recently-used. */
  get(id: string): Content | undefined;
  /** Whether an id is cached (does not affect recency). */
  has(id: string): boolean;
  /** Store/overwrite content, then evict down to budget. */
  set(id: string, content: Content): void;
  /** Drop one entry; returns whether it existed. */
  delete(id: string): boolean;
  /** Drop all entries (in-flight loads are left running). */
  clear(): void;
  /** Replace the pinned-id set; re-runs eviction since the evictable set changed. */
  setPinned(ids: Iterable<string>): void;
  /** The in-flight load for an id, if one is pending. */
  getInFlight(id: string): Promise<Content> | undefined;
  /**
   * De-duplicated async load. If a load for `id` is already in flight, returns
   * that promise without calling `factory`. On success the value is cached; on
   * failure nothing is cached. The in-flight entry is cleared either way.
   */
  dedupe(id: string, factory: () => Promise<Content>): Promise<Content>;
  /** Number of cached entries. */
  readonly count: number;
  /** Summed `size` across all entries (evictable + pinned). */
  readonly totalSize: number;
  /** Cached ids, least-recently-used first. */
  ids(): string[];
}

function resolveConfig<Content>(
  config: CacheConfig<Content> = {},
): ResolvedCacheConfig<Content> {
  const sizeOf =
    config.sizeOf ??
    // Default: character length of the stringified content.
    ((content: Content): number => String(content).length);
  return {
    maxChars: config.maxChars ?? DEFAULT_MAX_CHARS,
    maxNodes: config.maxNodes ?? Number.POSITIVE_INFINITY,
    sizeOf,
    ...(config.evict ? { evict: config.evict } : {}),
  };
}

interface StoredEntry<Content> {
  content: Content;
  size: number;
}

export function createContentCache<Content = string>(
  config?: CacheConfig<Content>,
): ContentCache<Content> {
  const resolved = resolveConfig<Content>(config);
  // Insertion order doubles as LRU order: oldest (head) → newest (tail).
  const entries = new Map<string, StoredEntry<Content>>();
  const inFlight = new Map<string, Promise<Content>>();
  const pinned = new Set<string>();
  let totalSize = 0;

  /** Move an existing key to the most-recently-used position. */
  function touch(id: string): void {
    const entry = entries.get(id);
    if (entry === undefined) return;
    entries.delete(id);
    entries.set(id, entry);
  }

  function remove(id: string): boolean {
    const entry = entries.get(id);
    if (entry === undefined) return false;
    totalSize -= entry.size;
    entries.delete(id);
    return true;
  }

  const overChars = (): boolean => totalSize > resolved.maxChars;
  const overNodes = (): boolean => entries.size > resolved.maxNodes;

  /** Evict (non-pinned) entries until both budgets are satisfied. */
  function evict(): void {
    if (!overChars() && !overNodes()) return; // nothing to do while within budget
    if (resolved.evict) {
      runCustomEvict(resolved.evict);
      return;
    }
    // Default LRU: walk oldest → newest, skipping pinned, until within budget.
    for (const id of [...entries.keys()]) {
      if (!overChars() && !overNodes()) break;
      if (pinned.has(id)) continue;
      remove(id);
    }
  }

  /** Store/overwrite an entry at the most-recently-used tail, then evict. */
  function setEntry(id: string, content: Content): void {
    const size = resolved.sizeOf(content);
    const existing = entries.get(id);
    if (existing !== undefined) totalSize -= existing.size;
    entries.delete(id); // ensure re-insert lands at the most-recently-used tail
    entries.set(id, { content, size });
    totalSize += size;
    evict();
  }

  function runCustomEvict(evictFn: NonNullable<ResolvedCacheConfig<Content>['evict']>): void {
    const evictable: CacheEntry<Content>[] = [];
    for (const [id, entry] of entries) {
      if (pinned.has(id)) continue; // pinned ids are never offered to the policy
      evictable.push({ id, content: entry.content, size: entry.size });
    }
    const input: EvictionInput<Content> = {
      entries: evictable,
      totalSize,
      config: resolved,
    };
    for (const id of evictFn(input)) {
      if (pinned.has(id)) continue; // honor pinning even if the policy ignores it
      remove(id);
    }
  }

  return {
    get(id) {
      const entry = entries.get(id);
      if (entry === undefined) return undefined;
      touch(id);
      return entry.content;
    },

    has(id) {
      return entries.has(id);
    },

    set(id, content) {
      setEntry(id, content);
    },

    delete(id) {
      return remove(id);
    },

    clear() {
      entries.clear();
      totalSize = 0;
    },

    setPinned(ids) {
      pinned.clear();
      for (const id of ids) pinned.add(id);
      evict();
    },

    getInFlight(id) {
      return inFlight.get(id);
    },

    dedupe(id, factory) {
      const pending = inFlight.get(id);
      if (pending !== undefined) return pending;
      const promise = factory().then(
        (content) => {
          inFlight.delete(id);
          setEntry(id, content);
          return content;
        },
        (error: unknown) => {
          inFlight.delete(id);
          throw error;
        },
      );
      inFlight.set(id, promise);
      return promise;
    },

    get count() {
      return entries.size;
    },

    get totalSize() {
      return totalSize;
    },

    ids() {
      return [...entries.keys()];
    },
  };
}
