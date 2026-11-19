import fs from 'node:fs';
import path from 'node:path';
import { parseHtml, findElements, getAttr } from './tools/lib/html.mjs';

const root = process.cwd();
const files = fs.readdirSync(root).filter(f => f.endsWith('.html') && f !== 'google16298c737d30f4e5.html').sort();
const locales = [['ro',''],['en','en'],['es','es'],['pt-BR','pt-br']];

const idsOf = (file) => new Set(
  findElements(parseHtml(fs.readFileSync(file,'utf8')), () => true)
    .map(e => getAttr(e,'id')).filter(Boolean)
);

let brokenLinks = 0, brokenAssets = 0, brokenAnchors = 0, checkedLinks = 0, checkedAssets = 0;
const problems = [];

for (const [code, prefix] of locales) {
  for (const file of files) {
    const rel = path.join(prefix, file);
    const abs = path.join(root, rel);
    const html = fs.readFileSync(abs, 'utf8');
    const tree = parseHtml(html);
    const localIds = idsOf(abs);

    for (const a of findElements(tree, e => e.tag === 'a')) {
      const href = getAttr(a, 'href') || '';
      if (!href || /^(https?:|mailto:|tel:|javascript:|data:)/i.test(href)) continue;
      checkedLinks++;

      const [p, hash] = href.split('#');
      // Same page: no path part, or the path points at this very file.
      const samePage = !p || path.resolve(path.dirname(abs), p) === abs;

      if (samePage) {
        if (hash && !localIds.has(hash)) { problems.push(['ANCHOR', rel, href]); brokenAnchors++; }
        continue;
      }

      const target = path.resolve(path.dirname(abs), p);
      if (!fs.existsSync(target)) { problems.push(['LINK', rel, href]); brokenLinks++; continue; }

      if (hash && target.endsWith('.html')) {
        if (!idsOf(target).has(hash)) { problems.push(['CROSS ANCHOR', rel, href]); brokenAnchors++; }
      }
    }

    for (const e of findElements(tree, el => ['link','script','img','source'].includes(el.tag))) {
      for (const attr of ['href','src']) {
        const v = getAttr(e, attr) || '';
        if (!v || /^(https?:|data:|#|mailto:)/i.test(v)) continue;
        if (e.tag === 'link' && !/icon|stylesheet|preload|alternate|canonical|describedby/i.test(getAttr(e,'rel')||'')) continue;
        checkedAssets++;
        const clean = v.split('?')[0].split('#')[0];
        const target = path.resolve(path.dirname(abs), clean);
        if (!fs.existsSync(target)) { problems.push(['ASSET', rel, v]); brokenAssets++; }
      }
    }
  }
}

const grouped = new Map();
for (const [kind, rel, href] of problems) {
  const key = `${kind}  ${href}`;
  grouped.set(key, (grouped.get(key) || 0) + 1);
}
console.log(`links checked: ${checkedLinks} | assets checked: ${checkedAssets}`);
console.log(`problems: ${problems.length}`);
for (const [key, n] of [...grouped].sort()) console.log(`  ${n}x  ${key}`);
console.log(problems.length === 0 ? '\nOK  nothing broken across all 52 pages' : '\nFAIL');
