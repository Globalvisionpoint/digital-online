import fs from 'node:fs';
import path from 'node:path';
import { parseHtml, findElements, getAttr } from './tools/lib/html.mjs';

const root = process.cwd();
const files = fs.readdirSync(root).filter(f => f.endsWith('.html') && f !== 'google16298c737d30f4e5.html').sort();
const locales = [['ro',''],['en','en'],['es','es'],['pt-BR','pt-br']];

// Collect what each page requests, resolved to site-absolute paths.
const wanted = new Map();
const pageIcons = new Map();

for (const [code, prefix] of locales) {
  for (const file of files) {
    const rel = path.join(prefix, file);
    const abs = path.join(root, rel);
    const tree = parseHtml(fs.readFileSync(abs, 'utf8'));
    const urls = new Set();

    for (const e of findElements(tree, el => ['link','script','img','source'].includes(el.tag))) {
      for (const attr of ['href','src']) {
        const v = getAttr(e, attr) || '';
        if (!v || /^(https?:|data:|#|mailto:)/i.test(v)) continue;
        const clean = v.split('?')[0].split('#')[0];
        const resolved = path.resolve(path.dirname(abs), clean);
        urls.add('/' + path.relative(root, resolved).split(path.sep).join('/'));
      }
    }
    for (const u of urls) wanted.set(u, (wanted.get(u) || 0) + 1);

    const icons = findElements(tree, e => e.tag === 'link' && /^(icon|apple-touch-icon)$/i.test(getAttr(e,'rel')||''))
      .map(e => path.resolve(path.dirname(abs), getAttr(e,'href')).replace(root, '').split(path.sep).join('/'));
    pageIcons.set(rel, icons);
  }
}

console.log('distinct same-origin assets requested by the pages:', wanted.size);
const list = [...wanted].sort((a,b) => b[1]-a[1]);
for (const [u, n] of list) {
  const ok = fs.existsSync(path.join(root, u));
  console.log(`  ${ok ? 'ok  ' : 'MISS'} ${String(n).padStart(3)}x  ${u}`);
}

const iconSets = new Map();
for (const [rel, icons] of pageIcons) {
  const k = icons.join(' ');
  iconSets.set(k, (iconSets.get(k) || 0) + 1);
}
console.log('\ndistinct favicon sets across pages:', iconSets.size);
for (const [k, n] of iconSets) console.log(`  ${n} pages: ${k}`);
