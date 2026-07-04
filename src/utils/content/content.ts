/**
 * Whether a resolved payload counts as "empty" (drives the `'empty'`
 * {@link import('../../types').ContentStatus}): a string payload is empty when
 * blank; a nullish payload is always empty.
 */
export const isEmptyContent = (content: unknown): boolean =>
  content == null || (typeof content === 'string' && content.trim() === '');
