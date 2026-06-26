/**
 * Demo book data — generated with @faker-js/faker so the reader shows realistic
 * prose instead of "lorem" stubs, while staying:
 *
 *  - **Deterministic.** A fixed top-level seed makes the tree identical on every
 *    reload; per-node content is seeded from the node id, so scrolling back over
 *    an already-read section shows the *same* text (which is what the cache /
 *    no-flicker guarantee is about — not fresh random prose each time).
 *  - **Lazy / bounded.** Section *titles* are generated up front (cheap strings),
 *    but section *bodies* are synthesized only when `fetchContent` is called for
 *    a node that's actually on screen. A 1,000-section book never materialises a
 *    thousand article bodies in memory at once.
 */
import { faker } from '@faker-js/faker';
import type { BookNode, FetchContent, LoadChildren } from '../src/index';

/** FNV-1a → a stable 32-bit seed from a node id (deterministic per-node content). */
function seedFrom(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function titleCase(words: string): string {
  return words.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A book/part/chapter heading like "The Silent Cartographer". */
function heading(): string {
  return titleCase(faker.lorem.words({ min: 2, max: 4 }));
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

/**
 * Small inline book (sync strategy): one book → a few parts → a few chapters.
 * The whole tree is in memory up front — the simplest way to use <BookReader>.
 */
export function makeSyncBook(): BookNode {
  faker.seed(1);
  const parts = Array.from({ length: 3 }, (_, p) => {
    const chapters = Array.from({ length: faker.number.int({ min: 2, max: 4 }) }, (_, c) => ({
      id: `s.p${p}.c${c}`,
      title: `Chapter ${c + 1}. ${heading()}`,
    }));
    return {
      id: `s.p${p}`,
      title: `Part ${'I'.repeat(p + 1)} — ${heading()}`,
      hasContent: false, // a pure organisational branch
      children: chapters,
    } satisfies BookNode;
  });
  return { id: 's', title: titleCase(faker.lorem.words(3)), children: parts };
}

/**
 * Large book (sync strategy): parts → chapters → sections, ~1,000+ nodes, to
 * exercise virtualization. Titles only; bodies stay lazy via `fetchContent`.
 */
export function makeLargeBook(): BookNode {
  faker.seed(42);
  const PARTS = 8;
  const CHAPTERS = 8;
  const SECTIONS = 16;
  const parts = Array.from({ length: PARTS }, (_, p) => ({
    id: `l.p${p}`,
    title: `Part ${p + 1}. ${heading()}`,
    hasContent: false,
    children: Array.from({ length: CHAPTERS }, (_, c) => ({
      id: `l.p${p}.c${c}`,
      title: `${p + 1}.${c + 1} ${heading()}`,
      hasContent: false,
      children: Array.from({ length: SECTIONS }, (_, s) => ({
        id: `l.p${p}.c${c}.s${s}`,
        title: `§${p + 1}.${c + 1}.${s + 1} ${heading()}`,
      })),
    })),
  }));
  return {
    id: 'l',
    title: `${heading()} (${PARTS * CHAPTERS * SECTIONS} sections)`,
    children: parts,
  };
}

/** Root of a lazy book: children arrive from `loadChildren` on expand. */
export function makeLazyBook(): BookNode {
  return { id: 'z', title: 'A Vast Lazy Library', hasChildren: true };
}

/**
 * Lazy children loader (async tree strategy). Synthesizes 3–5 child sections
 * per node a few levels deep, after a simulated network round-trip.
 */
export const loadChildren: LoadChildren = async (node, ctx) => {
  await new Promise((r) => setTimeout(r, 350));
  if (ctx.signal.aborted) return [];
  faker.seed(seedFrom(node.id));
  const depth = node.id.split('.').length;
  const count = faker.number.int({ min: 3, max: 5 });
  return Array.from({ length: count }, (_, i) => ({
    id: `${node.id}.${i}`,
    title: heading(),
    hasChildren: depth < 4, // a few levels deep, then leaves
  }));
};

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export interface FetchOptions {
  /** Simulated latency in ms. `0` resolves synchronously (no loading flash). */
  delayMs?: number;
  /** Ids that throw on the first attempt and succeed on retry. */
  failFirstFor?: Set<string>;
  /** Ids that resolve to empty content (exercises the empty state). */
  emptyFor?: Set<string>;
}

/** Rich, deterministic HTML body for a node (seeded from its id). */
function renderBody(node: BookNode): string {
  faker.seed(seedFrom(node.id));
  const blocks: string[] = [`<h2>${node.title}</h2>`];
  const paras = faker.number.int({ min: 3, max: 6 });
  for (let i = 0; i < paras; i++) {
    blocks.push(`<p>${faker.lorem.paragraph({ min: 3, max: 7 })}</p>`);
    if (i === 1 && faker.datatype.boolean()) {
      blocks.push(`<blockquote>${faker.lorem.sentence()}</blockquote>`);
    }
  }
  return blocks.join('');
}

/**
 * Builds a `fetchContent` for the demo. Pure prose by default; pass options to
 * stage the slow / failing / empty cases for the states example.
 */
export function makeFetchContent(opts: FetchOptions = {}): FetchContent {
  const { delayMs = 0, failFirstFor, emptyFor } = opts;
  const attempts = new Map<string, number>();

  return async (node, ctx) => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (ctx.signal.aborted) return '';

    if (failFirstFor?.has(node.id)) {
      const n = (attempts.get(node.id) ?? 0) + 1;
      attempts.set(node.id, n);
      if (n === 1) throw new Error('simulated fetch failure');
    }
    if (emptyFor?.has(node.id)) return '';
    return renderBody(node);
  };
}
