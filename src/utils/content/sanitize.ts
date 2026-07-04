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

const ALLOWED_TAGS = new Set([
  'a',
  'abbr',
  'address',
  'article',
  'aside',
  'b',
  'blockquote',
  'br',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'details',
  'dfn',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'ins',
  'kbd',
  'li',
  'main',
  'mark',
  'nav',
  'ol',
  'p',
  'picture',
  'pre',
  'q',
  's',
  'samp',
  'section',
  'small',
  'source',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'u',
  'ul',
  'var',
  'wbr',
]);

const GLOBAL_ATTR = new Set(['class', 'id', 'title', 'lang', 'dir', 'role']);

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

const URL_ATTR = new Set(['href', 'src', 'srcset']);

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

function unwrap(el: Element): void {
  el.replaceWith(...Array.from(el.childNodes));
}

export function resolveSanitizer(
  option: import('../../types').SanitizeOption | undefined,
): (html: string) => string {
  if (option === false) return (html) => html;
  if (typeof option === 'function') return option;
  return sanitizeHtml;
}

/**
 * Payload-level sanitizer over {@link resolveSanitizer}: sanitization is a
 * string-only concern, so string payloads run through the HTML sanitizer and
 * object payloads pass through untouched.
 */
export function resolveContentSanitizer(
  option: import('../../types').SanitizeOption | undefined,
): <Content>(content: Content) => Content {
  const applyHtml = resolveSanitizer(option);
  return <Content>(content: Content): Content =>
    typeof content === 'string' ? (applyHtml(content) as Content) : content;
}

export function sanitizeHtml(html: string): string {
  if (html === '') return '';

  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc
    .querySelectorAll(Array.from(DROP_WITH_CONTENT).join(','))
    .forEach((el) => el.remove());

  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    if (!el.isConnected) continue;
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
