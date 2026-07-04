# RESTRUCTURE.md — feature-uniform, view-hierarchy folder layout

> **Status: APPROVED — ready to execute.** Migration spec for reorganizing `src/`
> so every layer folder shares the **same feature buckets**, driven by the
> `<BookReader>` **view hierarchy**. No behavior change (same as the recent
> refactor commits). Written to be executed step-by-step (e.g. by Google
> Antigravity) with `pnpm build` + lint + typecheck green after each phase.

## ▶ For the agent executing this (read first)
- **This is a pure structural move — ZERO behavior change.** No logic, prop, type,
  or public-export changes. Only file locations + import paths (+ the mechanical
  component splits listed below). Success = **`src/index.ts` public exports are
  identical** and `pnpm build` + lint + typecheck are green.
- **Read `CLAUDE.md`, `CONVENTIONS.md`, `MILESTONES.md` first** — they hold the
  design; don't re-derive it by grepping.
- **HARD RULE — do NOT write tests and do NOT run `pnpm test` / `pnpm test:e2e`.**
  The only verification gate here is `pnpm build` + lint + typecheck. Update the
  `tests/` **import paths** (mechanical) but never run/author suites unless the
  human explicitly asks in that turn.
- Package manager is **pnpm** (never npm). Do not bump version, pack, or publish.
- Work in the **phase order** at the bottom; keep each phase independently green
  before starting the next. Update the docs in the final phase.

### Decisions locked (do not re-ask)
- **Buckets:** `bookReader` / `tree` / `content` / `common`, uniform in every folder.
- **Nesting:** aggressive (`view/`, `search/`, `overlay/`, `node/`) in `components/`
  + `hooks/`; single-level buckets in `core/` + `utils/`.
- **types/:** re-cut into `types/{bookReader,tree,content,common}/`, **one file per
  module inside each bucket** (not one combined `index.ts`) + a small barrel per
  bucket; **`types/public/` is UNCHANGED**.
- **Ownership (confirmed):** `treeStore` + `traversal` → `core/tree/`;
  `shouldCollapseTree` → `utils/tree/`; `useStoreVersion` + `useElementWidth`
  → `hooks/common/`.

## The organizing principle
Every top-level folder under `src/` (`components`, `hooks`, `core`, `utils`,
`types`) is cut into the **same four feature buckets**, mirroring the render tree:

```
BookReader                      → bucket: bookReader   (the shell/coordinator)
├── Tree side (left pane)       → bucket: tree
│   ├── TreePane
│   │   ├── TreeSearch          →   tree/search
│   │   └── TreePaneView        →   tree/view
│   │       └── (default) TreeNode row
│   └── TreeOverlay (collapsed) →   tree/overlay
└── Content side (right pane)   → bucket: content
    └── ContentPane
        └── ContentNode         →   content/node
            └── Loading / Empty / Error / LazyPlaceholder
```

Anything used by **more than one** bucket lives in that folder's **`common/`**
(created only where something is actually shared).

**Uniformity rule:** the *top-level buckets* (`bookReader` / `tree` / `content` /
`common`) appear in **every** folder. **Aggressive nesting** (the `view/`,
`search/`, `overlay/`, `node/` sub-buckets) applies where the code maps 1:1 to the
render nesting — `components/` and `hooks/` (each hook sits at the *same path* as
the component it powers). `core/` and `utils/` are React-free pure logic with no
render nesting, so they stop at the single feature bucket.

---

## Target tree

