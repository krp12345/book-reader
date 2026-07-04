import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../src/utils/sanitize';

describe('sanitizeHtml — dangerous content', () => {
  it('drops <script> elements and their contents', () => {
    const out = sanitizeHtml('<p>hi</p><script>alert(1)</script>');
    expect(out).toContain('<p>hi</p>');
    expect(out).not.toContain('alert');
    expect(out).not.toContain('<script');
  });

  it('drops <style>, <iframe>, and other unsafe elements', () => {
    expect(sanitizeHtml('<style>body{}</style><p>x</p>')).not.toContain('<style');
    expect(sanitizeHtml('<iframe src="evil"></iframe><p>x</p>')).not.toContain(
      '<iframe',
    );
  });

  it('strips on* event-handler attributes', () => {
    const out = sanitizeHtml('<p onclick="steal()">hi</p>');
    expect(out).toContain('hi');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('steal');
  });

  it('removes javascript: URLs from href', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain('javascript:');
  });

  it('removes the style attribute', () => {
    const out = sanitizeHtml('<p style="position:fixed">x</p>');
    expect(out).not.toContain('style=');
  });
});

describe('sanitizeHtml — safe content is preserved', () => {
  it('keeps allowed formatting tags and text', () => {
    const html =
      '<h2>Title</h2><p>A <strong>bold</strong> <em>word</em>.</p>' +
      '<ul><li>one</li><li>two</li></ul>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('keeps safe http(s) and relative links with rel/target', () => {
    const html = '<a href="https://example.com" rel="noopener" target="_blank">x</a>';
    expect(sanitizeHtml(html)).toBe(html);
    expect(sanitizeHtml('<a href="/chapter/2">next</a>')).toBe(
      '<a href="/chapter/2">next</a>',
    );
  });

  it('keeps images with safe src and alt', () => {
    const html = '<img src="https://cdn/x.png" alt="x">';
    expect(sanitizeHtml(html)).toContain('<img');
    expect(sanitizeHtml(html)).toContain('alt="x"');
  });

  it('unwraps disallowed tags but keeps their text', () => {
    const out = sanitizeHtml('<marquee>scrolling <strong>text</strong></marquee>');
    expect(out).not.toContain('<marquee');
    expect(out).toContain('scrolling');
    expect(out).toContain('<strong>text</strong>');
  });

  it('preserves the className attribute for styling hooks', () => {
    expect(sanitizeHtml('<p class="lead">x</p>')).toBe('<p class="lead">x</p>');
  });

  it('returns plain text unchanged and handles empty input', () => {
    expect(sanitizeHtml('just words')).toBe('just words');
    expect(sanitizeHtml('')).toBe('');
  });
});
