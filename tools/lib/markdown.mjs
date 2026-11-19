/* ============================================================
   HTML -> Markdown for agents.

   The site has no templating layer, so the Markdown an agent reads
   is produced at build time from the same HTML a browser gets.
   That keeps the two representations from drifting: one source,
   two outputs.

   Only the content inside <main> is converted. Navigation, the
   language switcher, the footer and the contact form are chrome an
   agent does not need, and the acceptmarkdown.com guidance is
   explicit about stripping them.

   The output is GitHub-flavored Markdown: ATX headings, pipe
   tables, inline links and images with alt text. No front matter,
   no raw HTML fallbacks.
   ============================================================ */

import { parseHtml, findFirst, getAttr, hasClass } from './html.mjs';
import { getLocale, canonicalFor, SITE_URL } from './config.mjs';
import { decodeEntities } from './entities.mjs';

/* Elements that carry no readable content. */
const SKIP_TAGS = new Set([
  'script', 'style', 'noscript', 'canvas', 'svg', 'template',
  'iframe', 'video', 'audio', 'source', 'track', 'object', 'embed'
]);

/* Elements whose content is one inline flow and must not introduce
   paragraph breaks: the link text, the label of a card, and so on. */
const INLINE_TAGS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'em', 'i',
  'ins', 'kbd', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong',
  'sub', 'sup', 'time', 'u', 'var', 'del', 'br', 'wbr'
]);

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/* CSS classes whose subtree repeats a decorative wrapper many times
   over: the hidden switcher, the scroll hint, decorative overlays. */
const DECORATIVE_CLASSES = new Set([
  'skip-link', 'lang-switcher', 'hm-scroll', 'menu-toggle',
  'nav--mobile-overlay', 'hm-feature-bg', 'hm-feature-overlay',
  'hm-feature-cta', 'cp-media-bg', 'screen-reader-text', 'sr-only',
  'visually-hidden'
]);

/* Block-level elements: an <a> that wraps one of these is a card,
   not a link inside a sentence. */
const BLOCK_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'table',
  'figure', 'blockquote', 'pre', 'section', 'article', 'div', 'hr'
]);

/**
 * Convert one page of the site to Markdown.
 *
 * @param {string} source   the HTML of the page
 * @param {string} fileName the page file name (index.html, ...)
 * @param {string} locale   the locale of the page
 * @returns {string} Markdown, without front matter
 */
export function renderMarkdown(source, fileName, locale = 'ro') {
  const tree = parseHtml(source);
  const main = findFirst(tree, e => e.tag === 'main');
  if (!main) return '';

  const titleEl = findFirst(tree, e => e.tag === 'title');
  const title = titleEl ? inlineText(titleEl).trim() : '';
  const description = findFirst(tree, e =>
    e.tag === 'meta' && (getAttr(e, 'name') || '').toLowerCase() === 'description'
  );
  const summary = description ? (getAttr(description, 'content') || '').trim() : '';

  const lines = [];
  if (title) lines.push(`# ${title}`);
  if (summary) lines.push('', `> ${summary}`);

  const body = [];
  const context = {
    locale,
    fileName,
    title,
    headings: new Set()
  };
  walkBlocks(main, body, context);

  const markdown = trimBlankLines([...lines, '', ...body]).join('\n');
  return `${markdown}\n`;
}

/* ------------------------------------------------------------
   Block walk
   ------------------------------------------------------------ */

function walkBlocks(node, out, context) {
  for (const child of node.children || []) {
    if (child.type === 'element') {
      blockOf(child, out, context);
    } else if (child.type === 'text' || child.type === 'raw') {
      const text = cleanText(decodeEntities(child.value));
      if (text) out.push(text, '');
    }
  }
}

