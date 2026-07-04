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

/** Format a `number | string` CSS length: numbers become `px`, strings pass through. */
export function toCssLength(value: number | string): string {
  return typeof value === 'number' ? `${value}px` : value;
}
