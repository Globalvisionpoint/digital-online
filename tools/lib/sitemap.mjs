import { LOCALES, canonicalFor } from './config.mjs';

export function renderSitemap(pages) {
  const entries = pages.flatMap(fileName => LOCALES.map(locale => {
    const alternates = LOCALES.map(alternate =>
      `        <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${canonicalFor(fileName, alternate.code)}"/>`
    );
    alternates.push(
      `        <xhtml:link rel="alternate" hreflang="x-default" href="${canonicalFor(fileName, 'ro')}"/>`
    );

    return [
      '    <url>',
      `        <loc>${canonicalFor(fileName, locale.code)}</loc>`,
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
