import { useState, type KeyboardEvent } from 'react';
import type { SearchApi } from '../../types';
import type { TreeSearchState, UseTreeSearchOptions } from '../../types/hooks';

export type { TreeSearchState, UseTreeSearchOptions } from '../../types/hooks';

/**
 * The search box's behavior: query state + the {@link SearchApi} control
 * surface. The component (or a custom `renderSearch`) only renders it.
 */
export function useTreeSearch(options: UseTreeSearchOptions): TreeSearchState {
  const { onSearch, onReset, isSearching, error } = options;
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

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSearch(query);
    }
  };

  return { api, onInputKeyDown };
}
