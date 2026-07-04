import type { JSX } from 'react';
import type { LazyContentPlaceholderProps } from '../../../types/components';

export type { LazyContentPlaceholderProps } from '../../../types/components';

/**
 * The reading-surface stand-in for an unresolved `lazy` branch reached by
 * scrolling. It occupies reading order (so the view never jumps past a branch
 * that is still loading) and carries the measurement `ref` virtualization needs.
 */
export function LazyContentPlaceholder({
  status,
  onRetry,
  measureRef,
}: LazyContentPlaceholderProps): JSX.Element {
  return (
    <article
      ref={measureRef}
      className="br-content-node br-content-node--lazy"
      data-part="content-node"
      data-status={status === 'error' ? 'error' : 'loading'}
      aria-busy={status === 'loading' || undefined}
    >
      {status === 'loading' ? (
        <p className="br-content__loading" data-part="content-lazy-loading">
          Loading section…
        </p>
      ) : (
        <div
          className="br-content__error"
          data-part="content-lazy-error"
          role="alert"
        >
          <span>Couldn’t load this section.</span>
          {onRetry && (
            <button
              type="button"
              className="br-content__retry"
              data-part="content-lazy-retry"
              onClick={onRetry}
            >
              Retry
            </button>
          )}
        </div>
      )}
    </article>
  );
}
