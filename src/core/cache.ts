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

/** The result of subscribing to a {@link ContentCache.load}. */
export interface LoadHandle<Content = string> {
  /** Set when the factory resolved synchronously (settle without a loading flash). */
  value?: Content;
  /** Set when the factory threw synchronously (surface the error inline). */
  error?: unknown;
  /** The shared load promise (rejects if the factory rejected/threw). */
  promise: Promise<Content>;
  /** Drop this subscriber; aborts + discards the fetch if it was the last one. */
  release: () => void;
}

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
   *
   * `dedupe` is a fire-and-forget warm: it holds the load until it settles, so
   * the fetch always runs to completion (never aborted out from under a
   * concurrent reader). Prefer {@link load} for a subscriber that may leave.
   */
  dedupe(id: string, factory: () => Promise<Content>): Promise<Content>;
  /**
   * Subscribe to a de-duplicated load. The **first** subscriber starts the fetch
   * — `factory` receives an {@link AbortSignal} owned by the load, not by any one
   * subscriber — and concurrent subscribers share it. The returned `release` must
   * be called when the subscriber no longer needs the result; when the **last**
   * subscriber releases before the load settles, the fetch is aborted and its
   * result discarded (a fetch that completes under an aborted signal is **never**
   * cached, so a cancelled load can't poison the cache with a partial/empty body).
   *
   * A synchronous `factory` result settles inline (`value` is set, no in-flight
   * entry, `release` is a no-op); a synchronous throw is surfaced via `error`.
   * On async success the value is cached.
   */
  load(
    id: string,
    factory: (signal: AbortSignal) => Content | Promise<Content>,
  ): LoadHandle<Content>;
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

/** A shared, in-flight async load with its abort controller and subscriber count. */
interface InFlightLoad<Content> {
  promise: Promise<Content>;
  controller: AbortController;
  /** Number of live subscribers; the load is aborted when this hits zero. */
  refs: number;
}

/** Duck-typed promise check (avoids assuming the global `Promise` for thenables). */
function isThenable<Content>(value: Content | Promise<Content>): value is Promise<Content> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

export function createContentCache<Content = string>(
  config?: CacheConfig<Content>,
): ContentCache<Content> {
  const resolved = resolveConfig<Content>(config);
  // Insertion order doubles as LRU order: oldest (head) → newest (tail).
  const entries = new Map<string, StoredEntry<Content>>();
  const inFlight = new Map<string, InFlightLoad<Content>>();
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

  /** A one-shot release for a subscriber of the in-flight load `id`. */
  function makeRelease(id: string): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const load = inFlight.get(id);
      if (load === undefined) return; // already settled (or someone else aborted it)
      load.refs -= 1;
      if (load.refs <= 0) {
        inFlight.delete(id);
        load.controller.abort();
      }
    };
  }

  /** Shared subscribe-to-a-load primitive backing both `load` and `dedupe`. */
  function loadImpl(
    id: string,
    factory: (signal: AbortSignal) => Content | Promise<Content>,
  ): LoadHandle<Content> {
    const existing = inFlight.get(id);
    if (existing !== undefined) {
      existing.refs += 1;
      return { promise: existing.promise, release: makeRelease(id) };
    }

    const controller = new AbortController();
    let raw: Content | Promise<Content>;
    try {
      raw = factory(controller.signal);
    } catch (error) {
      const promise = Promise.reject(error);
      promise.catch(() => undefined); // mark handled; the caller reads `error`
      return { error, promise, release: () => undefined };
    }

    if (!isThenable(raw)) {
      setEntry(id, raw); // synchronous fetcher: cache + settle inline, no flash
      return { value: raw, promise: Promise.resolve(raw), release: () => undefined };
    }

    const load: InFlightLoad<Content> = {
      refs: 1,
      controller,
      promise: raw.then(
        (content) => {
          inFlight.delete(id);
          // A fetch that finished under an aborted signal is discarded, never
          // cached — so a cancelled load can't poison the cache (e.g. a fetcher
          // that returns an empty body when `signal.aborted`).
          if (!controller.signal.aborted) setEntry(id, content);
          return content;
        },
        (error: unknown) => {
          inFlight.delete(id);
          throw error;
        },
      ),
    };
    inFlight.set(id, load);
    return { promise: load.promise, release: makeRelease(id) };
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
      return inFlight.get(id)?.promise;
    },

    load(id, factory) {
      return loadImpl(id, factory);
    },

    dedupe(id, factory) {
      // A warm that holds its own ref until the load settles, so the fetch
      // always completes (and caches) even if no reader is currently mounted.
      const { promise, release } = loadImpl(id, () => factory());
      promise.then(release, release);
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
