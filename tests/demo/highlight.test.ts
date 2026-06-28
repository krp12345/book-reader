/**
 * Pure highlight helpers behind the "Text selection" demo (example 7).
 *
 * These are what make staged selections survive **virtualization**: a section's
 * DOM is destroyed when it scrolls out and recreated when it scrolls back, so
 * the highlight is stored as a character *range* and re-painted on remount.
 * These tests prove the offset model + wrapping is stable, and — crucially —
 * that re-applying a stored range to a freshly-rendered (identical) DOM restores
 * the exact same highlight (the "remount" case).
 */
import { describe, it, expect } from 'vitest';
import {
  applyHighlights,
  pointOffset,
  unwrapHighlights,
  wrapRange,
} from '../../demo/highlight';

function makeBody(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

function markText(root: Element): string[] {
  return [...root.querySelectorAll('mark[data-sel-highlight]')].map(
    (m) => m.textContent ?? '',
  );
}

describe('demo/highlight — pointOffset', () => {
  it('counts characters to a point inside a single text node', () => {
    const body = makeBody('<p>Hello world</p>');
    const text = body.querySelector('p')!.firstChild as Text;
    expect(pointOffset(body, text, 5)).toBe(5);
  });

  it('counts across block boundaries with no separators added', () => {
    // Unlike Selection.toString(), the model concatenates text nodes directly:
    // "ab" + "cd" => offset of "c" boundary in the 2nd block is 2 + 1 = 3.
    const body = makeBody('<p>ab</p><p>cd</p>');
    const second = body.querySelectorAll('p')[1]!.firstChild as Text;
    expect(pointOffset(body, second, 1)).toBe(3);
  });
});

describe('demo/highlight — wrap / unwrap', () => {
  it('wraps a sub-range within one text node', () => {
    const body = makeBody('<p>Hello world</p>');
    wrapRange(body, 0, 5);
    expect(markText(body)).toEqual(['Hello']);
    expect(body.textContent).toBe('Hello world');
  });

  it('wraps a range that spans two blocks (one mark per block)', () => {
    const body = makeBody('<p>abc</p><p>def</p>'); // "abcdef"
    wrapRange(body, 1, 5); // "bcde"
    expect(markText(body)).toEqual(['bc', 'de']);
    expect(body.textContent).toBe('abcdef');
  });

  it('round-trips: unwrap restores the original text + structure', () => {
    const html = '<p>Hello world</p>';
    const body = makeBody(html);
    wrapRange(body, 6, 11); // "world"
    expect(markText(body)).toEqual(['world']);
    unwrapHighlights(body);
    expect(markText(body)).toEqual([]);
    expect(body.innerHTML).toBe(html);
  });
});

describe('demo/highlight — applyHighlights', () => {
  it('paints multiple disjoint ranges', () => {
    const body = makeBody('<p>abcdef</p>');
    applyHighlights(body, [
      { start: 0, end: 2 },
      { start: 4, end: 6 },
    ]);
    expect(markText(body)).toEqual(['ab', 'ef']);
  });

  it('is idempotent — re-applying the same set does not double-wrap', () => {
    const body = makeBody('<p>abcdef</p>');
    applyHighlights(body, [{ start: 1, end: 4 }]);
    applyHighlights(body, [{ start: 1, end: 4 }]);
    expect(markText(body)).toEqual(['bcd']);
    expect(body.textContent).toBe('abcdef');
  });

  it('clears highlights when given an empty set (unstage)', () => {
    const body = makeBody('<p>abcdef</p>');
    applyHighlights(body, [{ start: 1, end: 4 }]);
    applyHighlights(body, []);
    expect(markText(body)).toEqual([]);
    expect(body.innerHTML).toBe('<p>abcdef</p>');
  });

  it('tags each painted mark with its staged id (so it can be unstaged on click)', () => {
    const body = makeBody('<p>abcdef</p>');
    applyHighlights(body, [
      { start: 0, end: 2, id: 'sel-1' },
      { start: 4, end: 6, id: 'sel-2' },
    ]);
    const marks = [...body.querySelectorAll('mark[data-sel-highlight]')];
    expect(marks.map((m) => m.getAttribute('data-sel-id'))).toEqual([
      'sel-1',
      'sel-2',
    ]);
  });

  it('restores the identical highlight on a fresh (remounted) DOM', () => {
    // Capture a range against one render…
    const original = makeBody('<p>Hello world</p>');
    const text = original.querySelector('p')!.firstChild as Text;
    const range = {
      start: pointOffset(original, text, 6),
      end: pointOffset(original, text, 11),
    };

    // …then re-paint it onto a brand-new identical DOM (what happens when
    // virtualization unmounts the section and mounts it again).
    const remounted = makeBody('<p>Hello world</p>');
    applyHighlights(remounted, [range]);
    expect(markText(remounted)).toEqual(['world']);
  });
});
