import type { JSX } from 'react';

export function ContentLoading(): JSX.Element {
  return (
    <p className="br-content__loading" data-part="content-loading">
      Loading…
    </p>
  );
}
