import { LOCALES, canonicalFor } from './config.mjs';

/**
 * Render sitemap.xml.
 *
 * Each URL carries its <loc>, the full reciprocal alternate set with
 * x-default, and a <lastmod>.
 *
 * The date comes from the state file rather than from the build
 * clock: a rebuild that changes nothing must produce an identical
 * sitemap, because a crawler that sees every URL change on every
 * deploy learns to ignore the field.
 *
 * @param {string[]} pages the page file names (index.html, ...)
 * @param {Record<string, string>} [lastmod] URL -> YYYY-MM-DD
 * @returns {string} the XML
 */
export function renderSitemap(pages, lastmod = {}) {
  const entries = pages.flatMap(fileName => LOCALES.map(locale => {
    const alternates = LOCALES.map(alternate =>
      `        <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${canonicalFor(fileName, alternate.code)}"/>`
    );
    alternates.push(
      `        <xhtml:link rel="alternate" hreflang="x-default" href="${canonicalFor(fileName, 'ro')}"/>`
    );

    const url = canonicalFor(fileName, locale.code);
    const date = lastmod[url];

    return [
      '    <url>',
      `        <loc>${url}</loc>`,
      ...(date ? [`        <lastmod>${date}</lastmod>`] : []),
      ...alternates,
      '    </url>'
    ].join('\n');
  }));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    ''
  ].join('\n');
}
