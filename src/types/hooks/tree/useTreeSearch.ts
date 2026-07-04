import type { KeyboardEvent } from 'react';
import type { SearchApi } from '../../public';

export interface UseTreeSearchOptions {
  onSearch: (query: string) => void;
  onReset?: (() => void) | undefined;
  isSearching: boolean;
  error: unknown;
}

export interface TreeSearchState {
  /** The control surface (also handed to a custom `renderSearch`). */
  api: SearchApi;
  /** Enter submits the query. */
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}
