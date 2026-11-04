/* ============================================================
   Parser and pipeline tests.

   Run: node tools/test-parser.mjs
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { parseHtml, walk } from './lib/html.mjs';
import { keyFor } from './lib/extract.mjs';

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

console.log(failures ? `\n${failures} test(s) failed` : '\nAll tests passed.');
process.exit(failures ? 1 : 0);