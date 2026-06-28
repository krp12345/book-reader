/**
 * `renderContentNode` — the per-section *wrapper* render prop. Verified through
 * `<BookReader>`: the consumer's element replaces the default `<article>`, the
 * spread `wrapperProps` carry the data-part / data-node-id / status hooks (and
 * the measurement ref the height map needs), and it composes with `renderContent`.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookReader } from '../../src/BookReader';
import type {
  BookNode,
  FetchContent,
  RenderContentNode,
} from '../../src/types';

const book: BookNode = { id: 'a', title: 'A' };
const fc: FetchContent = () => '<p>Body</p>';

const wrapper: RenderContentNode = ({ node, state, wrapperProps, children }) => (
  <section {...wrapperProps} data-testid={`wrap-${node.id}`}>
    <span data-testid="status">{state.status}</span>
    {children}
  </section>
);

describe('BookReader — renderContentNode', () => {
  it('uses the consumer element and spreads the wrapper hooks onto it', async () => {
    render(<BookReader tree={book} fetchContent={fc} renderContentNode={wrapper} />);

    const wrap = await screen.findByTestId('wrap-a');
    // The consumer picked the tag…
    expect(wrap.tagName).toBe('SECTION');
    // …and the spread props kept the stable hooks the skin + active tracking use.
    expect(wrap).toHaveAttribute('data-part', 'content-node');
    expect(wrap).toHaveAttribute('data-node-id', 'a');
    expect(wrap).toHaveAttribute('data-status', 'loaded');
    expect(wrap).toHaveClass('br-content-node');
    // The body (default string renderer here) renders *inside* the wrapper.
    expect(wrap.querySelector('[data-part="content-html"]')).not.toBeNull();
    expect(screen.getByTestId('status')).toHaveTextContent('loaded');
  });

  it('falls back to the default <article> wrapper when not supplied', async () => {
    const { container } = render(<BookReader tree={book} fetchContent={fc} />);
    await screen.findByText('Body');
    const node = container.querySelector('[data-part="content-node"]');
    expect(node?.tagName).toBe('ARTICLE');
  });

  it('passes the full node — including meta — to renderContentNode', async () => {
    interface Meta {
      category: string;
    }
    const metaBook: BookNode<Meta> = {
      id: 'm',
      title: 'Chapter M',
      meta: { category: 'history' },
    };
    const fcMeta: FetchContent<Meta> = () => '<p>Body</p>';
    const metaWrapper: RenderContentNode<Meta> = ({
      node,
      wrapperProps,
      children,
    }) => (
      <article {...wrapperProps} data-testid="wrap-m">
        <span data-testid="cat">{node.meta?.category}</span>
        <span data-testid="title">{node.title}</span>
        {children}
      </article>
    );

    render(
      <BookReader<Meta, string>
        tree={metaBook}
        fetchContent={fcMeta}
        renderContentNode={metaWrapper}
      />,
    );

    await screen.findByTestId('wrap-m');
    // The custom renderer sees node.meta and node.title, not just the content.
    expect(screen.getByTestId('cat')).toHaveTextContent('history');
    expect(screen.getByTestId('title')).toHaveTextContent('Chapter M');
  });

  it('composes with renderContent (inner body inside the custom wrapper)', async () => {
    render(
      <BookReader
        tree={book}
        fetchContent={fc}
        renderContent={() => <i data-testid="body">custom body</i>}
        renderContentNode={wrapper}
      />,
    );
    const wrap = await screen.findByTestId('wrap-a');
    expect(wrap.querySelector('[data-testid="body"]')).not.toBeNull();
    // The inner-body render prop wins over the default string path.
    expect(wrap.querySelector('[data-part="content-html"]')).toBeNull();
  });
});
