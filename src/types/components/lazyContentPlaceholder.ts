export interface LazyContentPlaceholderProps {
  status: 'loading' | 'error';
  error?: unknown;
  onRetry?: (() => void) | undefined;
  measureRef?: ((el: HTMLElement | null) => void) | undefined;
}
