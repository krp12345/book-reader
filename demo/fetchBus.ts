/**
 * A tiny event bus the demo's data functions push to, so the on-screen
 * `<FetchInspector>` can show every `fetchContent` / `fetchChildren` / search /
 * reset call live — no devtools needed. This is demo-only glue; the library knows
 * nothing about it.
 */
export type FetchKind = 'content' | 'children' | 'search' | 'reset';
export type FetchPhase = 'start' | 'ok' | 'error' | 'abort';

export interface FetchEvent {
  seq: number;
  kind: FetchKind;
  /** Node id (content/children) or the query (search), '—' for reset. */
  label: string;
  phase: FetchPhase;
  /** ms since the matching 'start', set on terminal phases. */
  ms?: number;
  /** Extra one-line detail (e.g. "4 children"). */
  detail?: string;
  at: number;
}

type Listener = (events: FetchEvent[]) => void;

let seq = 0;
let events: FetchEvent[] = [];
const listeners = new Set<Listener>();
const MAX = 200;

function emit(e: Omit<FetchEvent, 'seq' | 'at'>): void {
  seq += 1;
  events = [{ ...e, seq, at: Date.now() }, ...events].slice(0, MAX);
  for (const l of listeners) l(events);
}

export const fetchBus = {
  start(kind: FetchKind, label: string): number {
    const startedAt = performance.now();
    emit({ kind, label, phase: 'start' });
    return startedAt;
  },
  ok(kind: FetchKind, label: string, startedAt: number, detail?: string): void {
    emit({ kind, label, phase: 'ok', ms: Math.round(performance.now() - startedAt), ...(detail !== undefined ? { detail } : {}) });
  },
  error(kind: FetchKind, label: string, startedAt: number): void {
    emit({ kind, label, phase: 'error', ms: Math.round(performance.now() - startedAt) });
  },
  abort(kind: FetchKind, label: string, startedAt: number): void {
    emit({ kind, label, phase: 'abort', ms: Math.round(performance.now() - startedAt) });
  },
  clear(): void {
    events = [];
    for (const l of listeners) l(events);
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    l(events);
    return () => listeners.delete(l);
  },
};
