import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContentNode } from '../../src/components/content/node/ContentNode';
import { createContentCache } from '../../src/core/content/cache';
import type { BookNode, FetchContent } from '../../src/types';

const node: BookNode = { id: 'n1', title: 'Section 1' };

function renderNode(
  fetchContent: FetchContent,
  extra: Partial<React.ComponentProps<typeof ContentNode>> = {},
) {
  return render(
    <ContentNode node={node} path={[]} fetchContent={fetchContent} {...extra} />,
  );
}

describe('ContentNode — fetch lifecycle', () => {
  it('renders sanitized HTML from a synchronous fetcher', () => {
    renderNode(() => '<p>Hello <strong>world</strong></p><script>evil()</script>');
    expect(screen.getByText('world')).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('evil');
  });

  it('shows loading, then the resolved content, for an async fetcher', async () => {
    let resolve!: (html: string) => void;
    const fetchContent: FetchContent = () =>
      new Promise<string>((r) => (resolve = r));
    renderNode(fetchContent);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    resolve('<p>Arrived</p>');
    expect(await screen.findByText('Arrived')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('renders the empty state when content resolves to blank', async () => {
    renderNode(() => Promise.resolve('   '));
    expect(await screen.findByText('No content.')).toBeInTheDocument();
  });

  it('renders an error fallback and retries on demand', async () => {
    const user = userEvent.setup();
    let attempt = 0;
    const fetchContent: FetchContent = () => {
      attempt += 1;
      return attempt === 1
        ? Promise.reject(new Error('boom'))
        : Promise.resolve('<p>Recovered</p>');
    };
    renderNode(fetchContent);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Recovered')).toBeInTheDocument();
  });

  it('passes node + path + signal to the fetcher', () => {
    const fetchContent = vi.fn<FetchContent>(() => '<p>x</p>');
    render(
      <ContentNode
        node={node}
        path={['root']}
        fetchContent={fetchContent}
      />,
    );
    const ctx = fetchContent.mock.calls[0]?.[1];
    expect(fetchContent.mock.calls[0]?.[0]).toBe(node);
    expect(ctx?.path).toEqual(['root']);
    expect(ctx?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('ContentNode — sanitize toggle & custom renderers', () => {
  it('skips sanitization when sanitize={false}', () => {
    renderNode(() => '<p data-raw="1">kept</p>', { sanitize: false });
    expect(document.querySelector('[data-raw="1"]')).not.toBeNull();
  });

  it('uses a custom sanitize function when provided', () => {
    renderNode(() => 'original', { sanitize: () => 'replaced' });
    expect(screen.getByText('replaced')).toBeInTheDocument();
  });

  it('uses renderContent override for the body', () => {
    renderNode(() => '<p>raw</p>', {
      renderContent: (n) => <div>custom:{n.title}</div>,
    });
    expect(screen.getByText('custom:Section 1')).toBeInTheDocument();
  });

  it('exposes data-part and data-status hooks on the wrapper', () => {
    const { container } = renderNode(() => '<p>x</p>');
    const article = container.querySelector('[data-part="content-node"]');
    expect(article).not.toBeNull();
    expect(article).toHaveAttribute('data-status', 'loaded');
    expect(article).toHaveAttribute('data-node-id', 'n1');
  });
});

describe('ContentNode — caching (M4)', () => {
  it('caches sanitized HTML and re-enters synchronously (no loading flash, no re-fetch)', async () => {
    const cache = createContentCache();
    let resolve!: (html: string) => void;
    const fetchContent = vi.fn<FetchContent>(
      () => new Promise<string>((r) => (resolve = r)),
    );

    // First mount: async fetch settles and populates the cache.
    const first = render(
      <ContentNode node={node} path={[]} fetchContent={fetchContent} cache={cache} />,
    );
    resolve('<p>Cached body</p>');
    expect(await screen.findByText('Cached body')).toBeInTheDocument();
    first.unmount();

    // Re-mount the same node: the cached HTML is shown immediately, with no
    // "Loading…" flash, and the fetcher is not called a second time.
    render(
      <ContentNode node={node} path={[]} fetchContent={fetchContent} cache={cache} />,
    );
    expect(screen.getByText('Cached body')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(fetchContent).toHaveBeenCalledTimes(1);
  });

  it('de-duplicates concurrent loads of the same node via the shared cache', async () => {
    const cache = createContentCache();
    let resolve!: (html: string) => void;
    const fetchContent = vi.fn<FetchContent>(
      () => new Promise<string>((r) => (resolve = r)),
    );

    // Two mounts of the same node id while the first fetch is still pending.
    render(
      <>
        <ContentNode node={node} path={[]} fetchContent={fetchContent} cache={cache} />
        <ContentNode node={node} path={[]} fetchContent={fetchContent} cache={cache} />
      </>,
    );
    expect(fetchContent).toHaveBeenCalledTimes(1); // second consumer reused the in-flight load

    resolve('<p>Shared</p>');
    expect((await screen.findAllByText('Shared')).length).toBe(2);
  });
});
