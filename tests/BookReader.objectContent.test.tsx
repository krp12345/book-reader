/**
 * Generic (object) content payload — driven through the public `<BookReader>`,
 * not the content modules in isolation, so the test proves the *user-visible*
 * contract: a non-string `fetchContent` result is handed back to `renderContent`
 * untouched (no sanitize, no `dangerouslySetInnerHTML`), while the string path is
 * unchanged. No mocks — just a sync fetcher and a real render.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookReader } from '../src/BookReader';
import type { BookNode, ContentState, FetchContent } from '../src/types';

const leaf: BookNode = { id: 'a', title: 'A', hasChildren: false };
// A single-node book keeps exactly one content node mounted.
const book: BookNode = { id: 'a', title: 'A' };

interface Rich {
  heading: string;
  // An HTML-looking field: if the object path were ever sanitized or HTML-injected
  // this would be mangled/escaped. It must pass through verbatim.
  bodyHtml: string;
}

describe('BookReader — generic object content payload', () => {
  it('hands the typed object straight to renderContent (identity, status loaded)', async () => {
    const payload: Rich = { heading: 'Chapter', bodyHtml: '<b>bold</b>' };
    let received: unknown;
    let state: ContentState<Rich> | undefined;

    const fetchContent: FetchContent<unknown, Rich> = () => payload;

    render(
      <BookReader<unknown, Rich>
        tree={book}
        fetchContent={fetchContent}
        renderContent={(_node, content, s) => {
          received = content;
          state = s;
          return <div data-testid="obj">{content.heading}</div>;
        }}
      />,
    );

    await screen.findByTestId('obj');
    // Same object reference reaches the consumer — proof it was neither cloned
    // nor sanitized on the way through the cache/render pipeline.
    expect(received).toBe(payload);
    expect(state?.status).toBe('loaded');
    expect(state?.content).toBe(payload);
  });

  it('never sanitizes / HTML-injects the object path', async () => {
    const payload: Rich = { heading: 'H', bodyHtml: '<img src=x onerror=alert(1)>' };
    const { container } = render(
      <BookReader<unknown, Rich>
        tree={book}
        fetchContent={() => payload}
        renderContent={(_n, c) => <div data-testid="obj">{c.heading}</div>}
      />,
    );
    await screen.findByTestId('obj');
    // The default string renderer (the only path that uses
    // dangerouslySetInnerHTML) must never run for an object.
    expect(container.querySelector('[data-part="content-html"]')).toBeNull();
  });

  it('renders nothing (no unsafe default) for an object with no renderContent', async () => {
    const payload: Rich = { heading: 'H', bodyHtml: '<b>x</b>' };
    const { container } = render(
      <BookReader<unknown, Rich> tree={book} fetchContent={() => payload} />,
    );
    const node = await screen.findByText('A'); // tree row exists
    expect(node).toBeInTheDocument();
    const article = container.querySelector(
      '[data-part="content-node"][data-status="loaded"]',
    );
    expect(article).not.toBeNull();
    // Loaded, but no body markup emitted (no safe default for objects).
    expect(article?.querySelector('[data-part="content-html"]')).toBeNull();
    expect(article?.textContent).toBe('');
  });

  it('flags a nullish object payload as empty', async () => {
    const { container } = render(
      <BookReader<unknown, Rich | null>
        tree={book}
        fetchContent={() => null}
        renderContent={() => <div>never</div>}
      />,
    );
    await screen.findByText('No content.');
    expect(
      container.querySelector('[data-part="content-node"][data-status="empty"]'),
    ).not.toBeNull();
  });

  it('leaves the string path unchanged (sanitized + dangerouslySetInnerHTML)', async () => {
    const { container } = render(
      <BookReader
        tree={leaf}
        fetchContent={() => '<p>hello<script>alert(1)</script></p>'}
      />,
    );
    const html = await screen.findByText(/hello/);
    expect(html.closest('[data-part="content-html"]')).not.toBeNull();
    // The script was stripped by the default sanitizer.
    expect(container.querySelector('script')).toBeNull();
  });
});
