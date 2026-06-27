import type {
  CacheConfig,
  CacheEntry,
  EvictionInput,
  ResolvedCacheConfig,
} from '../types';

const DEFAULT_MAX_CHARS = 5_000_000;

export interface LoadHandle<Content = string> {
  value?: Content;
  error?: unknown;
  promise: Promise<Content>;
  release: () => void;
}

export interface ContentCache<Content = string> {
  get(id: string): Content | undefined;
  has(id: string): boolean;
  set(id: string, content: Content): void;
  delete(id: string): boolean;
  clear(): void;
  setPinned(ids: Iterable<string>): void;
  getInFlight(id: string): Promise<Content> | undefined;
  dedupe(id: string, factory: () => Promise<Content>): Promise<Content>;
  load(
    id: string,
    factory: (signal: AbortSignal) => Content | Promise<Content>,
  ): LoadHandle<Content>;
  readonly count: number;
  readonly totalSize: number;
  ids(): string[];
}

function resolveConfig<Content>(
  config: CacheConfig<Content> = {},
): ResolvedCacheConfig<Content> {
  const sizeOf =
    config.sizeOf ?? ((content: Content): number => String(content).length);
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

interface InFlightLoad<Content> {
  promise: Promise<Content>;
  controller: AbortController;
  refs: number;
}

function isThenable<Content>(
  value: Content | Promise<Content>,
): value is Promise<Content> {
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
  const entries = new Map<string, StoredEntry<Content>>();
  const inFlight = new Map<string, InFlightLoad<Content>>();
  const pinned = new Set<string>();
  let totalSize = 0;

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

  function evict(): void {
    if (!overChars() && !overNodes()) return;
    if (resolved.evict) {
      runCustomEvict(resolved.evict);
      return;
    }
    for (const id of [...entries.keys()]) {
      if (!overChars() && !overNodes()) break;
      if (pinned.has(id)) continue;
      remove(id);
    }
  }

  function setEntry(id: string, content: Content): void {
    const size = resolved.sizeOf(content);
    const existing = entries.get(id);
    if (existing !== undefined) totalSize -= existing.size;
    entries.delete(id);
    entries.set(id, { content, size });
    totalSize += size;
    evict();
  }

  function runCustomEvict(
    evictFn: NonNullable<ResolvedCacheConfig<Content>['evict']>,
  ): void {
    const evictable: CacheEntry<Content>[] = [];
    for (const [id, entry] of entries) {
      if (pinned.has(id)) continue;
      evictable.push({ id, content: entry.content, size: entry.size });
    }
    const input: EvictionInput<Content> = {
      entries: evictable,
      totalSize,
      config: resolved,
    };
    for (const id of evictFn(input)) {
      if (pinned.has(id)) continue;
      remove(id);
    }
  }

  function makeRelease(id: string): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const load = inFlight.get(id);
      if (load === undefined) return;
      load.refs -= 1;
      if (load.refs <= 0) {
        inFlight.delete(id);
        load.controller.abort();
      }
    };
  }

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
      promise.catch(() => undefined);
      return { error, promise, release: () => undefined };
    }

    if (!isThenable(raw)) {
      setEntry(id, raw);
      return {
        value: raw,
        promise: Promise.resolve(raw),
        release: () => undefined,
      };
    }

    const load: InFlightLoad<Content> = {
      refs: 1,
      controller,
      promise: raw.then(
        (content) => {
          inFlight.delete(id);
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