```
src/
  index.ts                      # UNCHANGED public exports (re-exports from types/public + core/*)

  components/
    bookReader/
      BookReader.tsx            # shell/layout only  → hooks/bookReader/useBookReader
      TreeToggleBar.tsx         # NEW — extracted from BookReader's collapsed toggle-bar JSX
    tree/
      TreePane.tsx              # container (was tree/TreePane.tsx, minus TreePaneView)
      view/
        TreePaneView.tsx        # SPLIT OUT of tree/TreePane.tsx  → hooks/tree/view/useTreePaneView
        defaultTreeNode.tsx     # the default row renderer (was tree/defaultTreeNode.tsx)
      search/
        TreeSearch.tsx          # → hooks/tree/search/useTreeSearch
      overlay/
        TreeOverlay.tsx         # → hooks/tree/overlay/useTreeOverlay
    content/
      ContentPane.tsx           # → hooks/content/useContentPane
      node/
        ContentNode.tsx         # → hooks/content/node/useNodeContent
        ContentLoading.tsx      # NEW — extracted DefaultLoading
        ContentEmpty.tsx        # NEW — extracted DefaultEmpty
        ContentError.tsx        # NEW — extracted DefaultError
        LazyContentPlaceholder.tsx
    # components/common/ — none today (no shared dumb component). Add only if one appears.

  hooks/
    bookReader/
      useBookReader.ts          # store+cache ownership, location, deep-link nav, search/reset, responsive collapse
    tree/
      useTreeState.ts           # expanded/selected state (tree-level, no single component)
      useLazyChildren.ts        # lazy children fetch orchestration (tree *structure* loading)
      view/
        useTreePaneView.ts      # visible-row flattening + roving-focus keyboard nav
      search/
        useTreeSearch.ts        # query state + SearchApi
      overlay/
        useTreeOverlay.ts       # popover dialog behavior
    content/
      useContentPane.ts         # reading order, lazy filtering, virtual-list wiring, active reporting
      useVirtualList.ts         # windowing + measurement + pin/prefetch + anchor apply
      node/
        useNodeContent.ts       # fetch+sanitize+cache pipeline per node
    common/
      useElementWidth.ts        # generic ResizeObserver width
      useStoreVersion.ts        # store version subscription (used by BOTH panes)

  core/                         # React-free; single-level feature buckets (no render nesting)
    tree/
      treeStore.ts              # normalized id-indexed tree; mutable + subscribable  (shared model — see NOTE 1)
      traversal.ts              # DFS reading order + resolve/showable walks           (shared — see NOTE 1)
      flatten.ts                # expanded-set → visible tree rows
    content/
      virtualizer.ts            # windowing + height map + anchor correction + offsetAt
      anchoring.ts              # direction-aware anchor-correction policy (LZ-UP fix)
      scrollSync.ts             # active-node detection, near-bottom, reading-order overrides
      cache.ts                  # bounded LRU content cache
    # core/common/ — none today.

  utils/
    content/
      sanitize.ts               # sanitize.ts (+resolveContentSanitizer)
      content.ts                # isEmptyContent
      prefetchNodeContent.ts    # fetch+sanitize+cache warm (mirrors useNodeContent)
    tree/
      collapse.ts               # shouldCollapseTree (responsive tree collapse) — see NOTE 2
    common/
      cx.ts                     # classname join
      length.ts                 # lengthToPx / toCssLength
      thenable.ts               # isThenable

  types/                        # re-cut by feature — ONE FILE PER MODULE per bucket; public barrel preserved
    public/                     # UNCHANGED — the API surface, re-exported by src/index.ts
      index.ts  node.ts  reading.ts  fetching.ts  search.ts  tree.ts  content.ts  cache.ts  props.ts
    bookReader/
      useBookReader.ts
      index.ts                  # bucket barrel (re-exports the files above)
    tree/
      treeStore.ts  traversal.ts  flatten.ts          # core contracts
      useTreeState.ts  useLazyChildren.ts  useTreePaneView.ts  useTreeSearch.ts  useTreeOverlay.ts  # hook shapes
      treePane.ts  treeSearch.ts  treeOverlay.ts       # component props
      index.ts                  # bucket barrel
    content/
      virtualizer.ts  anchoring.ts  scrollSync.ts  cache.ts    # core contracts
      useContentPane.ts  useNodeContent.ts  useVirtualList.ts  prefetch.ts  # hook shapes
      contentPane.ts  contentNode.ts  lazyContentPlaceholder.ts  # component props
      index.ts                  # bucket barrel
    common/                     # only internal shapes shared across buckets (create if any surface)
      index.ts
    index.ts                    # top-level barrel — re-exports public ONLY (so `../types` still resolves to public)

  styles/
    book-reader.css             # unchanged
```

