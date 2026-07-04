/**
 * Dependencies for {@link resolveToNode}: how to fetch a lazy branch's children
 * (`ensureAsync`, idempotent/dedup'd), an optional ancestry resolver, and the
 * abort signal + optional pre-supplied path for one navigation.
 */
export interface ResolveDeps {
  ensureAsync: (id: string) => Promise<void>;
  fetchPath?:
    | ((id: string, signal: AbortSignal) => string[] | undefined | Promise<string[] | undefined>)
    | undefined;
  path?: string[] | undefined;
  signal: AbortSignal;
}

export interface ReadingOrder {
  getNext(id: string): string | undefined;
  getPrev(id: string): string | undefined;
  getFirst(): string | undefined;
  getLast(): string | undefined;
  getSequence(): string[];
}
