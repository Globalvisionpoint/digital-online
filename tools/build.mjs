/* ============================================================
   i18n:build — generate the localized pages.

   The Romanian pages stay exactly where they are; they only gain
   the language switcher. Every other locale is written to its own
   folder (/en/, /es/, /pt-br/) with the shared assets (css, js,
   img, fonts) referenced one level up.

   Usage: node tools/build.mjs [locale ...]
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { LOCALE_CODES, LOCALES, getLocale } from './lib/config.mjs';
import { buildPage, appendSwitcherScript } from './lib/build-page.mjs';
import { injectSwitcher } from './lib/inject.mjs';
import { fixRoSeo } from './lib/ro-seo.mjs';
import { renderMiddleware } from './lib/middleware.mjs';
import { renderSitemap } from './lib/sitemap.mjs';

const root = path.resolve(import.meta.dirname, '..');
const localesDir = path.join(root, 'tools', 'locales');

/* Pages that make up the site. */
const PAGES = fs.readdirSync(root)
  .filter(f => f.endsWith('.html') && f !== 'google16298c737d30f4e5.html')
  .sort();

/* Only these locales are generated. Romanian is the source and is
   not regenerated into a separate folder. */
const TARGETS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : LOCALE_CODES.filter(c => c !== 'ro');

/**
 * Read a locale module.
 *
 * The locale files are ES modules so the translator can write the
 * strings as ordinary JavaScript strings — no JSON escaping of
 * quotes, apostrophes or diacritics. The module is imported
 * synchronously by evaluating it in a small wrapper.
 */
function readLocaleModule(file) {
  const code = fs.readFileSync(file, 'utf8');
  const url = pathToFileURL(file).href;
  // The module is written as `export default { ... }`, so a tiny
  // transform turns it into something evaluable here.
  const transformed = code.replace(/export\s+default\s+/, 'module.exports = ');
  const wrapper = `(function (module, exports) { ${transformed}\n})(module, module.exports);`;
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', wrapper)(module, module.exports);
  return module.exports;
}

/**
 * Load a translation file.
 *
 * The file maps the Romanian source string to its translation, which
 * keeps it readable and diff-friendly for a translator:
 *
 *   { "locale": "en", "strings": { "ACASA": "HOME", ... } }
 */
function loadCatalog(locale) {
  const file = path.join(localesDir, `${locale}.mjs`);
  if (!fs.existsSync(file)) return { catalog: {}, missing: [], stale: [] };

  const raw = readLocaleModule(file);
  const strings = raw.strings || {};

  const source = JSON.parse(
    fs.readFileSync(path.join(localesDir, 'ro.json'), 'utf8')
  );

  const catalog = {};
  const missing = [];

  for (const entry of source.strings || []) {
    const value = strings[entry.source];
    if (value === undefined || value === null || value === '') {
      missing.push(entry);
      continue;
    }
    catalog[entry.key] = value;
  }

  // Report translations that no longer match any source string.
  const known = new Set((source.strings || []).map(e => e.source));
  const stale = Object.keys(strings).filter(s => !known.has(s));

  return { catalog, missing, stale };
}

/* ---------- 1. Romanian source pages: switcher + SEO tags ---------- */
let roChanged = 0;
for (const page of PAGES) {
  const file = path.join(root, page);
  const source = fs.readFileSync(file, 'utf8');
  let html = injectSwitcher(source, page, 'ro');
  html = appendSwitcherScript(html, 'ro');
  html = fixRoSeo(html, page);
  if (html !== source) {
    fs.writeFileSync(file, html, 'utf8');
    roChanged += 1;
  }
}
if (roChanged) console.log(`[ro] switcher and SEO tags updated on ${roChanged} pages`);

/* ---------- 2. Localized pages ---------- */
let totalMissing = 0;
const report = [];

for (const locale of TARGETS) {
  const config = getLocale(locale);
  const { catalog, missing } = loadCatalog(locale);

  const outDir = path.join(root, config.prefix);
  fs.mkdirSync(outDir, { recursive: true });

  let written = 0;
  for (const page of PAGES) {
    const source = fs.readFileSync(path.join(root, page), 'utf8');
    const html = buildPage(source, page, catalog, locale);
    fs.writeFileSync(path.join(outDir, page), html, 'utf8');
    written += 1;
  }

  totalMissing += missing.length;
  report.push({ locale, written, missing: missing.length });
  console.log(
    `[${locale}] ${written} pages -> /${config.prefix}/  (${missing.length} untranslated)`
  );
}

console.log('');
for (const line of report) {
  const status = line.missing === 0 ? 'complete' : `${line.missing} pending`;
  console.log(`  ${line.locale.padEnd(6)} ${status}`);
}

/* ---------- 3. The Vercel middleware ---------- */
const middlewareFile = path.join(root, 'middleware.ts');
fs.writeFileSync(middlewareFile, renderMiddleware(), 'utf8');
console.log('\n[middleware] middleware.ts written (IP -> language)');

/* ---------- 4. Search sitemap ---------- */
const sitemapFile = path.join(root, 'sitemap.xml');
fs.writeFileSync(sitemapFile, renderSitemap(PAGES), 'utf8');
console.log(`[sitemap] ${PAGES.length * LOCALES.length} localized page URLs written`);

if (totalMissing) {
  console.log('\nFill the "translation" fields in tools/locales/*.json and rebuild.');
}
