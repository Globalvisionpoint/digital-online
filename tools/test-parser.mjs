/* ============================================================
   Parser and pipeline tests.

   Run: node tools/test-parser.mjs
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { parseHtml, walk } from './lib/html.mjs';
import { keyFor } from './lib/extract.mjs';
import { localizeHref, relativePage } from './lib/config.mjs';
import { fixRoSeo } from './lib/ro-seo.mjs';
import { renderSitemap } from './lib/sitemap.mjs';

const root = path.resolve(import.meta.dirname, '..');
const files = fs.readdirSync(root)
  .filter(f => f.endsWith('.html') && f !== 'google16298c737d30f4e5.html')
  .sort();

let failures = 0;
const fail = (message) => {
  console.log(`FAIL  ${message}`);
  failures += 1;
};

/* ------------------------------------------------------------
   1. Every text node and attribute value must carry the offsets
      of the original source, otherwise the patching step cannot
      rewrite them.
   ------------------------------------------------------------ */
for (const file of files) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const tree = parseHtml(src);
  let checked = 0;
  let broken = 0;

  walk(tree, (node) => {
    if (node.type === 'text' || node.type === 'raw') {
      checked += 1;
      if (typeof node.start !== 'number' || typeof node.end !== 'number') {
        broken += 1;
      } else if (src.slice(node.start, node.end) !== node.value) {
        broken += 1;
      }
    }
    if (node.type === 'element') {
      for (const attr of node.attrs || []) {
        if (!attr.hasValue) continue;
        checked += 1;
        if (typeof attr.valueStart !== 'number' || typeof attr.valueEnd !== 'number') {
          broken += 1;
        } else if (src.slice(attr.valueStart, attr.valueEnd) !== attr.value) {
          broken += 1;
        }
      }
    }
  });

  if (broken) fail(`${file}: ${broken}/${checked} nodes have wrong offsets`);
  else console.log(`OK    ${file}: ${checked} nodes have correct offsets`);
}

/* ------------------------------------------------------------
   2. The catalog keys must match the keys computed at build
      time, otherwise a translation silently never applies.
   ------------------------------------------------------------ */
{
  const source = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'locales', 'ro.json'), 'utf8'));
  let mismatched = 0;
  for (const entry of source.strings) {
    if (keyFor(entry.source) !== entry.key) {
      console.log(`      key drift for ${JSON.stringify(entry.source)}`);
      mismatched += 1;
    }
  }
  if (mismatched) fail(`${mismatched} catalog keys drifted from keyFor()`);
  else console.log(`OK    ${source.strings.length} catalog keys match keyFor()`);
}

/* ------------------------------------------------------------
   3. Translations must actually change the output.
   ------------------------------------------------------------ */
{
  const { localizePage } = await import('./lib/apply.mjs');
  const source = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'locales', 'ro.json'), 'utf8'));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  const catalog = {};
  for (const entry of source.strings) {
    catalog[entry.key] = `<<${entry.source}>>`;
  }

  const out = localizePage(html, 'index.html', catalog, 'en');
  let applied = 0;
  for (const entry of source.strings) {
    if (out.includes(`<<${entry.source}>>`)) applied += 1;
  }

  if (applied === 0) fail('no translation was applied to index.html');
  else console.log(`OK    ${applied} strings applied to index.html`);
}

/* ------------------------------------------------------------
   4. A locale catalog must not contain duplicate keys: the later
      one silently wins, so a translation can be dropped without
      any warning.
   ------------------------------------------------------------ */
{
  const localesDir = path.join(root, 'tools', 'locales');
  const localeFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.mjs'));

  for (const file of localeFiles) {
    const code = fs.readFileSync(path.join(localesDir, file), 'utf8');
    const keys = [...code.matchAll(/^\s*'((?:[^'\\]|\\.)*)'\s*:/gm)].map(m => m[1]);
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (duplicates.length) {
      fail(`${file}: ${duplicates.length} duplicate key(s): ${duplicates.map(d => JSON.stringify(d.slice(0, 40))).join(', ')}`);
    } else {
      console.log(`OK    ${file}: ${keys.length} keys, no duplicates`);
    }
  }
}

/* ------------------------------------------------------------
   5. Home and language links must resolve to HTML files, not
      directories, so they also work when previewed via file://.
   ------------------------------------------------------------ */
{
  const cases = [
    ['Romanian home from root', relativePage('ro', 'index.html', 'ro', 'index.html'), 'index.html'],
    ['English home from root', relativePage('ro', 'index.html', 'en', 'index.html'), 'en/index.html'],
    ['English home from a page', relativePage('en', 'servicii-it.html', 'en', 'index.html'), 'index.html'],
    ['Romanian home from PT-BR', relativePage('pt-BR', 'servicii-it.html', 'ro', 'index.html'), '../index.html'],
    ['PT-BR home from Spanish', relativePage('es', 'index.html', 'pt-BR', 'index.html'), '../pt-br/index.html'],
    ['Localized home href', localizeHref('index.html', 'en', 'servicii-it.html'), 'index.html'],
    ['Root home href', localizeHref('/', 'pt-BR', 'servicii-it.html'), 'index.html']
  ];

  const failed = cases.filter(([, actual, expected]) => actual !== expected);
  for (const [label, actual, expected] of cases) {
    if (actual !== expected) console.log(`      ${label}: expected ${expected}, got ${actual}`);
  }
  if (failed.length) fail(`${failed.length} home/language link path(s) are incorrect`);
  else console.log(`OK    ${cases.length} home and language link paths target HTML files`);
}

