/* ============================================================
   Parser and pipeline tests.

   Run: node tools/test-parser.mjs
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { parseHtml, walk, findFirst, findElements, getAttr } from './lib/html.mjs';
import { keyFor, extractFromHtml } from './lib/extract.mjs';
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
   4b. The extractor must keep prose that looks like an identifier,
       and must reach the attributes of a <textarea>.

       Two bugs hid here for a long time:
       - a capitalised hyphenated word ("VIDEO-FOTO", "Marketplace-uri")
         was classified as a storage key and dropped from the catalog,
         so it stayed Romanian in every locale;
       - the placeholder of a <textarea> was never extracted, so the
         contact form asked visitors in Romanian on every page.
   ------------------------------------------------------------ */
{
  const html = `<html><body>
    <h1><span>MONTAJE</span><span>VIDEO-FOTO</span></h1>
    <h2>Marketplace-uri</h2>
    <p>digital-online-cookie-consent</p>
    <textarea placeholder="Cu ce te putem ajuta?"></textarea>
  </body></html>`;

  const sources = new Set(extractFromHtml(html, 'fixture.html').map(entry => entry.source));

  const expected = ['VIDEO-FOTO', 'Marketplace-uri', 'Cu ce te putem ajuta?'];
  const missing = expected.filter(source => !sources.has(source));
  if (missing.length) fail(`extractor dropped translatable strings: ${missing.join(', ')}`);
  else console.log(`OK    extractor keeps ${expected.length} hyphenated/attribute strings`);

  if (sources.has('digital-online-cookie-consent')) {
    fail('extractor treated a lower-case storage key as prose');
  } else {
    console.log('OK    extractor still skips lower-case storage keys');
  }

  /* The applier has to reach the same placeholder, otherwise the
     string lands in the catalog but never on the page. */
  const { localizePage } = await import('./lib/apply.mjs');
  const catalog = { [keyFor('Cu ce te putem ajuta?')]: 'How can we help?' };
  const out = localizePage(html, 'fixture.html', catalog, 'en');
  if (!out.includes('placeholder="How can we help?"')) {
    fail('the applier did not localize the placeholder of a <textarea>');
  } else {
    console.log('OK    applier localizes the placeholder of a <textarea>');
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

  /* The retired PNG cover is replaced by the generated JPEG: the old
     reference must be gone, the new one present, and the card large. */
  if (output.includes('og-cover.png') || output.includes('"image":')) {
    fail('retired social cover references were not removed');
  } else if (!output.includes('property="og:image" content="https://digital-online.ro/img/og-cover.jpg"') ||
             !output.includes('name="twitter:image" content="https://digital-online.ro/img/og-cover.jpg"')) {
    fail('the share image was not replaced by the generated cover');
  } else if (!output.includes('name="twitter:card" content="summary_large_image"')) {
    fail('the Twitter card was not upgraded for the share image');
  } else {
    console.log('OK    the retired cover is replaced by the generated share image');
  }

  const withLocation = `<html><head><meta name="geo.position" content="44.4268;26.1025"></head><body>
    <script type="application/ld+json">
    {
      "@type": "LocalBusiness",
      "name": "Digital Online",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "București"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": "44.4268",
        "longitude": "26.1025"
      },
      "areaServed": ["RO", "EU"]
    }
    </script>
    <script type="application/ld+json">{"@type":["LocalBusiness","ProfessionalService"],"address":{"@type":"PostalAddress","addressLocality":"București"},"geo":{"@type":"GeoCoordinates","latitude":"44.4268","longitude":"26.1025"},"areaServed":["RO","EU"]}</script>
  </body></html>`;
  const withoutLocation = fixRoSeo(withLocation, 'index.html');
  const businessSchemas = [];
  walk(parseHtml(withoutLocation), node => {
    if (node.type !== 'element' || node.tag !== 'script') return;
    if ((node.attrs || []).find(attr => attr.name.toLowerCase() === 'type')?.value !== 'application/ld+json') return;
    const raw = node.children?.find(child => child.type === 'raw')?.value;
    if (raw) businessSchemas.push(JSON.parse(raw));
  });
  if (businessSchemas.length !== 2 ||
      businessSchemas.some(schema => schema.address || schema.geo ||
        JSON.stringify(schema.areaServed) !== '["RO","EU"]') ||
      withoutLocation.includes('geo.position')) {
    fail('business location was not removed while retaining its service area');
  } else {
    console.log('OK    business coordinates and address are removed while its service area is retained');
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

/* ------------------------------------------------------------
   9. Every public page must avoid publishing the business'
      physical location, while retaining its service area.
   ------------------------------------------------------------ */
{
  const locales = [
    { code: 'ro', prefix: '' },
    { code: 'en', prefix: 'en' },
    { code: 'es', prefix: 'es' },
    { code: 'pt-BR', prefix: 'pt-br' }
  ];
  const locationWords = /\b(?:București|Bucharest|România|Romania|Rumanía|Romênia|España|Spain|Brasil|Brazil)\b/i;
  let checked = 0;

  for (const locale of locales) {
    for (const file of files) {
      const relativePath = path.join(locale.prefix, file);
      const html = fs.readFileSync(path.join(root, relativePath), 'utf8');
      const tree = parseHtml(html);

      walk(tree, node => {
        if (node.type !== 'element') return;

        if (node.tag === 'meta') {
          const key = (node.attrs || []).find(attr =>
            ['name', 'property'].includes(attr.name.toLowerCase())
          )?.value?.toLowerCase();
          if (key?.startsWith('geo.') || key === 'icbm') {
            fail(`${relativePath} still publishes the ${key} geotag`);
          }
        }

        if (node.tag !== 'script' ||
            (node.attrs || []).find(attr => attr.name.toLowerCase() === 'type')?.value?.toLowerCase() !== 'application/ld+json') {
          return;
        }

        const raw = node.children?.find(child => child.type === 'raw')?.value;
        if (!raw) return;
        const schema = JSON.parse(raw);
        const types = Array.isArray(schema['@type']) ? schema['@type'] : [schema['@type']];
        if (!types.some(type => type === 'LocalBusiness' || type === 'ProfessionalService')) return;

        checked += 1;
        if (schema.address || schema.geo) {
          fail(`${relativePath} still publishes a business address or coordinates`);
        }
        if (locationWords.test(schema.description || '')) {
          fail(`${relativePath} describes the business as located in a specific country or city`);
        }
      });
    }
  }

  if (checked) console.log(`OK    ${checked} business schemas omit physical location across all locales`);
  else fail('no business schemas were checked');
}

/* ------------------------------------------------------------
   10. GEO guidance is available in every language and points
       to the corresponding localized pages.
   ------------------------------------------------------------ */
{
  const docs = [
    { file: 'llms.txt', prefix: '', heading: '# Digital Online: Agenție Digitală Full-Service' },
    { file: 'en/llms.txt', prefix: '/en/', heading: '# Digital Online: Full-Service Digital Agency' },
    { file: 'es/llms.txt', prefix: '/es/', heading: '# Digital Online: Agencia Digital Integral' },
    { file: 'pt-br/llms.txt', prefix: '/pt-br/', heading: '# Digital Online: Agência Digital Completa' }
  ];

  for (const doc of docs) {
    const content = fs.readFileSync(path.join(root, doc.file), 'utf8');
    const serviceUrls = [...content.matchAll(/\]\((https:\/\/digital-online\.ro\/[^)#\s]+\.html)\)/g)]
      .map(match => match[1]);
    const wrongLocale = serviceUrls.filter(url => !url.includes(doc.prefix));
    if (!content.startsWith(doc.heading) || !serviceUrls.length || wrongLocale.length) {
      fail(`${doc.file} is missing localized GEO guidance or links to the wrong locale`);
    } else {
      console.log(`OK    ${doc.file} contains localized GEO guidance and page links`);
    }

    if (/\b(?:sediu|headquarters|sede|endereço)\b|București|Bucharest/i.test(content)) {
      fail(`${doc.file} exposes a physical company location`);
    }
  }
}

/* ------------------------------------------------------------
   11. The homepage carries all four metadata signals an agent
       host uses for entity resolution, in every locale.
   ------------------------------------------------------------ */
{
  const locales = [
    { code: 'ro', prefix: '' },
    { code: 'en', prefix: 'en' },
    { code: 'es', prefix: 'es' },
    { code: 'pt-BR', prefix: 'pt-br' }
  ];

  for (const locale of locales) {
    const file = path.join(locale.prefix, 'index.html');
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const tree = parseHtml(html);

    const has = (predicate) => findFirst(tree, predicate);
    const signals = {
      canonical: has(e => e.tag === 'link' && (getAttr(e, 'rel') || '') === 'canonical'),
      lang: has(e => e.tag === 'html' && (getAttr(e, 'lang') || '') !== ''),
      'og:image': has(e => e.tag === 'meta' && (getAttr(e, 'property') || '') === 'og:image'),
      'og:type': has(e => e.tag === 'meta' && (getAttr(e, 'property') || '') === 'og:type')
    };
    const missing = Object.entries(signals).filter(([, element]) => !element).map(([key]) => key);
    if (missing.length) fail(`${file} is missing metadata signals: ${missing.join(', ')}`);

    const image = getAttr(signals['og:image'], 'content') || '';
    if (!image.endsWith('/img/og-cover.jpg')) {
      fail(`${file} points og:image at ${JSON.stringify(image)}`);
    }
    if (!fs.existsSync(path.join(root, 'img', 'og-cover.jpg'))) {
      fail('img/og-cover.jpg does not exist');
    }

    const alt = getAttr(has(e => e.tag === 'meta' && (getAttr(e, 'property') || '') === 'og:image:alt'), 'content') || '';
    if (alt.length < 20) fail(`${file} has no usable og:image:alt`);

    const twitter = has(e => e.tag === 'meta' && (getAttr(e, 'name') || '') === 'twitter:card');
    if ((getAttr(twitter, 'content') || '') !== 'summary_large_image') {
      fail(`${file} does not declare a large Twitter card for its share image`);
    }
  }

  console.log('OK    homepage metadata signals are complete in all four locales');
}

/* ------------------------------------------------------------
   12. The homepage names its products in structured data, so an
       agent host has a term to associate with the brand.
   ------------------------------------------------------------ */
{
  const locales = [
    { code: 'ro', file: 'index.html', keywords: ['Site-uri Web', 'Magazine Online'] },
    { code: 'en', file: 'en/index.html', keywords: ['Websites', 'Online Stores'] },
    { code: 'es', file: 'es/index.html', keywords: ['Webs', 'Tiendas Online'] },
    { code: 'pt-BR', file: 'pt-br/index.html', keywords: ['Sites', 'Lojas Online'] }
  ];

  for (const locale of locales) {
    const html = fs.readFileSync(path.join(root, locale.file), 'utf8');
    const tree = parseHtml(html);

    const schemas = [];
    for (const script of findElements(tree, e =>
      e.tag === 'script' && (getAttr(e, 'type') || '').toLowerCase() === 'application/ld+json'
    )) {
      schemas.push(JSON.parse(script.children.map(child => child.value || '').join('')));
    }
    const business = schemas.find(schema => {
      const types = Array.isArray(schema['@type']) ? schema['@type'] : [schema['@type']];
      return types.some(type => type === 'LocalBusiness' || type === 'ProfessionalService');
    });

    if (!business) {
      fail(`${locale.file} has no business JSON-LD`);
      continue;
    }

    const keywords = business.keywords || [];
    const knowsAbout = business.knowsAbout || [];
    const offers = (business.makesOffer || []).map(offer => offer.itemOffered || {});
    const serviceTypes = offers.map(service => service.serviceType).filter(Boolean);

    const missing = locale.keywords.filter(term => !keywords.includes(term));
    if (missing.length) fail(`${locale.file} JSON-LD keywords are missing ${missing.join(', ')}`);
    if (!knowsAbout.length) fail(`${locale.file} JSON-LD has no knowsAbout`);
    if (offers.length < 5) fail(`${locale.file} JSON-LD has ${offers.length} offers, expected at least 5`);
    if (serviceTypes.length !== offers.length) fail(`${locale.file} has an offer without a serviceType`);

    /* A term is only useful if the page itself shows it: the
       homepage headings are the product phrases an agent can quote. */
    const text = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
    const notOnPage = keywords.filter(term => !text.includes(term));
    if (notOnPage.length) fail(`${locale.file} advertises terms the page never shows: ${notOnPage.join(', ')}`);

    const meta = findFirst(tree, e => e.tag === 'meta' && (getAttr(e, 'name') || '') === 'keywords');
    if (!(getAttr(meta, 'content') || '').includes(keywords[0])) {
      fail(`${locale.file} has no meta keywords matching its JSON-LD`);
    }
  }

  console.log('OK    homepage product terms are in the JSON-LD and on the page, in every locale');
}

/* ------------------------------------------------------------
   13. Every page advertises its Markdown sibling and the guide that
       describes it, as llmstxt.org recommends.
   ------------------------------------------------------------ */
{
  const locales = [
    { code: 'ro', prefix: '' },
    { code: 'en', prefix: 'en' },
    { code: 'es', prefix: 'es' },
    { code: 'pt-BR', prefix: 'pt-br' }
  ];
  let checked = 0;

  for (const locale of locales) {
    for (const file of files) {
      const relativePath = path.join(locale.prefix, file);
      const tree = parseHtml(fs.readFileSync(path.join(root, relativePath), 'utf8'));

      const markdown = findFirst(tree, e =>
        e.tag === 'link' && (getAttr(e, 'rel') || '') === 'alternate' &&
        (getAttr(e, 'type') || '') === 'text/markdown'
      );
      const describedBy = findFirst(tree, e =>
        e.tag === 'link' && (getAttr(e, 'rel') || '') === 'describedby'
      );

      if (!markdown) fail(`${relativePath} does not advertise its Markdown sibling`);
      if (!describedBy) fail(`${relativePath} does not point at llms.txt`);

      const href = getAttr(markdown, 'href') || '';
      if (href !== file.replace(/\.html$/, '.md')) {
        fail(`${relativePath} points its Markdown alternate at ${JSON.stringify(href)}`);
      }

      const markdownFile = path.join(root, file.replace(/\.html$/, '.md'));
      const localizedMarkdown = path.join(root, locale.prefix, file.replace(/\.html$/, '.md'));
      if (!fs.existsSync(markdownFile) || !fs.existsSync(localizedMarkdown)) {
        fail(`${relativePath} has no Markdown sibling on disk`);
      }
      checked += 1;
    }
  }

  console.log(`OK    ${checked} pages advertise their Markdown sibling and llms.txt`);
}

/* ------------------------------------------------------------
   14. The Markdown an agent reads is content only: the page title,
       its headings, its links as absolute URLs, and no navigation,
       script or markup.
   ------------------------------------------------------------ */
{
  const { renderMarkdown } = await import('./lib/markdown.mjs');

  for (const file of files) {
    for (const locale of ['ro', 'en', 'es', 'pt-BR']) {
      const prefix = locale === 'ro' ? '' : locale.toLowerCase();
      const html = fs.readFileSync(path.join(root, prefix, file), 'utf8');
      const markdown = renderMarkdown(html, file, locale);

      if (markdown.length < 200) fail(`${prefix}/${file} produced ${markdown.length} characters of Markdown`);
      if (!markdown.trimStart().startsWith('# ')) fail(`${prefix}/${file} Markdown does not start with its title`);
      if (/<script|<div|<nav|<footer/i.test(markdown)) fail(`${prefix}/${file} Markdown still holds HTML`);

      const onDisk = fs.readFileSync(path.join(root, prefix, file.replace(/\.html$/, '.md')), 'utf8');
      if (onDisk !== markdown) fail(`${prefix}/${file} has a stale Markdown sibling`);
    }
  }

  /* A card link must reach the page it opens, with a full URL: the
     Markdown has no page context to resolve a relative href. */
  const markdown = fs.readFileSync(path.join(root, 'index.md'), 'utf8');
  const expected = [
    '](https://digital-online.ro/servicii-it.html)',
    '](https://digital-online.ro/magazine-online.html)',
    '](https://digital-online.ro/implementare-ai.html)'
  ];
  const missing = expected.filter(link => !markdown.includes(link));
  if (missing.length) fail(`homepage Markdown is missing links: ${missing.join(', ')}`);

  if (/^- .*\]\(\.\.?\//.test(markdown)) fail('homepage Markdown kept a relative link');

  const english = fs.readFileSync(path.join(root, 'en', 'index.md'), 'utf8');
  if (!english.includes('](https://digital-online.ro/en/servicii-it.html)')) {
    fail('English Markdown links do not point at the English pages');
  }
  if (/Site-uri web|Magazine Online/.test(english)) {
    fail('English Markdown still contains Romanian service names');
  }

  console.log('OK    Markdown siblings are content-only, absolute-linked and current');
}

/* ------------------------------------------------------------
   15. The middleware negotiates Accept correctly, serves the
       Markdown of a real page, answers a missing page in Markdown,
       and refuses what it cannot produce.
   ------------------------------------------------------------ */
{
  const { renderMiddleware } = await import('./lib/middleware.mjs');
  const { loadMiddleware, continued, rewrittenTo } = await import('./lib/middleware-harness.mjs');

  // The generated file must be exactly what the build would write.
  const generated = renderMiddleware(files);
  const onDisk = fs.readFileSync(path.join(root, 'middleware.ts'), 'utf8');
  if (generated !== onDisk) fail('middleware.ts is stale; run node tools/build.mjs');

  const { handler, cleanup } = await loadMiddleware(generated, { country: 'RO' });
  const origin = 'https://digital-online.ro';

  const call = (path, headers = {}) => handler(new Request(origin + path, { headers }));

  /** The file a rewrite points at, relative to the site root. */
  const rewrittenFile = (response) => {
    const target = rewrittenTo(response);
    if (!target) return null;
    const url = new URL(target);
    return url.pathname === '/' ? 'index.md' : url.pathname.replace(/^\//, '');
  };

  try {
    /* --- Markdown for a page that exists --- */
    const markdown = await call('/', { Accept: 'text/markdown' });
    const markdownFile = rewrittenFile(markdown);
    if (markdownFile !== 'index.md') {
      fail(`Accept: text/markdown on / rewrote to ${JSON.stringify(markdownFile)}`);
    }
    if (!/\bAccept\b/.test(markdown.headers.get('vary') || '')) {
      fail(`Accept: text/markdown on / has no Vary: Accept (got ${markdown.headers.get('vary')})`);
    }

    /* The file it rewrites to is the content an agent reads. */
    const body = fs.readFileSync(path.join(root, markdownFile || 'index.md'), 'utf8');
    if (body.trim().length < 500 || !body.includes('Digital Online')) {
      fail('the Markdown of the homepage is empty or does not name the brand');
    }

    /* --- The same URL as a browser --- */
    const html = await call('/', { Accept: 'text/html' });
    if (!continued(html)) fail('Accept: text/html on / was not served the static HTML');
    if (rewrittenTo(html)) fail('Accept: text/html on / was rewritten to another file');
    if (!/\bAccept\b/.test(html.headers.get('vary') || '')) {
      fail('the HTML response does not carry Vary: Accept');
    }

    /* --- A real browser header must not be mistaken for Markdown --- */
    const chrome = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
    const asChrome = await call('/', { Accept: chrome });
    if (!continued(asChrome) || rewrittenTo(asChrome)) fail('a Chrome Accept header was not served HTML');

    const wildcard = await call('/', { Accept: '*/*' });
    if (!continued(wildcard)) fail('Accept: */* was not served the default HTML');

    const none = await call('/', {});
    if (!continued(none)) fail('a request without Accept was not served the default HTML');

    /* --- A page that does not exist --- */
    const missing = await call('/__ora-404-probe-x80ys533', { Accept: 'text/markdown' });
    const missingBody = await missing.text();
    if (missing.status !== 404) fail(`a missing page answered ${missing.status}, expected 404`);
    if (!(missing.headers.get('content-type') || '').startsWith('text/markdown')) {
      fail('a missing page did not answer with text/markdown');
    }
    if (!/\bAccept\b/.test(missing.headers.get('vary') || '')) {
      fail('the Markdown 404 has no Vary: Accept');
    }
    if (missingBody.length < 20 || !/404/.test(missingBody)) {
      fail('the Markdown 404 body does not explain the error');
    }
    if (!missingBody.includes('llms.txt') || !missingBody.includes('sitemap.xml')) {
      fail('the Markdown 404 does not link llms.txt and sitemap.xml');
    }
    if (!/\]\(https:\/\//.test(missingBody)) fail('the Markdown 404 has no absolute link');

    /* The same missing page as a browser must stay a plain 404. */
    const missingHtml = await call('/__ora-404-probe-x80ys533', { Accept: 'text/html' });
    if (!continued(missingHtml)) fail('a missing page was not left to the static 404');

    /* --- Every real page resolves to its own Markdown --- */    let resolved = 0;
    for (const file of files) {
      const pathName = file === 'index.html' ? '/' : `/${file}`;
      const response = await call(pathName, { Accept: 'text/markdown' });
      const target = rewrittenFile(response);
      if (target !== file.replace(/\.html$/, '.md')) {
        fail(`${pathName} rewrote to ${JSON.stringify(target)} instead of its Markdown`);
      } else {
        resolved += 1;
      }
    }
    if (resolved !== files.length) fail(`${files.length - resolved} pages did not resolve their Markdown`);

    /* A clean URL has no page behind it, so its Markdown answer is a
       404 as well: the two representations must agree on what exists. */
    const cleanUrl = await call('/consultanta', { Accept: 'text/markdown' });
    if (cleanUrl.status !== 404) {
      fail(`/consultanta answered ${cleanUrl.status} in Markdown, expected 404 like the HTML host`);
    }

    /* --- A localized page --- */
    const localized = await call('/en/servicii-it.html', { Accept: 'text/markdown' });
    const localizedFile = rewrittenFile(localized);
    if (localizedFile !== 'en/servicii-it.md') {
      fail(`Accept: text/markdown on /en/servicii-it.html rewrote to ${JSON.stringify(localizedFile)}`);
    } else if (!/web|site/i.test(fs.readFileSync(path.join(root, localizedFile), 'utf8'))) {
      fail('the English Markdown is not the English page');
    }

    const localizedHome = await call('/pt-br', { Accept: 'text/markdown' });
    if (rewrittenFile(localizedHome) !== 'pt-br/index.md') {
      fail(`/pt-br rewrote to ${JSON.stringify(rewrittenFile(localizedHome))}`);
    }

    /* --- What the site cannot produce --- */
    const pdf = await call('/', { Accept: 'application/pdf' });
    const pdfBody = await pdf.text();
    if (pdf.status !== 406) fail(`Accept: application/pdf answered ${pdf.status}, expected 406`);
    if (!pdfBody.includes('text/markdown') || !pdfBody.includes('text/html')) {
      fail('the 406 body does not list the representations the site can produce');
    }

    const rejected = await call('/', { Accept: 'text/markdown;q=0' });
    if (rejected.status !== 406) fail(`Accept: text/markdown;q=0 answered ${rejected.status}, expected 406`);

    /* --- Quality values --- */
    const prefersHtml = await call('/', { Accept: 'text/markdown;q=0.5, text/html;q=0.9' });
    if (!continued(prefersHtml)) fail('text/html;q=0.9 was not preferred over text/markdown;q=0.5');

    const prefersMarkdown = await call('/', { Accept: 'text/html;q=0.4, text/markdown;q=0.9' });
    if (rewrittenFile(prefersMarkdown) !== 'index.md') {
      fail('text/markdown;q=0.9 was not preferred over text/html;q=0.4');
    }

    /* --- www goes to the canonical host --- */
    const www = await handler(new Request('https://www.digital-online.ro/consultanta.html', {
      headers: { Accept: 'text/html' }
    }));
    if (www.status !== 301) fail(`www was answered ${www.status}, expected 301`);
    if (www.headers.get('location') !== 'https://digital-online.ro/consultanta.html') {
      fail(`www redirected to ${www.headers.get('location')}`);
    }

    /* --- Assets and machine files are never negotiated --- */
    for (const asset of ['/css/styles.css', '/img/logo.svg', '/llms.txt', '/sitemap.xml', '/robots.txt']) {
      const response = await call(asset, { Accept: 'text/markdown' });
      if (!continued(response)) fail(`${asset} was negotiated instead of being served as a file`);
    }

    /* --- The language decision still works, for a browser only --- */
    const spanish = await loadMiddleware(generated, { country: 'ES' });
    try {
      const redirected = await spanish.handler(new Request(origin + '/consultanta.html', {
        headers: {
          Accept: 'text/html',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Sec-Fetch-Dest': 'document'
        }
      }));
      if (redirected.status !== 302) fail(`a visitor from ES was answered ${redirected.status}, expected 302`);
      if (redirected.headers.get('location') !== 'https://digital-online.ro/es/consultanta.html') {
        fail(`a visitor from ES was sent to ${redirected.headers.get('location')}`);
      }

      const crawler = await spanish.handler(new Request(origin + '/consultanta.html', {
        headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }
      }));
      if (!continued(crawler)) fail('a crawler was redirected instead of being served the canonical page');

      /* A plain HTTP client must read the canonical page, not be sent
         into a language folder: that is what hid it from the audit. */
      for (const userAgent of ['curl/8.5.0', 'node-fetch/1.0', 'python-httpx/0.27']) {
        const client = await spanish.handler(new Request(origin + '/', {
          headers: { Accept: 'text/html', 'User-Agent': userAgent }
        }));
        if (!continued(client)) fail(`${userAgent} was redirected away from the canonical homepage`);
      }

      /* A browser navigation from ES is localized. */
      const navigation = await spanish.handler(new Request(origin + '/', {
        headers: {
          Accept: 'text/html',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Sec-Fetch-Dest': 'document'
        }
      }));
      if (navigation.status !== 302) fail('a browser navigation from ES was not localized');

      /* A subresource fetch from ES is not a navigation, so it must
         not be redirected. */
      const subresource = await spanish.handler(new Request(origin + '/index.html', {
        headers: {
          Accept: 'text/html',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Sec-Fetch-Dest': 'iframe'
        }
      }));
      if (!continued(subresource)) fail('a subresource fetch was redirected to a language folder');

      /* An agent that asks for Markdown is never redirected: it asked
         for a representation, not a locale. */
      const agent = await spanish.handler(new Request(origin + '/consultanta.html', {
        headers: { Accept: 'text/markdown', 'User-Agent': 'Mozilla/5.0 (Macintosh)' }
      }));
      if (rewrittenFile(agent) !== 'consultanta.md') {
        fail('an agent asking for Markdown was redirected instead of served the page');
      }

      /* A Chrome-like client without Sec-Fetch-Dest (an audit probe, a
         headless fetch) must read the canonical page, not be sent into
         a language folder: that is what hid the homepage from the
         audit. */
      const chromeLike = await spanish.handler(new Request(origin + '/', {
        headers: {
          Accept: 'text/html',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36'
        }
      }));
      if (!continued(chromeLike)) fail('a Chrome-like client without Sec-Fetch-Dest was redirected');
    } finally {
      spanish.cleanup();
    }
  } finally {
    cleanup();
  }

  console.log('OK    the middleware negotiates Accept, serves Markdown and answers 404/406 in Markdown');
}

/* ------------------------------------------------------------
   16. The agent guide tells an agent when to reach for the site
       and how to contact it, in every language.
   ------------------------------------------------------------ */
{
  const docs = [
    { file: 'llms.txt' },
    { file: 'en/llms.txt' },
    { file: 'es/llms.txt' },
    { file: 'pt-br/llms.txt' }
  ];

  for (const doc of docs) {
    const content = fs.readFileSync(path.join(root, doc.file), 'utf8');

    const hasWhenToUse = /^##\s+.*\(when to use\)\s*$/im.test(content);
    const hasHowToCall = /^##\s+.*(?:how to call|contact|cum ne contactezi|c.mo contactarnos|c.mo falar)/im.test(content);
    if (!hasWhenToUse) fail(`${doc.file} has no "when to use" section for agents`);
    if (!hasHowToCall) fail(`${doc.file} has no "how to call us" section for agents`);

    /* The section has to name concrete jobs, not marketing copy. */
    const section = content.slice(content.search(/\(when to use\)/i));
    const bulletLinks = [...section.matchAll(/^- \[[^\]]+\]\((https?:\/\/[^)]+)\)/gm)];
    if (bulletLinks.length < 5) fail(`${doc.file} "when to use" lists ${bulletLinks.length} use cases, expected at least 5`);
    if (!/WhatsApp/.test(content) || !/contact@digital-online\.ro/.test(content)) {
      fail(`${doc.file} does not tell an agent how to reach the business`);
    }

    /* The spec: the H1, then a blockquote with the summary. */
    const lines = content.split('\n');
    if (!lines[0].startsWith('# ')) fail(`${doc.file} does not start with its H1`);
    if (!lines[2].startsWith('> ')) fail(`${doc.file} has no blockquote summary after the H1`);
  }

  console.log('OK    every llms.txt tells an agent when to use the site and how to call');
}

console.log(failures ? `\n${failures} test(s) failed` : '\nAll tests passed.');
process.exit(failures ? 1 : 0);