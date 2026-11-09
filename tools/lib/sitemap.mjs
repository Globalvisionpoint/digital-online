import { LOCALES, canonicalFor } from './config.mjs';

/**
 * @param {string[]} pages      source file names
 * @param {function} [lastmodOf] `fileName -> 'YYYY-MM-DD'`, or empty
 *   for a page whose date cannot be determined.
 */
export function renderSitemap(pages, lastmodOf) {
  const entries = pages.flatMap(fileName => {
    const lastmod = lastmodOf ? lastmodOf(fileName) : '';
    const lastmodTag = lastmod ? [`        <lastmod>${lastmod}</lastmod>`] : [];

    return LOCALES.map(locale => {
      const alternates = LOCALES.map(alternate =>
        `        <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${canonicalFor(fileName, alternate.code)}"/>`
      );
      alternates.push(
        `        <xhtml:link rel="alternate" hreflang="x-default" href="${canonicalFor(fileName, 'ro')}"/>`
      );

      return [
        '    <url>',
        `        <loc>${canonicalFor(fileName, locale.code)}</loc>`,
        ...lastmodTag,
        ...alternates,
        '    </url>'
      ].join('\n');
    });
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    ''
  ].join('\n');
}
