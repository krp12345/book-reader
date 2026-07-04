export type CacheGetter<Content> = (id: string) => Content | undefined;

export interface EvictionInput<Content> {
  entries: ReadonlyArray<CacheEntry<Content>>;
  totalSize: number;
  config: ResolvedCacheConfig<Content>;
}

export type EvictFn<Content> = (input: EvictionInput<Content>) => string[];

export interface CacheEntry<Content> {
  id: string;
  content: Content;
  size: number;
}

export interface CacheConfig<Content = string> {
  maxChars?: number;
  maxNodes?: number;
  sizeOf?: (content: Content) => number;
  evict?: EvictFn<Content>;
}

export interface ResolvedCacheConfig<Content = string> {
  maxChars: number;
  maxNodes: number;
  sizeOf: (content: Content) => number;
  evict?: EvictFn<Content>;
}
