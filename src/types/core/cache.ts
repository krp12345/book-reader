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

export interface StoredEntry<Content> {
  content: Content;
  size: number;
}

export interface InFlightLoad<Content> {
  promise: Promise<Content>;
  controller: AbortController;
  refs: number;
}
