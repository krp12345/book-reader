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
  FetchPath,
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

/**
 * Ancestry resolver for the lazy atlas: ids are '/'-encoded paths (`lz/3/2/1`),
 * so a node's ancestors are just its prefixes (`lz`, `lz/3`, `lz/3/2`). Lets a
 * `defaultLocation` deep-link into a section buried in unfetched lazy parts — the
 * reader resolves each prefix in turn until the target exists, then scrolls to it.
 */
export function makeLazyFetchPath(): FetchPath {
  return (nodeId) => {
    const parts = nodeId.split('/');
    if (parts.length <= 1) return [];
    return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'));
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
 *
 * Queries starting with `zz` deterministically match **nothing** and return a
 * results book with no showable content — exercising the book-level "no results"
 * empty state (M11).
 */
export function makeLazySearch(delayMs = 400): SearchFn {
  return async (query, ctx) => {
    const started = fetchBus.start('search', query || '(empty)');
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (ctx.signal.aborted) {
      fetchBus.abort('search', query, started);
      return [];
    }
    if (query.trim().toLowerCase().startsWith('zz')) {
      fetchBus.ok('search', query, started, '0 groups');
      return {
        id: 'q',
        title: `No matches for “${query}”`,
        hasContent: false,
        children: [],
      };
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

// ---------------------------------------------------------------------------
// Asymmetric-depth lazy book (the "4.9.9.9.9" effective-neighbour case)
// ---------------------------------------------------------------------------
//
// Neighbouring lazy branches of **different** depths, so the effective prev/next
// resolution is proven depth-independent: scrolling up from the shallow Part's
// first section must recursively resolve the deep Part above down to its
// deepest-LAST leaf; scrolling down past the shallow Part's last section must
// resolve the next Part down to its leftmost-deep leaf. Ids are '/'-paths
// (`az/0/2/2/2`) so `makeLazyFetchPath` works for deep-links here too.

/** Leaf depth (total id segments) per part index: az/0 → 5, az/1 → 3, az/2 → 4. */
const AZ_LEAF_DEPTH: Record<string, number> = { '0': 5, '1': 3, '2': 4 };
const AZ_FANOUT = 3;

function azTitle(id: string): string {
  faker.seed(seedFrom(id));
  const label = id.split('/').slice(1).join('.');
  return `${label} — ${heading()}`;
}

/**
 * Root + 3 lazy Parts of asymmetric depth: Part 1 (`az/0`) is 5 levels deep,
 * Part 2 (`az/1`) is 3 levels (its children are leaves), Part 3 (`az/2`) is 4.
 * So the DFS-previous of `az/1/0` is `az/0/2/2/2` (the deep Part's deepest-last
 * leaf) and the DFS-next of `az/1/2` is `az/2/0/0` (the next Part's
 * leftmost-deep leaf) — the user's core effective-neighbour vision case.
 */
export function makeAsymmetricBook(): BookNode {
  faker.seed(321);
  return {
    id: 'az',
    title: `${heading()} — Asymmetric Depths`,
    hasContent: false,
    children: Array.from({ length: AZ_FANOUT }, (_, i) => {
      const id = `az/${i}`;
      return { id, title: `Part ${i + 1} (${AZ_LEAF_DEPTH[String(i)]}-level). ${azTitle(id)}`, lazy: true, hasContent: false };
    }),
  };
}

/** Deterministic children for an asymmetric branch id (see {@link makeAsymmetricBook}). */
export function makeAsymmetricFetchChildren(delayMs = 250): FetchChildren {
  return async (node, ctx) => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (ctx.signal.aborted) return [];
    const segments = node.id.split('/');
    const leafDepth = AZ_LEAF_DEPTH[segments[1] ?? ''] ?? 3;
    const childDepth = segments.length + 1;
    const leaf = childDepth >= leafDepth;
    return Array.from({ length: AZ_FANOUT }, (_, i) => {
      const cid = `${node.id}/${i}`;
      const child: BookNode = { id: cid, title: azTitle(cid) };
      return leaf ? child : { ...child, lazy: true, hasContent: false };
    });
  };
}

// ---------------------------------------------------------------------------
// Edge-case books (empty / single-section / custom reading order)
// ---------------------------------------------------------------------------

/** A book with no showable content at all — exercises the book-level empty state. */
export function makeEmptyBook(): BookNode {
  return { id: 'e', title: 'An Empty Book', hasContent: false, children: [] };
}

/** A book with exactly one content-bearing section (virtualizer mount-all path). */
export function makeSingleBook(): BookNode {
  faker.seed(11);
  return {
    id: 'one',
    title: 'A One-Section Book',
    hasContent: false,
    children: [{ id: 'one.s0', title: `The Only Section. ${heading()}` }],
  };
}

/**
 * A flat 6-chapter book for the custom reading-order example: the demo's
 * `getNextNode`/`getPrevNode` overrides walk only the even chapters
 * ("abridged"), so odd chapters never enter the reading surface.
 */
export function makeOrderBook(): BookNode {
  faker.seed(17);
  return {
    id: 'o',
    title: 'An Abridged Reading Order',
    hasContent: false,
    children: Array.from({ length: 6 }, (_, i) => ({
      id: `o.c${i}`,
      title: `Chapter ${i + 1}${i % 2 === 0 ? '' : ' (skipped in abridged order)'}. ${heading()}`,
    })),
  };
}

/**
 * A `fetchChildren` that **throws on the first attempt** for the given ids (and
 * succeeds on retry), so the lazy-branch error + retry path can be exercised.
 * Otherwise identical to {@link makeLazyFetchChildren} but over a small, local
 * id space (children are content-bearing leaves).
 */
export function makeFailingFetchChildren(
  failFirstFor: Set<string>,
  delayMs = 200,
): FetchChildren {
  const attempts = new Map<string, number>();
  return async (node, ctx) => {
    const started = fetchBus.start('children', node.id);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (ctx.signal.aborted) {
      fetchBus.abort('children', node.id, started);
      return [];
    }
    if (failFirstFor.has(node.id)) {
      const n = (attempts.get(node.id) ?? 0) + 1;
      attempts.set(node.id, n);
      if (n === 1) {
        fetchBus.abort('children', node.id, started);
        throw new Error('simulated children fetch failure');
      }
    }
    const children = Array.from({ length: 3 }, (_, i) => ({
      id: `${node.id}/${i}`,
      title: `Recovered section ${i + 1}. ${heading()}`,
    })) satisfies BookNode[];
    fetchBus.ok('children', node.id, started, `${children.length} children`);
    return children;
  };
}

/**
 * A tiny book that stages every content lifecycle state for the "States &
 * errors" example: a section whose fetch **fails then recovers on retry**, an
 * **empty** section, a normal one, and a **lazy branch whose child fetch fails
 * first**. Ids are stable so tests can target each state directly.
 */
export function makeStatesBook(): BookNode {
  return {
    id: 'st',
    title: 'States & Errors',
    hasContent: false,
    children: [
      { id: 'st.err', title: 'A section whose fetch fails (then retries)' },
      { id: 'st.empty', title: 'A section with no content' },
      { id: 'st.ok', title: 'A normal section' },
      {
        id: 'st.lazy',
        title: 'A lazy branch whose children fail to load (then retry)',
        lazy: true,
        hasContent: false,
      },
    ],
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
