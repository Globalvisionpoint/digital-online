/* ============================================================
   Injecting the language switcher into the Romanian (source) pages.

   The Romanian pages are the source of truth and are edited by
   hand, so the switcher is injected into them by the build as
   well. That keeps a single implementation of the markup and
   means a new page only needs the stylesheet link to get the
   switcher.
   ============================================================ */

import { findFirst, findElements, hasClass, getAttr, applyPatches, parseHtml } from './html.mjs';
import { LOCALES, relativePage } from './config.mjs';
import { switcherMarkup } from './switcher.mjs';

const SWITCHER_LABELS = {
  ro: { open: 'Schimbă limba', menu: 'Limbi' },
  en: { open: 'Change language', menu: 'Languages' },
  es: { open: 'Cambiar idioma', menu: 'Idiomas' },
  'pt-BR': { open: 'Mudar idioma', menu: 'Idiomas' }
};

/**
 * Remove the switcher markup, its script and its stylesheet link.
 *
 * The Romanian pages carry an injected switcher (it is committed so
 * that the source stays self-contained). A localized build reads
 * those pages, so it has to strip the Romanian switcher before
 * adding the one that matches the target locale.
 */
export function stripSwitcher(source) {
  let html = source;

  // The switcher block: <div class="lang-switcher" ...> ... </div>
  html = html.replace(
    /[ \t]*<div class="lang-switcher"[\s\S]*?<\/div>\s*\n/,
    ''
  );

  // The switcher script tag.
  html = html.replace(
    /[ \t]*<script src="(?:\.\.\/)?js\/lang-switcher\.js" defer><\/script>\s*\n?/g,
    ''
  );

  // The runtime UI strings script tag.
  html = html.replace(
    /[ \t]*<script src="(?:\.\.\/)?js\/i18n-ui\.js" defer><\/script>\s*\n?/g,
    ''
  );

  // An inline switcher script from an older build.
  html = html.replace(
    /[ \t]*<script>\s*\(function \(\) \{[\s\S]*?\}\)\(\);\s*<\/script>\s*\n/,
    ''
  );

  // The stylesheet link.
  html = html.replace(/[ \t]*<link rel="stylesheet" href="(?:css|\.\.\/css)\/lang-switcher\.css">\s*\n?/g, '');

  return html;
}

/**
 * Inject the switcher markup and the stylesheet link into a page.
 *
 * @param {string} source  original HTML
 * @param {string} fileName page file name
 * @param {string} locale  current locale code
 */
export function injectSwitcher(source, fileName, locale = 'ro') {
  const tree = parseHtml(source);
  const patches = [];

  /* --- Stylesheet link --- */
  const hasStylesheet = findElements(tree, e =>
    e.tag === 'link' && (getAttr(e, 'href') || '').includes('lang-switcher.css')
  ).length > 0;

  if (!hasStylesheet) {
    const css = findFirst(tree, e => e.tag === 'link' && (getAttr(e, 'rel') || '') === 'stylesheet');
    const href = css ? css.openEnd : null;
    const head = findFirst(tree, e => e.tag === 'head');
    // Localized pages live one folder deeper, so the path goes up.
    const prefix = locale === 'ro' ? '' : '../';
    const link = `\n    <link rel="stylesheet" href="${prefix}css/lang-switcher.css">`;
    if (href) {
      patches.push({ start: href, end: href, text: link });
    } else if (head) {
      patches.push({ start: head.openEnd, end: head.openEnd, text: link });
    }
  }

  /* --- Switcher markup --- */
  const urls = {};
  for (const l of LOCALES) {
    urls[l.code] = relativePage(locale, fileName, l.code, fileName);
  }
  /* Localized pages live one folder deeper, so the shared assets
     (the flag images) go up one level. */
  const prefix = locale === 'ro' ? '' : '../';
  const markup = switcherMarkup(locale, urls, SWITCHER_LABELS[locale] || {}, prefix);

  const header = findFirst(tree, e => e.tag === 'header');
  if (!header) return applyPatches(source, patches);

  const cta = findFirst(header, e => hasClass(e, 'header-cta'));
  const existing = findFirst(header, e => getAttr(e, 'id') === 'langSwitcher');
  const actions = findFirst(header, e => hasClass(e, 'header-actions'));

  /* The switcher and the call-to-action travel together in a flex
     wrapper, so the header grid keeps its three columns
     (logo | navigation | actions).

     The wrapper is rebuilt as a whole rather than patched around,
     so the markup always matches what the build produces, whatever
     a previous build left behind in the page. */
  if (actions && actions.closeEnd !== undefined && cta && cta.closeEnd !== undefined) {
    const ctaMarkup = source.slice(cta.start, cta.closeEnd);
    patches.push({
      start: actions.start,
      end: actions.closeEnd,
      text: `<div class="header-actions">\n${markup}\n${ctaMarkup}\n        </div>`
    });
    return applyPatches(source, patches);
  }

  /* A switcher is already in the page, but it has no wrapper: replace
     it in place. */
  if (existing && existing.closeEnd !== undefined) {
    patches.push({ start: existing.start, end: existing.closeEnd, text: markup });
    return applyPatches(source, patches);
  }

  if (cta && cta.closeEnd !== undefined) {
    const ctaMarkup = source.slice(cta.start, cta.closeEnd);
    patches.push({
      start: cta.start,
      end: cta.closeEnd,
      text: `<div class="header-actions">\n${markup}\n${ctaMarkup}\n        </div>`
    });
    return applyPatches(source, patches);
  }

  const logo = findFirst(header, e => hasClass(e, 'logo'));
  if (logo && logo.closeEnd !== undefined) {
    patches.push({ start: logo.closeEnd, end: logo.closeEnd, text: '\n' + markup });
  }

  return applyPatches(source, patches);
}

/**
 * The script tags that drive the switcher and the runtime UI.
 *
 * They are external files rather than inline scripts so the site can
 * keep a strict Content-Security-Policy (script-src 'self').
 */
export function switcherScriptTag(locale = 'ro') {
  const prefix = locale === 'ro' ? '' : '../';
  return `    <script src="${prefix}js/i18n-ui.js" defer></script>\n    <script src="${prefix}js/lang-switcher.js" defer></script>`;
}