---

## Per-file move table

### components/
| From | To |
|---|---|
| `components/BookReader.tsx` | `components/bookReader/BookReader.tsx` (+ extract `TreeToggleBar.tsx`) |
| `components/tree/TreePane.tsx` (TreePane) | `components/tree/TreePane.tsx` |
| `components/tree/TreePane.tsx` (TreePaneView) | **split →** `components/tree/view/TreePaneView.tsx` |
| `components/tree/defaultTreeNode.tsx` | `components/tree/view/defaultTreeNode.tsx` |
| `components/tree/TreeSearch.tsx` | `components/tree/search/TreeSearch.tsx` |
| `components/tree/TreeOverlay.tsx` | `components/tree/overlay/TreeOverlay.tsx` |
| `components/content/ContentPane.tsx` | `components/content/ContentPane.tsx` |
| `components/content/ContentNode.tsx` | `components/content/node/ContentNode.tsx` (+ extract Loading/Empty/Error) |
| `components/content/LazyContentPlaceholder.tsx` | `components/content/node/LazyContentPlaceholder.tsx` |

### hooks/
| From | To |
|---|---|
| `hooks/useBookReader.ts` | `hooks/bookReader/useBookReader.ts` |
| `hooks/useTreeState.ts` | `hooks/tree/useTreeState.ts` |
| `hooks/useLazyChildren.ts` | `hooks/tree/useLazyChildren.ts` |
| `hooks/useTreePaneView.ts` | `hooks/tree/view/useTreePaneView.ts` |
| `hooks/useTreeSearch.ts` | `hooks/tree/search/useTreeSearch.ts` |
| `hooks/useTreeOverlay.ts` | `hooks/tree/overlay/useTreeOverlay.ts` |
| `hooks/useContentPane.ts` | `hooks/content/useContentPane.ts` |
| `hooks/useVirtualList.ts` | `hooks/content/useVirtualList.ts` |
| `hooks/useNodeContent.ts` | `hooks/content/node/useNodeContent.ts` |
| `hooks/useElementWidth.ts` | `hooks/common/useElementWidth.ts` |
| `hooks/useStoreVersion.ts` | `hooks/common/useStoreVersion.ts` |

### core/
| From | To |
|---|---|
| `core/treeStore.ts` | `core/tree/treeStore.ts` |
| `core/traversal.ts` | `core/tree/traversal.ts` |
| `core/flatten.ts` | `core/tree/flatten.ts` |
| `core/virtualizer.ts` | `core/content/virtualizer.ts` |
| `core/anchoring.ts` | `core/content/anchoring.ts` |
| `core/scrollSync.ts` | `core/content/scrollSync.ts` |
| `core/cache.ts` | `core/content/cache.ts` |

### utils/
| From | To |
|---|---|
| `utils/sanitize.ts` | `utils/content/sanitize.ts` |
| `utils/content.ts` | `utils/content/content.ts` |
| `utils/prefetchNodeContent.ts` | `utils/content/prefetchNodeContent.ts` |
| `utils/collapse.ts` | `utils/tree/collapse.ts` |
| `utils/cx.ts` | `utils/common/cx.ts` |
| `utils/length.ts` | `utils/common/length.ts` |
| `utils/thenable.ts` | `utils/common/thenable.ts` |

