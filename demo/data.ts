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
import type {
  BookNode,
  FetchChildren,
  FetchContent,
  ResetFn,
  SearchFn,
} from '../src/index';
import { fetchBus } from './fetchBus';

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
 * A book whose **branch nodes also carry their own content** — every node
 * (root, parts, chapters) has a body, because none sets `hasContent: false`.
 * Clicking a Part navigates to the Part itself (its own intro text), not to a
 * child: a non-leaf node is a first-class reading target and active node.
 */
export function makeBranchContentBook(): BookNode {
  faker.seed(7);
  const parts = Array.from({ length: 3 }, (_, p) => ({
    id: `b.p${p}`,
    title: `Part ${'I'.repeat(p + 1)} — ${heading()}`,
    // No `hasContent: false`: this branch has an introduction of its own.
    children: Array.from({ length: 2 }, (_, c) => ({
      id: `b.p${p}.c${c}`,
      title: `Chapter ${c + 1}. ${heading()}`,
    })),
  }));
  return { id: 'b', title: `${heading()} — A Field Guide`, children: parts };
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

/**
 * Per-node **metadata** carried on `BookNode.meta`. The selection example reads
 * this in `renderContentNode` (via `api.node.meta`) to prove the custom renderer
 * gets the full node — id, title *and* metadata — not just the content.
 */
export interface SelectionMeta {
  category: string;
  /** Approximate word count, just to have a second metadata field. */
  words: number;
}

const SELECTION_CATEGORIES = [
  'history',
  'theory',
  'method',
  'primary source',
  'field notes',
];

/**
 * A mid-sized book (≈128 sections — enough to virtualize / scroll sections out
 * of the DOM) where **every section carries `meta`**. Used by the text-selection
 * example so staged selections can track node id + title + metadata, and so
 * highlights must survive virtualized unmount/remount.
 */
export function makeSelectionBook(): BookNode<SelectionMeta> {
  faker.seed(99);
  const PARTS = 4;
  const CHAPTERS = 4;
  const SECTIONS = 8;
  const parts = Array.from({ length: PARTS }, (_, p) => ({
    id: `sel.p${p}`,
    title: `Part ${p + 1}. ${heading()}`,
    hasContent: false,
    children: Array.from({ length: CHAPTERS }, (_, c) => ({
      id: `sel.p${p}.c${c}`,
      title: `${p + 1}.${c + 1} ${heading()}`,
      hasContent: false,
      children: Array.from({ length: SECTIONS }, (_, s) => {
        const id = `sel.p${p}.c${c}.s${s}`;
        faker.seed(seedFrom(id));
        return {
          id,
          title: `§${p + 1}.${c + 1}.${s + 1} ${heading()}`,
          meta: {
            category: faker.helpers.arrayElement(SELECTION_CATEGORIES),
            words: faker.number.int({ min: 120, max: 480 }),
          },
        } satisfies BookNode<SelectionMeta>;
      }),
    })),
  }));
  return { id: 'sel', title: `${heading()} — Annotated`, children: parts };
}

// ---------------------------------------------------------------------------
// Lazy tree + search/reset
// ---------------------------------------------------------------------------
//
// A book whose branches are **lazy**: only the root + its parts ship up front;
// chapters and sections are fetched on demand (tree expand or scroll) via
// `fetchChildren`. Node ids encode depth as a path ("lz/0/2/5"), so a single
// generator can resolve any branch — including the synthetic branches a search
// returns. Every fetch is logged to `fetchBus` for the on-screen inspector.

const LZ_LABEL: Record<number, string> = { 2: 'Part', 3: 'Chapter', 4: '§' };

function lazyTitle(id: string): string {
  faker.seed(seedFrom(id));
  const depth = id.split('/').length;
  const label = LZ_LABEL[depth] ?? 'Section';
  const n = Number(id.split('/').pop()) + 1;
  return `${label} ${n}. ${heading()}`;
}

/** Deterministic children for a branch id; leaves (depth ≥ 4) carry content. */
function lazyChildrenOf(id: string): BookNode[] {
  const childDepth = id.split('/').length + 1;
  const count = childDepth === 2 ? 4 : childDepth === 3 ? 4 : 6;
  const leaf = childDepth >= 4;
  return Array.from({ length: count }, (_, i) => {
    const cid = `${id}/${i}`;
    const node: BookNode = { id: cid, title: lazyTitle(cid) };
    return leaf ? node : { ...node, lazy: true, hasContent: false };
  });
}

/**
 * The lazy book: a root with its own intro content, and 4 **lazy** parts whose
 * sub-trees load on demand. (`hasContent: false` on a part means a pure
 * organisational branch — descending past it is what `fetchChildren` resolves.)
 */
export function makeLazyBook(): BookNode {
  faker.seed(123);
  return {
    id: 'lz',
    title: `${heading()} — A Lazy Atlas`,
    children: Array.from({ length: 4 }, (_, i) => {
      const id = `lz/${i}`;
      return { id, title: lazyTitle(id), lazy: true, hasContent: false };
    }),
  };
}

export function makeLazyFetchChildren(delayMs = 350): FetchChildren {
  return async (node, ctx) => {
    const started = fetchBus.start('children', node.id);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (ctx.signal.aborted) {
      fetchBus.abort('children', node.id, started);
      return [];
    }
    const children = lazyChildrenOf(node.id);
    fetchBus.ok('children', node.id, started, `${children.length} children`);
    return children;
  };
}

/** Content fetch for the lazy example — same prose, but logged to the inspector. */
export function makeLazyFetchContent(delayMs = 250): FetchContent {
  return async (node, ctx) => {
    const started = fetchBus.start('content', node.id);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (ctx.signal.aborted) {
      fetchBus.abort('content', node.id, started);
      return '';
    }
    fetchBus.ok('content', node.id, started);
    return renderBody(node);
  };
}

/**
 * A search that **replaces the whole tree** with a results book. The results are
 * themselves lazy branches (ids under "q/…"), so after the swap the reader
 * recursively resolves down to the first real section — exactly the "jump to the
 * first page" flow. Resolved by the same `fetchChildren` generator.
 */
export function makeLazySearch(delayMs = 400): SearchFn {
  return async (query, ctx) => {
    const started = fetchBus.start('search', query || '(empty)');
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (ctx.signal.aborted) {
      fetchBus.abort('search', query, started);
      return [];
    }
    faker.seed(seedFrom(`q:${query}`));
    const tree: BookNode = {
      id: 'q',
      title: `Results for “${query || '…'}”`,
      hasContent: false,
      children: Array.from({ length: 3 }, (_, i) => ({
        id: `q/${i}`,
        title: `Match group ${i + 1}. ${heading()}`,
        lazy: true,
        hasContent: false,
      })),
    };
    fetchBus.ok('search', query || '(empty)', started, '3 groups');
    return tree;
  };
}

export function makeLazyReset(delayMs = 300): ResetFn {
  return async (ctx) => {
    const started = fetchBus.start('reset', '—');
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (ctx.signal.aborted) {
      fetchBus.abort('reset', '—', started);
      return [];
    }
    fetchBus.ok('reset', '—', started, 'original book');
    return makeLazyBook();
  };
}

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

// ---------------------------------------------------------------------------
// Object (generic) content payload
// ---------------------------------------------------------------------------

/**
 * A **structured** section payload — not an HTML string. The consumer owns its
 * rendering end-to-end via `renderContent`, so the reader never sanitizes or
 * `dangerouslySetInnerHTML`s anything here. This is the M9 "generic content"
 * path: `fetchContent` returns `RichSection`, the cache stores `RichSection`,
 * and `renderContent(node, section)` is fully typed.
 */
export interface RichSection {
  heading: string;
  /** Estimated reading time, minutes. */
  readingTime: number;
  tags: string[];
  paragraphs: string[];
  /** An optional pulled-out callout box. */
  callout?: string;
}

/** Deterministic structured payload for a node (seeded from its id). */
function richBody(node: BookNode): RichSection {
  faker.seed(seedFrom(node.id));
  const paraCount = faker.number.int({ min: 3, max: 6 });
  const paragraphs = Array.from({ length: paraCount }, () =>
    faker.lorem.paragraph({ min: 3, max: 7 }),
  );
  return {
    heading: node.title,
    readingTime: faker.number.int({ min: 2, max: 9 }),
    tags: faker.helpers.arrayElements(
      ['history', 'theory', 'field notes', 'primary source', 'method', 'aside'],
      faker.number.int({ min: 1, max: 3 }),
    ),
    paragraphs,
    ...(faker.datatype.boolean()
      ? { callout: faker.lorem.sentence() }
      : {}),
  };
}

/**
 * Builds a `fetchContent` that returns the **structured** `RichSection` object
 * instead of an HTML string (a small simulated latency so you see loading).
 */
export function makeObjectFetchContent(
  delayMs = 200,
): FetchContent<unknown, RichSection> {
  return async (node, ctx) => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (ctx.signal.aborted) return richBody(node);
    return richBody(node);
  };
}

/**
 * Builds a `fetchContent` for the demo. Pure prose by default; pass options to
 * stage the slow / failing / empty cases for the states example.
 */
export function makeFetchContent<Meta = unknown>(
  opts: FetchOptions = {},
): FetchContent<Meta> {
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
