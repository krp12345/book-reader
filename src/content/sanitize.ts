/**
 * Conservative, allowlist-based HTML sanitizer for fetched book content.
 *
 * Book bodies arrive as untrusted HTML strings (§2.2). Before they reach the DOM
 * via `dangerouslySetInnerHTML`, this strips anything that can execute or escape
 * the reading surface: scripts, styles, frames, inline event handlers, and unsafe
 * URL schemes. Unknown-but-harmless tags are *unwrapped* (their text is kept) so
 * content survives even when its markup is richer than our allowlist.
 *
 * Allowlist over denylist on purpose: a tag/attribute we've never heard of is
 * dropped, not trusted. Consumers who need different rules pass their own
 * `sanitize` function to `<BookReader>` instead.
 *
 * Pure (no React); relies on the DOM (browser / jsdom) for correct parsing —
 * regex-based HTML sanitizing is not safe.
 */

/** Elements removed together with their subtree (never just unwrapped). */
const DROP_WITH_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'base',
  'link',
  'meta',
  'title',
  'head',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'noscript',
  'template',
  'svg',
  'math',
]);

/** Tags allowed to remain. Anything else (and not dropped) is unwrapped. */
const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'address', 'article', 'aside', 'b', 'blockquote', 'br',
  'caption', 'cite', 'code', 'col', 'colgroup', 'dd', 'del', 'details',
  'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'footer', 'h1',
  'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'img', 'ins', 'kbd',
  'li', 'main', 'mark', 'nav', 'ol', 'p', 'picture', 'pre', 'q', 's',
  'samp', 'section', 'small', 'source', 'span', 'strong', 'sub', 'summary',
  'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time', 'tr', 'u',
  'ul', 'var', 'wbr',
]);

/** Attributes permitted on any allowed element. */
const GLOBAL_ATTR = new Set(['class', 'id', 'title', 'lang', 'dir', 'role']);

/** Extra attributes permitted on specific elements. */
const TAG_ATTR: Record<string, ReadonlySet<string>> = {
  a: new Set(['href', 'target', 'rel', 'name']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading', 'srcset', 'sizes']),
  source: new Set(['src', 'srcset', 'sizes', 'media', 'type']),
  time: new Set(['datetime']),
  td: new Set(['colspan', 'rowspan', 'headers']),
  th: new Set(['colspan', 'rowspan', 'scope', 'headers']),
  col: new Set(['span']),
  colgroup: new Set(['span']),
  ol: new Set(['start', 'reversed', 'type']),
  details: new Set(['open']),
};

/** Attributes whose value is a URL and must be scheme-checked. */
const URL_ATTR = new Set(['href', 'src', 'srcset']);

/** Schemes we refuse to emit, even on otherwise-allowed URL attributes. */
const UNSAFE_SCHEME = /^\s*(?:javascript|vbscript|data|file):/i;

function isAllowedAttr(tag: string, name: string): boolean {
  if (name.startsWith('on')) return false;
  if (name === 'style') return false;
  if (GLOBAL_ATTR.has(name)) return true;
  return TAG_ATTR[tag]?.has(name) ?? false;
}

function isSafeUrl(value: string): boolean {
  return !UNSAFE_SCHEME.test(value);
}

/** Replace an element with its child nodes, preserving the text/markup inside. */
function unwrap(el: Element): void {
  el.replaceWith(...Array.from(el.childNodes));
}

export function sanitizeHtml(html: string): string {
  if (html === '') return '';

  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Remove dangerous elements (and everything inside them) outright.
  doc
    .querySelectorAll(Array.from(DROP_WITH_CONTENT).join(','))
    .forEach((el) => el.remove());

  // Snapshot first: unwrapping mutates the live tree, but captured descendants
  // stay connected and still get visited.
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    if (!el.isConnected) continue; // dropped along with an ancestor
    const tag = el.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      unwrap(el);
      continue;
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (!isAllowedAttr(tag, name)) {
        el.removeAttribute(attr.name);
      } else if (URL_ATTR.has(name) && !isSafeUrl(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  }

  return doc.body.innerHTML;
}
