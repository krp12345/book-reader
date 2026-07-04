import type { JSX } from 'react';

export interface ContentErrorProps {
  error: unknown;
  retry: () => void;
}

export function ContentError({ retry }: ContentErrorProps): JSX.Element {
  return (
    <div className="br-content__error" data-part="content-error" role="alert">
      <span>Couldn’t load this section.</span>
      <button
        type="button"
        className="br-content__retry"
        data-part="content-retry"
        onClick={retry}
      >
        Retry
      </button>
    </div>
  );
}