/* ------------------------------------------------------------
   6. Every locale must use the header's logo mark for its favicon.
   ------------------------------------------------------------ */
{
  const source = `<html><head>
    <link rel="icon" type="image/svg+xml" href="img/logo-light.svg">
    <meta property="og:image" content="https://digital-online.ro/img/og-cover.png">
    <meta property="og:image:alt" content="Digital Online">
    <meta name="twitter:image" content="https://digital-online.ro/img/og-cover.png">
    <meta name="twitter:card" content="summary_large_image">
    <script type="application/ld+json">
    {
      "image": "https://digital-online.ro/img/og-cover.png",
      "name": "Digital Online"
    }
    </script>
  </head><body></body></html>`;
  const output = fixRoSeo(source, 'index.html');
  const expected = [
    'href="img/favicon.svg"',
    'href="img/favicon.ico"',
    'href="img/favicon-32.png"',
    'href="img/favicon-192.png"'
  ];
  const missing = expected.filter(href => !output.includes(href));
  if (missing.length) fail(`favicon references were not normalized: ${missing.join(', ')}`);
  else console.log(`OK    ${expected.length} favicon variants use the header logo mark`);

  if (output.includes('og-cover.png') || output.includes('property="og:image"') ||
      output.includes('name="twitter:image"') || output.includes('image:alt') ||
      output.includes('"image":')) {
    fail('retired social cover references were not removed');
  } else if (!output.includes('name="twitter:card" content="summary"')) {
    fail('Twitter card type was not changed to summary after removing its image');
  } else {
    console.log('OK    retired share-image references are removed without dropping social titles');
  }
}

/* ------------------------------------------------------------
   7. The sitemap must include every page in every locale, with
      reciprocal language alternatives and a Romanian x-default.
   ------------------------------------------------------------ */
{
  const sitemap = renderSitemap(['index.html', 'consultanta.html']);
  const entries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(match => match[1]);
  const expectedUrls = [
    'https://digital-online.ro/',
    'https://digital-online.ro/en/',
    'https://digital-online.ro/es/',
    'https://digital-online.ro/pt-br/',
    'https://digital-online.ro/consultanta.html',
    'https://digital-online.ro/en/consultanta.html',
    'https://digital-online.ro/es/consultanta.html',
    'https://digital-online.ro/pt-br/consultanta.html'
  ];
  const missing = expectedUrls.filter(url => !sitemap.includes(`<loc>${url}</loc>`));
  const incompleteAlternates = entries.filter(entry =>
    !entry.includes('hreflang="ro"') ||
    !entry.includes('hreflang="en"') ||
    !entry.includes('hreflang="es"') ||
    !entry.includes('hreflang="pt-BR"') ||
    !entry.includes('hreflang="x-default"')
  );
  if (entries.length !== expectedUrls.length || missing.length || incompleteAlternates.length) {
    fail(`localized sitemap is incomplete (${entries.length} URLs, ${missing.length} missing URLs, ${incompleteAlternates.length} incomplete alternate sets)`);
  } else {
    console.log(`OK    sitemap lists ${entries.length} URLs with all locale alternates`);
  }

  const expectedFullSitemap = renderSitemap(files);
  const actualFullSitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const fullEntryCount = [...actualFullSitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].length;
  if (actualFullSitemap !== expectedFullSitemap || fullEntryCount !== files.length * 4) {
    fail(`generated sitemap does not match all ${files.length * 4} localized page URLs`);
  } else {
    console.log(`OK    generated sitemap matches all ${fullEntryCount} localized page URLs`);
  }
}

/* ------------------------------------------------------------
   8. GEO guidance links must point at sections that still exist.
   ------------------------------------------------------------ */
{
  const homepage = parseHtml(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  const ids = new Set();
  walk(homepage, node => {
    if (node.type !== 'element') return;
    const id = node.attrs?.find(attr => attr.name.toLowerCase() === 'id')?.value;
    if (id) ids.add(id);
  });

  const llms = fs.readFileSync(path.join(root, 'llms.txt'), 'utf8');
  const missing = [...llms.matchAll(/\]\(https:\/\/digital-online\.ro\/#([^)\s]+)\)/g)]
    .map(match => match[1])
    .filter(id => !ids.has(id));
  if (missing.length) fail(`llms.txt has broken homepage anchors: ${missing.join(', ')}`);
  else console.log('OK    llms.txt homepage anchors point to existing sections');
}

console.log(failures ? `\n${failures} test(s) failed` : '\nAll tests passed.');
process.exit(failures ? 1 : 0);