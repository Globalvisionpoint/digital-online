/* ============================================================
   Turning one Romanian page into a localized page.

   Besides translating the visible text, this also:
     - rewrites every internal link to the right language folder,
     - fixes asset paths (the page now lives one level deeper),
     - sets <html lang>, canonical, hreflang alternates,
       og:locale and og:locale:alternate,
     - injects the language switcher into the header,
     - injects the JSON-LD translations.
   ============================================================ */

import { parseHtml, findElements, findFirst, getAttr, hasClass, applyPatches } from './html.mjs';
import { localizePage } from './apply.mjs';
import { LOCALES, getLocale, canonicalFor, pagePath, relativePage, SITE_URL } from './config.mjs';
import { injectSwitcher, switcherScriptTag, stripSwitcher } from './inject.mjs';
import { asciiHeaderNavPatches } from './ascii-header.mjs';

/**
 * @param {string} source   Romanian HTML
 * @param {string} fileName page file name
 * @param {object} catalog  { [key]: translation }
 * @param {string} locale   target locale
 */
export function buildPage(source, fileName, catalog, locale) {
  const localeConfig = getLocale(locale);
  const tree = parseHtml(source);
  const patches = [];

  /* ---------- 0. Drop the Romanian switcher, if present ---------- */
  const cleaned = stripSwitcher(source);

  /* ---------- 1. Translate the content ---------- */
  let html = localizePage(cleaned, fileName, catalog, locale);

  /* ---------- 2. Rewrite the remaining markup ---------- */
  const tree2 = parseHtml(html);
  const patches2 = [];

  /* --- Asset paths: css, js, images, fonts live at the site root. --- */
  for (const el of findElements(tree2, e => ['link', 'script', 'img', 'source', 'video', 'audio'].includes(e.tag))) {
    for (const attrName of ['href', 'src', 'poster']) {
      const attr = (el.attrs || []).find(a => a.name.toLowerCase() === attrName);
      if (!attr || !attr.hasValue) continue;
      const value = attr.value;
      if (/^(https?:|data:|#|\/)/i.test(value)) continue;
      if (!/^(css|js|img|fonts)\//.test(value)) continue;
      const next = `../${value}`;
      if (next !== value) {
        patches2.push({ start: attr.valueStart, end: attr.valueEnd, text: next });
      }
    }
  }

  /* --- <link rel="canonical"> --- */
  const canonical = findFirst(tree2, e => e.tag === 'link' && (getAttr(e, 'rel') || '').toLowerCase() === 'canonical');
  if (canonical) {
    const attr = canonical.attrs.find(a => a.name.toLowerCase() === 'href');
    const next = canonicalFor(fileName, locale);
    if (attr && attr.hasValue && attr.value !== next) {
      patches2.push({ start: attr.valueStart, end: attr.valueEnd, text: next });
    }
  }

  /* --- hreflang alternates: replace the existing block --- */
  patches2.push(...replaceHreflang(tree2, fileName, locale));

  /* --- og:locale / og:locale:alternate --- */
  patches2.push(...replaceOgLocale(tree2, locale));

  /* --- og:url --- */
  const ogUrl = findFirst(tree2, e => e.tag === 'meta' && (getAttr(e, 'property') || '') === 'og:url');
  if (ogUrl) {
    const attr = ogUrl.attrs.find(a => a.name.toLowerCase() === 'content');
    const next = canonicalFor(fileName, locale);
    if (attr && attr.hasValue && attr.value !== next) {
      patches2.push({ start: attr.valueStart, end: attr.valueEnd, text: next });
    }
  }

  /* --- Desktop header navigation: fold to ASCII --- */
  if (localeConfig.asciiHeaderNav) {
    patches2.push(...asciiHeaderNavPatches(tree2));
  }

  html = applyPatches(html, patches2);

  /* ---------- 3. Switcher markup + script ---------- */
  html = injectSwitcher(html, fileName, locale);
  html = appendSwitcherScript(html, locale);

  return html;
}

/**
 * Insert the switcher and runtime-UI scripts.
 *
 * They go before the other page scripts: all of them are deferred,
 * so they execute in document order, and the runtime UI strings have
 * to be in place before theme.js and script.js ask for them.
 */
export function appendSwitcherScript(html, locale = 'ro') {
  if (html.includes('js/i18n-ui.js')) return html;

  const prefix = locale === 'ro' ? '' : '../';
  const tags = `    <script src="${prefix}js/i18n-ui.js" defer></script>\n` +
    `    <script src="${prefix}js/lang-switcher.js" defer></script>`;

  // Place them just before the first existing script of the page.
  const match = /[ \t]*<script src="[^"]*"[^>]*><\/script>/.exec(html);
  if (match) {
    const at = match.index;
    return html.slice(0, at) + tags + '\n' + html.slice(at);
  }

  const index = html.lastIndexOf('</body>');
  if (index === -1) return html;
  return html.slice(0, index) + tags + '\n  ' + html.slice(index);
}

/* ------------------------------------------------------------
   hreflang
   ------------------------------------------------------------ */

export function replaceHreflang(tree, fileName, locale) {
  const patches = [];
  const alternates = findElements(tree, e =>
    e.tag === 'link' && (getAttr(e, 'rel') || '').toLowerCase() === 'alternate' &&
    (getAttr(e, 'hreflang') || '') !== ''
  );

  const nl = newlineOf(tree);
  const block = LOCALES.map((l) => {
    const href = canonicalFor(fileName, l.code);
    return `    <link rel="alternate" hreflang="${l.hreflang}" href="${href}">`;
  }).join(nl);
  const xdefault = `    <link rel="alternate" hreflang="x-default" href="${canonicalFor(fileName, 'ro')}">`;
  const text = `${block}${nl}${xdefault}`;

  if (alternates.length) {
    // The whole block is replaced in one go, so a build never leaves
    // an empty line behind and never grows the indentation.
    // The trailing newline is part of the replaced range, so it has
    // to be written back too.
    const first = alternates[0];
    const last = alternates[alternates.length - 1];
    patches.push({ start: lineStartOf(first), end: lineEndOf(last), text: `${text}${nl}` });
  } else {
    // No alternates yet: insert them right before </head>.
    const head = findFirst(tree, e => e.tag === 'head');
    if (head) {
      patches.push({ start: head.openEnd, end: head.openEnd, text: `${nl}${text}` });
    }
  }

  return patches;
}

/**
 * The line ending the file uses.
 *
 * The source pages mix CRLF and LF, so a generated block has to use
 * the same one, or a build would rewrite the whole file.
 */
export function newlineOf(tree) {
  const head = findFirst(tree, e => e.tag === 'head');
  const probe = head || tree;
  const visit = (node) => {
    for (const child of node.children || []) {
      if (child.type === 'text' && child.value.includes('\n')) {
        return child.value.includes('\r\n') ? '\r\n' : '\n';
      }
      if (child.type === 'element') {
        const found = visit(child);
        if (found) return found;
      }
    }
    return null;
  };
  return visit(probe) || '\n';
}

/**
 * The offset of the beginning of the line an element sits on.
 *
 * The text node in front of the element holds the indentation of the
 * line. Replacing the element alone would leave that indentation
 * behind and add the new one on top of it, so the indentation has to
 * be part of the replacement.
 */
function lineStartOf(element) {
  const parent = element.parent;
  if (!parent || !parent.children) return element.start;

  const index = parent.children.indexOf(element);
  if (index <= 0) return element.start;

  const previous = parent.children[index - 1];
  if (!previous || previous.type !== 'text') return element.start;

  const newline = previous.value.lastIndexOf('\n');
  if (newline === -1) return element.start;

  return previous.start + newline + 1;
}

/**
 * The offset just after the line an element sits on, newline
 * included.
 */
function lineEndOf(element) {
  const parent = element.parent;
  if (!parent || !parent.children) return element.openEnd;

  const index = parent.children.indexOf(element);
  if (index < 0 || index >= parent.children.length - 1) return element.openEnd;

  const next = parent.children[index + 1];
  if (!next || next.type !== 'text') return element.openEnd;

  const newline = next.value.indexOf('\n');
  if (newline === -1) return element.openEnd;

  return next.start + newline + 1;
}

/* ------------------------------------------------------------
   Open Graph locale
   ------------------------------------------------------------ */

export function replaceOgLocale(tree, locale) {
  const patches = [];
  const config = getLocale(locale);

  const ogLocale = findFirst(tree, e => e.tag === 'meta' && (getAttr(e, 'property') || '') === 'og:locale');
  if (ogLocale) {
    const attr = ogLocale.attrs.find(a => a.name.toLowerCase() === 'content');
    if (attr && attr.hasValue && attr.value !== config.ogLocale) {
      patches.push({ start: attr.valueStart, end: attr.valueEnd, text: config.ogLocale });
    }
  }

  // Remove the previous og:locale:alternate entries and write the new set.
  const alternates = findElements(tree, e =>
    e.tag === 'meta' && (getAttr(e, 'property') || '') === 'og:locale:alternate'
  );
  const others = LOCALES.filter(l => l.code !== locale);
  const nl = newlineOf(tree);
  if (alternates.length) {
    const first = alternates[0];
    const last = alternates[alternates.length - 1];
    const block = others.map(l =>
      `    <meta property="og:locale:alternate" content="${l.ogLocale}">`
    ).join(nl);
    patches.push({ start: lineStartOf(first), end: lineEndOf(last), text: `${block}${nl}` });
  } else if (others.length) {
    const head = findFirst(tree, e => e.tag === 'head');
    if (head) {
      const block = others.map(l =>
        `    <meta property="og:locale:alternate" content="${l.ogLocale}">`
      ).join(nl);
      patches.push({ start: head.openEnd, end: head.openEnd, text: `${nl}${block}` });
    }
  }

  return patches;
}
