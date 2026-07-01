import { useState, type JSX, type KeyboardEvent } from 'react';
import type { RenderSearch, SearchApi } from '../types';

export interface TreeSearchProps {
  onSearch: (query: string) => void;
  onReset?: (() => void) | undefined;
  isSearching: boolean;
  error: unknown;
  placeholder?: string | undefined;
  renderSearch?: RenderSearch | undefined;
  className?: string | undefined;
}

/**
 * The tree-pane search box. Submitting (Enter / Search button) re-roots the
 * whole book via the consumer's `onSearch`; Reset restores it via `onReset`.
 * There are no result lists — search *replaces* the tree. A `renderSearch` prop
 * can replace this entire UI; it receives the same {@link SearchApi}.
 */
export function TreeSearch(props: TreeSearchProps): JSX.Element {
  const {
    onSearch,
    onReset,
    isSearching,
    error,
    placeholder = 'Search…',
    renderSearch,
    className,
  } = props;
  const [query, setQuery] = useState('');

  const api: SearchApi = {
    query,
    setQuery,
    submit: () => onSearch(query),
    reset: () => onReset?.(),
    isSearching,
    error,
    canReset: onReset !== undefined,
  };

  if (renderSearch) return <>{renderSearch(api)}</>;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSearch(query);
    }
  };

  return (
    <div
      className={['br-tree-search', className].filter(Boolean).join(' ')}
      data-part="tree-search"
      data-searching={isSearching || undefined}
      role="search"
    >
      <input
        type="search"
        className="br-tree-search__input"
        data-part="tree-search-input"
        value={query}
        placeholder={placeholder}
        aria-label="Search the book"
        disabled={isSearching}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="br-tree-search__submit"
        data-part="tree-search-submit"
        disabled={isSearching}
        onClick={() => onSearch(query)}
      >
        Search
      </button>
      {onReset && (
        <button
          type="button"
          className="br-tree-search__reset"
          data-part="tree-search-reset"
          disabled={isSearching}
          onClick={() => onReset()}
        >
          Reset
        </button>
      )}
      {error !== undefined && error !== null && (
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
