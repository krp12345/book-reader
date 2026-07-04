export interface UseLazyChildren {
  /** Fire-and-forget: ensure a lazy node's children are loaded (dedup + retry). */
  ensure: (id: string) => void;
  /** Awaitable variant — resolves once the node's children are available. */
  ensureAsync: (id: string) => Promise<void>;
}
