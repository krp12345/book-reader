/**
 * Last *user* scroll direction (programmatic sets — nav/corrections — don't
 * count). Disambiguates which side of the fold to pin when heights change or a
 * lazy placeholder straddling the fold is swapped for its children.
 */
export type ScrollDirection = 'down' | 'up';

/**
 * Whether a node's rendered height is final: content loaded (or definitively
 * empty). Lazy placeholders and still-fetching sections will change height, so
 * they make useless scroll anchors.
 */
export type IsSettled = (id: string) => boolean;

export interface HeightMeasurement {
  id: string;
  /** The node's current rendered height in px. */
  height: number;
}

export interface AnchoredCorrection {
  /** Scroll delta to add so the anchored content stays put. */
  correction: number;
  /** Whether any measurement changed the height map (window must recompute). */
  changed: boolean;
}
