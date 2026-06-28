import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Observe an element's content-box width. Sets the initial width before paint
 * (so the responsive collapse decision doesn't flash) and tracks resizes via a
 * ResizeObserver — mirrors the measurement pattern in content/useVirtualList.ts.
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

/**
 * Resolve a CSS length (number = px, or a string like '28rem' / '420px') to a
 * pixel number, for the collapse threshold math. `rem`/`em` are resolved
 * against the root font size; px and unitless are taken as-is. Unknown units
 * fall back to the parsed numeric value.
 */
export function lengthToPx(value: number | string): number {
  if (typeof value === 'number') return value;
  const trimmed = value.trim();
  const num = parseFloat(trimmed);
  if (Number.isNaN(num)) return 0;
  if (trimmed.endsWith('rem') || trimmed.endsWith('em')) {
    const rootFontSize =
      typeof window !== 'undefined'
        ? parseFloat(
            window.getComputedStyle(document.documentElement).fontSize,
          ) || 16
        : 16;
    return num * rootFontSize;
  }
  return num;
}