### types/ (public/ stays; core+hooks+components collapse into feature buckets)
| From | To |
|---|---|
| `types/public/**` | **unchanged** |
| `types/core/treeStore.ts`, `traversal.ts` | `types/tree/index.ts` |
| `types/core/{virtualizer,anchoring,scrollSync,cache}.ts` | `types/content/index.ts` |
| `types/hooks/useBookReader.ts` | `types/bookReader/index.ts` |
| `types/hooks/{useTreeState,useLazyChildren,useTreePaneView,useTreeSearch,useTreeOverlay}.ts` | `types/tree/index.ts` |
| `types/hooks/{useContentPane,useNodeContent,useVirtualList,prefetch}.ts` | `types/content/index.ts` |
| `types/components/{treePane,treeSearch,treeOverlay}.ts` | `types/tree/index.ts` |
| `types/components/{contentPane,contentNode,lazyContentPlaceholder}.ts` | `types/content/index.ts` |

> **Decided: one file per module inside each bucket** (`types/tree/treeStore.ts`,
> …) + a small `index.ts` barrel per bucket. This keeps every impl module's
> re-export a near-mechanical path swap:
> `export type { X } from '../types/core/treeStore'` → `'../types/tree/treeStore'`.
> `types/public/**` and the top-level `types/index.ts` (public-only barrel) are
> untouched, so `../types` and `src/index.ts` still resolve exactly as today.

---

## Invariants to preserve (this is a NO-BEHAVIOR-CHANGE move)
1. **`src/index.ts` public exports are byte-for-byte the same** — only its import
   *paths* change. `../types` must still resolve to the **public** barrel only.
2. Each impl module keeps **importing its own moved types back and re-exporting**
   them (`export type { X } from '<new types path>'`), so `from './core/treeStore'`
   consumers become `from './core/tree/treeStore'` but the *type* re-export shape
   is unchanged.
3. `types/public/` is untouched (the deliberate API-barrel design).
4. `core/**` still imports **no React**.
5. `pnpm build` + lint + typecheck green after **each phase** below.
6. **`tests/` imports must be updated** to the new paths (mechanical) — but per the
   repo's HARD RULE, **do not run the suite** unless the user explicitly asks; a
   green `pnpm build` + typecheck is the gate here.
7. **Docs to update at the end:** `CLAUDE.md` (Architecture map), `CONVENTIONS.md`
   (types-layout section), `MILESTONES.md` (session log entry).

## Suggested phase order (each phase independently green)
1. **core/** (leaf-most; fewest inbound edits) → 2. **utils/** → 3. **types/**
   (rebuild bucket barrels + fix re-export paths) → 4. **hooks/** →
   5. **components/** (incl. the TreePaneView split + inline-subcomponent
   extractions) → 6. **docs + tests path fixup**.

---

## NOTES — ownership rationale (CONFIRMED — do not re-ask; just execute)
- **NOTE 1 — `treeStore` & `traversal` → `core/tree/`.** Both are consumed by the
  *content* side too (`scrollSync`, `useContentPane` read them for reading order).
  I placed them in `tree/` because they **are** the tree data-model + tree walks;
  the content side is a *consumer* of the tree, not the owner. Alternative:
  `core/common/`. **Recommend `core/tree/`.**
- **NOTE 2 — `utils/collapse.ts` (`shouldCollapseTree`) → `utils/tree/`.** It's a
  pure predicate about whether to collapse the *tree* pane; `useBookReader`
  (bookReader bucket) is the caller. Could go to `utils/bookReader/`.
  **Recommend `utils/tree/`** (it's about the tree), but easy to flip.
- **The `content` bucket = the whole reading surface** (right pane): reading order,
  virtualization, height/anchor mechanics, per-node fetch→sanitize→cache, scroll
  sync. That's why `virtualizer` / `anchoring` / `scrollSync` / `cache` (core),
  `sanitize` / `prefetchNodeContent` (utils), and `useContentPane` / `useVirtualList`
  / `useNodeContent` (hooks) all land under `content/`. `content/node/` is the
  per-section unit (one `ContentNode` + its loading/empty/error/lazy states).
```