function blockOf(element, out, context) {
  const tag = element.tag;
  if (SKIP_TAGS.has(tag)) return;
  if (isDecorative(element)) return;

  if (HEADING_TAGS.has(tag)) {
    const level = Number(tag[1]);
    // The page title is already the H1 of the document, so an <h1>
    // inside the page (the hero wordmark) would repeat it.
    const text = inlineText(element).trim();
    if (level > 1 && text && !context.headings.has(text)) {
      context.headings.add(text);
      out.push(`${'#'.repeat(level)} ${text}`, '');
    }
    return;
  }

  /* A link that wraps whole blocks is a card: its heading becomes a
     heading linked to the page, its text a paragraph. A link inside a
     sentence never reaches here, because inlineText handles it. */
  if (tag === 'a' && wrapsBlocks(element)) {
    const href = absoluteUrl(getAttr(element, 'href') || '', context);
    cardOf(element, href, out, context);
    return;
  }

  if (tag === 'p') {
    const text = inlineText(element).trim();
    if (text) out.push(text, '');
    return;
  }

  if (tag === 'ul' || tag === 'ol') {
    listOf(element, out, context, 0);
    return;
  }

  if (tag === 'blockquote') {
    const inner = [];
    walkBlocks(element, inner, context);
    const text = trimBlankLines(inner).join(' ');
    if (text) out.push(`> ${text}`, '');
    return;
  }

  if (tag === 'table') {
    tableOf(element, out, context);
    return;
  }

  if (tag === 'figure') {
    const img = findFirst(element, e => e.tag === 'img');
    if (img) {
      const markdown = imageMarkdown(img, context);
      if (markdown) out.push(markdown, '');
    }
    const caption = findFirst(element, e => e.tag === 'figcaption');
    if (caption) {
      const text = inlineText(caption).trim();
      if (text) out.push(`_${text}_`, '');
    }
    return;
  }

  if (tag === 'img') {
    const markdown = imageMarkdown(element, context);
    if (markdown) out.push(markdown, '');
    return;
  }

  if (tag === 'pre') {
    const raw = (element.children || []).find(child => child.type === 'raw');
    const code = raw ? raw.value : inlineText(element);
    if (code.trim()) out.push('```', code.replace(/\s+$/, ''), '```', '');
    return;
  }

  if (tag === 'hr') {
    out.push('---', '');
    return;
  }

  if (INLINE_TAGS.has(tag)) {
    const text = inlineText(element).trim();
    if (text) out.push(text, '');
    return;
  }

  /* A container: a section, a card, a link wrapping a whole block.
     Its text is a heading plus a paragraph, so it recurses. When a
     container holds nothing but inline text (an <a> around a card
     label, a <div> of one line), the text is emitted as a paragraph
     so it is not lost. */
  const before = out.length;
  walkBlocks(element, out, context);
  if (out.length === before) {
    const text = inlineText(element).trim();
    if (text) out.push(text, '');
  }
}

/* ------------------------------------------------------------
   Cards: a whole block wrapped in one link
   ------------------------------------------------------------ */

function wrapsBlocks(element) {
  for (const child of element.children || []) {
    if (child.type !== 'element') continue;
    if (BLOCK_TAGS.has(child.tag)) return true;
  }
  return false;
}

/**
 * Render a card: its heading becomes a level-3 heading that links to
 * the page it opens, its text a paragraph underneath.
 */
function cardOf(element, href, out, context) {
  const heading = findFirst(element, e => HEADING_TAGS.has(e.tag));
  const texts = [];
  collectCardText(element, texts, context);

  if (heading) {
    const label = inlineText(heading).trim();
    if (label) out.push(`### ${href ? `[${label}](${href})` : label}`, '');
  }
  if (texts.length) out.push(texts.join(' '), '');
}

/** The card text, with the heading subtree left out of it. */
function collectCardText(element, out, context) {
  for (const child of element.children || []) {
    if (child.type === 'text' || child.type === 'raw') {
      const text = cleanText(decodeEntities(child.value));
      if (text) out.push(text);
      continue;
    }
    if (child.type !== 'element') continue;
    if (HEADING_TAGS.has(child.tag)) continue;
    if (isDecorative(child)) continue;
    if (SKIP_TAGS.has(child.tag)) continue;
    if (child.classList.includes('hm-feature-cta')) continue;

    if (INLINE_TAGS.has(child.tag) || child.tag === 'p') {
      const text = inlineText(child, context).trim();
      if (text) out.push(text);
      continue;
    }
    collectCardText(child, out, context);
  }
}

function listOf(element, out, context, depth) {
  const ordered = element.tag === 'ol';
  let index = 1;
  for (const item of element.children || []) {
    if (item.type !== 'element' || item.tag !== 'li') continue;
    if (isDecorative(item)) continue;

    const body = [];
    walkBlocks(item, body, context);
    const text = trimBlankLines(body).join(' ').replace(/^(?:[-*]|\d+\.)\s+/, '');
    if (!text) continue;

    const marker = ordered ? `${index}.` : '-';
    out.push(`${'  '.repeat(depth)}${marker} ${text}`);
    index += 1;
  }
  if (out.length && out[out.length - 1] !== '') out.push('');
}

function tableOf(element, out, context) {
  const rows = [];
  for (const section of element.children || []) {
    if (section.type !== 'element') continue;
    if (section.tag === 'tr') rows.push(section);
    if (section.tag === 'thead' || section.tag === 'tbody' || section.tag === 'tfoot') {
      for (const row of section.children || []) {
        if (row.type === 'element' && row.tag === 'tr') rows.push(row);
      }
    }
  }
  if (!rows.length) return;

  const cells = rows.map(row => {
    const out = [];
    for (const cell of row.children || []) {
      if (cell.type !== 'element' || (cell.tag !== 'td' && cell.tag !== 'th')) continue;
      out.push(inlineText(cell).replace(/\|/g, '\\|').trim());
    }
    return out;
  });
  if (!cells[0].length) return;

  const header = cells[0];
  out.push(`| ${header.join(' | ')} |`);
  out.push(`| ${header.map(() => '---').join(' | ')} |`);
  for (const row of cells.slice(1)) {
    const padded = header.map((_, i) => row[i] || '');
    out.push(`| ${padded.join(' | ')} |`);
  }
  out.push('');
}

