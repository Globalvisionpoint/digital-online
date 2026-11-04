/* ============================================================
   i18n:check — report the translation coverage of every locale.

   Usage: node tools/check.mjs [locale ...]
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { LOCALE_CODES } from './lib/config.mjs';

const root = path.resolve(import.meta.dirname, '..');
const localesDir = path.join(root, 'tools', 'locales');

const source = JSON.parse(fs.readFileSync(path.join(localesDir, 'ro.json'), 'utf8'));
const targets = process.argv.slice(2).length ? process.argv.slice(2) : LOCALE_CODES.filter(c => c !== 'ro');

/** Read a locale module written as `export default { strings: {...} }`. */
function readLocaleModule(file) {
  const code = fs.readFileSync(file, 'utf8');
  const transformed = code.replace(/export\s+default\s+/, 'module.exports = ');
  const wrapper = `(function (module, exports) { ${transformed}\n})(module, module.exports);`;
  const module = { exports: {} };
  new Function('module', 'exports', wrapper)(module, module.exports);
  return module.exports;
}

for (const locale of targets) {
  const file = path.join(localesDir, `${locale}.mjs`);
  if (!fs.existsSync(file)) {
    console.log(`${locale}: no catalog file`);
    continue;
  }

  const raw = readLocaleModule(file);
  const strings = raw.strings || {};

  const missing = [];
  const identical = [];
  let done = 0;

  for (const entry of source.strings) {
    const value = strings[entry.source];
    if (value === undefined || value === null || value === '') {
      missing.push(entry.source);
    } else {
      done += 1;
      // Same text usually means the string was intentionally left in
      // Romanian (brand names, "Digital Online", product names).
      if (value.trim() === entry.source.trim() && !/^[\d\s.,:()&/-]+$/.test(value.trim())) {
        identical.push(entry.source);
      }
    }
  }

  const known = new Set(source.strings.map(e => e.source));
  const stale = Object.keys(strings).filter(s => !known.has(s));

  const pct = ((done / source.strings.length) * 100).toFixed(1);
  console.log(`${locale}: ${done}/${source.strings.length} translated (${pct}%)`);
  if (missing.length) {
    console.log(`  missing: ${missing.length}`);
    if (process.env.VERBOSE) {
      missing.forEach(s => console.log(`    - ${JSON.stringify(s)}`));
    }
  }
  if (identical.length) {
    console.log(`  kept as-is: ${identical.length}`);
    if (process.env.VERBOSE) {
      identical.forEach(s => console.log(`    = ${JSON.stringify(s)}`));
    }
  }
  if (stale.length) {
    console.log(`  stale (no longer in source): ${stale.length}`);
    if (process.env.VERBOSE) {
      stale.forEach(s => console.log(`    ! ${JSON.stringify(s)}`));
    }
  }
}
