import type { JSX } from 'react';
import { useTreeSearch } from '../../../hooks/tree/useTreeSearch';
import { cx } from '../../../utils/common/cx';
import type { TreeSearchProps } from '../../../types/components';

export type { TreeSearchProps } from '../../../types/components';

/**
 * The tree-pane search box. Submitting (Enter / Search button) re-roots the
 * whole book via the consumer's `onSearch`; Reset restores it via `onReset`.
 * There are no result lists — search *replaces* the tree. A `renderSearch` prop
 * can replace this entire UI; it receives the same {@link SearchApi}. Purely
 * presentational: the query state lives in `hooks/tree/useTreeSearch.ts`.
 */
export function TreeSearch(props: TreeSearchProps): JSX.Element {
  const { placeholder = 'Search…', renderSearch, className } = props;
  const { api, onInputKeyDown } = useTreeSearch(props);

  if (renderSearch) return <>{renderSearch(api)}</>;

  return (
    <div
      className={cx('br-tree-search', className)}
      data-part="tree-search"
      data-searching={api.isSearching || undefined}
      role="search"
    >
      <input
        type="search"
        className="br-tree-search__input"
        data-part="tree-search-input"
        value={api.query}
        placeholder={placeholder}
        aria-label="Search the book"
        disabled={api.isSearching}
        onChange={(e) => api.setQuery(e.target.value)}
        onKeyDown={onInputKeyDown}
      />
      <button
        type="button"
        className="br-tree-search__submit"
        data-part="tree-search-submit"
        disabled={api.isSearching}
        onClick={api.submit}
      >
        Search
      </button>
      {api.canReset && (
        <button
          type="button"
          className="br-tree-search__reset"
          data-part="tree-search-reset"
          disabled={api.isSearching}
          onClick={api.reset}
        >
          Reset
        </button>
      )}
      {api.error !== undefined && api.error !== null && (
        <span
          className="br-tree-search__error"
          data-part="tree-search-error"
          role="alert"
        >
          Search failed.
        </span>
      )}
    </div>
  );
}
