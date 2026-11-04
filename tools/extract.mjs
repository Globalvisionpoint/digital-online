/* ============================================================
   i18n:extract — scan the Romanian source pages and write the
   translation catalog that the translators fill in.

   Usage: node tools/extract.mjs
   Output: tools/locales/ro.json (source strings + context)
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { extractFromHtml, Catalog, keyFor } from './lib/extract.mjs';
import { stripSwitcher } from './lib/inject.mjs';

const root = path.resolve(import.meta.dirname, '..');
const outFile = path.join(root, 'tools', 'locales', 'ro.json');

/* Pages that are part of the site. The Google verification file is
   intentionally excluded: it is a static token, not content. */
const PAGES = fs.readdirSync(root)
  .filter(f => f.endsWith('.html') && f !== 'google16298c737d30f4e5.html')
  .sort();

const catalog = new Catalog();

/* The Romanian pages carry an injected language switcher. Its labels
   are generated per locale by the build, so they must not end up in
   the catalog — they would be translated twice and would fight with
   the switcher's own wording. */
for (const page of PAGES) {
  const source = stripSwitcher(fs.readFileSync(path.join(root, page), 'utf8'));
  const strings = extractFromHtml(source, page);
  for (const item of strings) {
    catalog.add(item.source, item.place, item.context);
  }
}

const entries = catalog.toJSON();

/* Merge place information for identical sources so a translator sees
   every page a string appears on. */
const byKey = new Map(entries.map(e => [e.key, e]));
for (const page of PAGES) {
  const source = stripSwitcher(fs.readFileSync(path.join(root, page), 'utf8'));
  for (const item of extractFromHtml(source, page)) {
    const key = keyFor(item.source);
    const entry = byKey.get(key);
    if (entry && !entry.places.includes(item.place)) entry.places.push(item.place);
  }
}

const output = {
  $schema: 'Digital Online i18n catalog — source strings extracted from the Romanian pages.',
  locale: 'ro',
  generatedBy: 'tools/extract.mjs',
  pages: PAGES,
  strings: entries
};

fs.writeFileSync(outFile, JSON.stringify(output, null, 2) + '\n', 'utf8');

const chars = entries.reduce((sum, e) => sum + e.source.length, 0);
console.log(`Extracted ${entries.length} unique strings from ${PAGES.length} pages (${chars} chars).`);
console.log(`Catalog written to ${path.relative(root, outFile)}`);
