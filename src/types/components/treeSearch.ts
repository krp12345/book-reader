import type { RenderSearch } from '../public';

export interface TreeSearchProps {
  onSearch: (query: string) => void;
  onReset?: (() => void) | undefined;
  isSearching: boolean;
  error: unknown;
  placeholder?: string | undefined;
  renderSearch?: RenderSearch | undefined;
  className?: string | undefined;
}
