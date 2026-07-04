import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Observe an element's content-box width. Sets the initial width before paint
 * (so the responsive collapse decision doesn't flash) and tracks resizes via a
 * ResizeObserver — mirrors the measurement pattern in hooks/useVirtualList.ts.
 */
export function useElementWidth<T extends HTMLElement>(): [
  RefObject<T>,
  number,
] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => {
      // Read the live content-box width off the element rather than the entry's
      // contentRect: simpler, and robust to environments that omit it.
      const node = ref.current;
      if (node) setWidth(node.clientWidth);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}