/* ------------------------------------------------------------
   Inline rendering
   ------------------------------------------------------------ */

/**
 * Render the inline content of an element.
 *
 * Links become inline Markdown, images become image Markdown with
 * their alt text, `strong`/`em`/`code` become their Markdown
 * equivalents, and everything else contributes its text.
 */
function inlineText(element, context = {}) {
  let out = '';
  for (const child of element.children || []) {
    if (child.type === 'text' || child.type === 'raw') {
      out += decodeEntities(child.value);
      continue;
    }
    if (child.type !== 'element') continue;
    if (SKIP_TAGS.has(child.tag)) continue;
    if (isDecorative(child)) continue;

    if (child.tag === 'br') {
      out += ' ';
      continue;
    }

    if (child.tag === 'img') {
      const markdown = imageMarkdown(child, context, { inline: true });
      if (markdown) out += `${markdown} `;
      continue;
    }

    if (child.tag === 'a') {
      const href = absoluteUrl(getAttr(child, 'href') || '', context);
      const label = cleanText(inlineText(child, context));
      if (!label) continue;
      if (!href) {
        out += label;
        continue;
      }
      out += `[${label}](${href})`;
      continue;
    }

    if (child.tag === 'strong' || child.tag === 'b') {
      const text = cleanText(inlineText(child, context));
      out += text ? `**${text}**` : '';
      continue;
    }

    if (child.tag === 'em' || child.tag === 'i') {
      const text = cleanText(inlineText(child, context));
      out += text ? `*${text}*` : '';
      continue;
    }

    if (child.tag === 'code') {
      const text = cleanText(inlineText(child, context));
      out += text ? `\`${text}\`` : '';
      continue;
    }

    if (child.tag === 'svg' || child.tag === 'canvas') continue;

    out += inlineText(child, context);
  }
  return cleanText(out);
}

function imageMarkdown(element, context, { inline = false } = {}) {
  const src = absoluteUrl(getAttr(element, 'src') || '', context);
  if (!src) return '';
  const alt = cleanText(decodeEntities(getAttr(element, 'alt') || '')) || 'Image';
  const markdown = `![${alt}](${src})`;
  return inline ? markdown : markdown;
}

/* ------------------------------------------------------------
   Helpers
   ------------------------------------------------------------ */

function isDecorative(element) {
  for (const className of element.classList || []) {
    if (DECORATIVE_CLASSES.has(className)) return true;
  }
  if ((getAttr(element, 'aria-hidden') || '').toLowerCase() === 'true') {
    // A decorative wrapper, but a paragraph of text inside an
    // aria-hidden parent is still content; only skip wrappers that
    // hold nothing else.
    return !containsText(element);
  }
  return false;
}

function containsText(element) {
  for (const child of element.children || []) {
    if (child.type === 'text' && child.value.trim()) return true;
    if (child.type === 'element' && containsText(child)) return true;
  }
  return false;
}

/** Collapse whitespace, drop the runs that Markdown would misread. */
function cleanText(value) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Make a link absolute.
 *
 * The pages use relative hrefs so they also work from disk. An agent
 * reading the Markdown has no page context, so every internal link
 * has to carry the full URL of the locale it belongs to.
 */
function absoluteUrl(value, context) {
  if (!value) return '';
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  if (value.startsWith('#')) {
    const canonical = context.fileName
      ? canonicalFor(context.fileName, context.locale || 'ro')
      : SITE_URL;
    return `${canonical}${value}`;
  }
  if (/^(javascript:|data:)/i.test(value)) return '';

  const [pathPart, hash] = value.split('#');
  const suffix = hash ? `#${hash}` : '';
  const clean = pathPart.replace(/^\.\//, '').replace(/^\//, '');

  const prefix = getLocale(context.locale || 'ro').prefix;
  const base = prefix ? `${SITE_URL}/${prefix}` : SITE_URL;

  if (!clean) return `${base}/${suffix}`;
  if (/^(css|js|img|fonts)\//.test(clean)) return `${SITE_URL}/${clean}${suffix}`;
  if (clean === 'index.html') return `${base}/${suffix}`;
  return `${SITE_URL}${prefix ? `/${prefix}` : ''}/${clean}${suffix}`;
}

function trimBlankLines(lines) {
  const out = [];
  for (const line of lines) {
    if (line === '' && (out.length === 0 || out[out.length - 1] === '')) continue;
    out.push(line);
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out;
}

/** True when the element is a block of the site's chrome. */
export function isChrome(element) {
  return isDecorative(element) || SKIP_TAGS.has(element.tag);
}

/** Exposed for tests: the class names treated as chrome. */
export const CHROME_CLASSES = DECORATIVE_CLASSES;

/** Exposed for tests: whether a class marks a decorative wrapper. */
export function isDecorativeClass(className) {
  return hasClass({ classList: [className] }, className) && DECORATIVE_CLASSES.has(className);
}
