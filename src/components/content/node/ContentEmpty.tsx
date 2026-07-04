import type { JSX } from 'react';

export function ContentEmpty(): JSX.Element {
  return (
    <p className="br-content__empty" data-part="content-empty">
      No content.
    </p>
  );
}
