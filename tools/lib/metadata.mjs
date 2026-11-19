/* ============================================================
   Agent-facing metadata on the homepage.

   Three of the signals an agent host looks for live in the <head>
   and in the business JSON-LD:

     - og:image / twitter:image, so a shared link carries a picture,
     - a canonical, an <html lang> and an og:type,
     - the product terms of the business: the JSON-LD `keywords`,
       `knowsAbout` and the `serviceType` of its offers, plus the
       meta keywords tag.

   The terms are kept per locale in `config.mjs` so a localized
   homepage never advertises the Romanian wording, and so the same
   string is never written twice by hand.

   The tags are patched by offset, the same way the rest of the
   build works: a page that is already correct is not rewritten.
   ============================================================ */

import { parseHtml, findFirst, findElements, getAttr, applyPatches } from './html.mjs';
import { LOCALES, getLocale, SITE_URL } from './config.mjs';
import { newlineOf } from './build-page.mjs';

/** The share image, 1200x630, generated from the header logo mark. */
export const OG_IMAGE = `${SITE_URL}/img/og-cover.jpg`;
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/** Alt text of the share image, per locale. */
export const OG_IMAGE_ALT = {
  ro: 'Sigla Digital Online pe fundal închis, cu numele agenției',
  en: 'Digital Online logo on a dark background with the agency name',
  es: 'Logotipo de Digital Online sobre fondo oscuro con el nombre de la agencia',
  'pt-BR': 'Logotipo da Digital Online em fundo escuro com o nome da agência'
};

/**
 * The product terms of the business, per locale.
 *
 * These are the phrases the homepage itself uses in its service
 * cards, so an agent that reads the page and an agent that reads the
 * structured data see the same words.
 */
const PRODUCT_TERMS = {
  ro: {
    keywords: ['Site-uri Web', 'Magazine Online', 'Integrări automate', 'Implementare AI', 'Platforme Custom'],
    knowsAbout: [
      'Dezvoltare site-uri web',
      'Magazine online Shopify',
      'Integrări automate de facturare și curierat',
      'Implementare AI și chatboți',
      'Platforme și aplicații custom'
    ],
    services: [
      ['Site-uri Web și Servicii IT', 'Dezvoltare site-uri Web'],
      ['Magazine Online', 'Magazine Online'],
      ['Integrări automate', 'Integrări automate'],
      ['Implementare AI și chatboți', 'Implementare AI'],
      ['Platforme Custom', 'Platforme Custom']
    ]
  },
  en: {
    keywords: ['Websites', 'Online Stores', 'Automated integrations', 'AI & Chatbots', 'Custom Platforms'],
    knowsAbout: [
      'Website development',
      'Shopify online stores',
      'Automated invoicing and courier integrations',
      'AI implementation and chatbots',
      'Custom platforms and applications'
    ],
    services: [
      ['Websites and IT services', 'Website development'],
      ['Online Stores', 'Online stores'],
      ['Automated integrations', 'Automated integrations'],
      ['AI & Chatbots', 'AI implementation'],
      ['Custom Platforms', 'Custom platforms']
    ]
  },
  es: {
    keywords: ['Webs', 'Tiendas Online', 'Integraciones automáticas', 'IA y chatbots', 'Plataformas a medida'],
    knowsAbout: [
      'Desarrollo de sitios web',
      'Tiendas online Shopify',
      'Integraciones automáticas de facturación y mensajería',
      'Implementación de IA y chatbots',
      'Plataformas y aplicaciones a medida'
    ],
    services: [
      ['Webs y TI', 'Desarrollo de sitios web'],
      ['Tiendas Online', 'Tiendas online'],
      ['Integraciones automáticas', 'Integraciones automáticas'],
      ['IA y chatbots', 'Implementación de IA'],
      ['Plataformas a medida', 'Plataformas a medida']
    ]
  },
  'pt-BR': {
    keywords: ['Sites', 'Lojas Online', 'Integrações automáticas', 'IA e chatbots', 'Plataformas sob medida'],
    knowsAbout: [
      'Desenvolvimento de sites',
      'Lojas online Shopify',
      'Integrações automáticas de faturamento e transporte',
      'Implementação de IA e chatbots',
      'Plataformas e aplicações sob medida'
    ],
    services: [
      ['Sites e TI', 'Desenvolvimento de sites'],
      ['Lojas Online', 'Lojas online'],
      ['Integrações automáticas', 'Integrações automáticas'],
      ['IA e chatbots', 'Implementação de IA'],
      ['Plataformas sob medida', 'Plataformas sob medida']
    ]
  }
};

/** The product terms of a locale, falling back to Romanian. */
export function productTerms(locale) {
  return PRODUCT_TERMS[locale] || PRODUCT_TERMS[getLocale(locale).code] || PRODUCT_TERMS.ro;
}

/* ------------------------------------------------------------
   Favicons
   ------------------------------------------------------------ */

/**
 * The favicon set, in the order a browser should consider it.
 *
 * The SVG comes first: it is the same mark as the header logo and
 * stays sharp at every size, so a browser that understands it never
 * falls back to a bitmap. The ICO stays last for legacy clients.
 */
export const ICON_TARGETS = [
  { rel: 'icon', type: 'image/svg+xml', href: 'img/favicon.svg' },
  { rel: 'icon', type: 'image/png', sizes: '32x32', href: 'img/favicon-32.png' },
  { rel: 'icon', type: 'image/x-icon', href: 'img/favicon.ico' },
  { rel: 'apple-touch-icon', sizes: '192x192', href: 'img/favicon-192.png' }
];

/**
 * Rewrite the icon block in one canonical order and one set.
 *
 * Every page used to scatter the four files, and the order decides
 * which one a browser picks. This removes every <link> of the set and
 * writes the canonical block where the first one was, so every page
 * requests the identical set in the identical order, and the tab, the
 * bookmark and the home-screen icon are always the header's mark.
 *
 * Only icon <link> elements are removed: the tags between them (the
 * title, the canonical, the description) stay where they are, which
 * is why nothing else can be swallowed.
 *
 * @param {string} source   the page as it is on disk
 * @param {string} [prefix] relative path to the site root ('../' in a locale)
 * @returns {string} the page with a canonical icon block
 */
export function normalizeIcons(source, prefix = '') {
  const tree = parseHtml(source);
  const nl = newlineOf(tree);
  const indent = '    ';

  const linkFor = (icon) => {
    const attrs = [
      `rel="${icon.rel}"`,
      icon.type ? `type="${icon.type}"` : null,
      icon.sizes ? `sizes="${icon.sizes}"` : null,
      `href="${prefix}${icon.href}"`
    ].filter(Boolean);
    return `<link ${attrs.join(' ')}>`;
  };

  const block = ICON_TARGETS.map(icon => `${indent}${linkFor(icon)}`).join(nl);

  const icons = findElements(tree, e =>
    e.tag === 'link' && /^(icon|shortcut icon|apple-touch-icon)$/i.test(getAttr(e, 'rel') || '')
  );

  if (!icons.length) {
    const head = findFirst(tree, e => e.tag === 'head');
    if (!head) return source;
    return applyPatches(source, [{
      start: head.openEnd,
      end: head.openEnd,
      text: `${nl}${block}`
    }]);
  }

  /* Where the block belongs: the line of the first icon. */
  const anchor = source.lastIndexOf('\n', icons[0].start - 1) + 1;
  const patches = [];

  icons.forEach((element, index) => {
    const lineStart = source.lastIndexOf('\n', element.start - 1) + 1;
    const lineEnd = source.indexOf('\n', element.end);
    const end = lineEnd === -1 ? element.end : lineEnd + 1;

    if (index === 0) {
      // The canonical block replaces the first icon's line.
      patches.push({ start: lineStart, end, text: `${block}${nl}` });
    } else {
      patches.push({ start: lineStart, end, text: '' });
    }
  });

  // Nothing to change when the block already sits exactly here.
  if (icons.length === ICON_TARGETS.length &&
      source.slice(anchor, icons[0].end) === `${indent}${linkFor(ICON_TARGETS[0])}`) {
    return source;
  }

  return applyPatches(source, patches);
}

/**
 * The canonical icon href of a page, for the tests.
 *
 * @param {string} file the page file name
 * @param {string} locale the locale of the page
 */
export function iconHref(locale, href) {
  return `${getLocale(locale).prefix ? '../' : ''}${href}`;
}


/* ------------------------------------------------------------
   Share image tags
   ------------------------------------------------------------ */

/**
 * The tags of the share image that a social card needs.
 *
 * `image:alt` is translatable, so it is only written when the page
 * does not carry it yet; the build translates it afterwards.
 */
function shareTags(locale) {
  const alt = OG_IMAGE_ALT[locale] || OG_IMAGE_ALT.ro;
  return [
    `    <meta property="og:image" content="${OG_IMAGE}">`,
    `    <meta property="og:image:type" content="image/jpeg">`,
    `    <meta property="og:image:width" content="${OG_IMAGE_WIDTH}">`,
    `    <meta property="og:image:height" content="${OG_IMAGE_HEIGHT}">`,
    `    <meta property="og:image:alt" content="${alt}">`,
    `    <meta name="twitter:image" content="${OG_IMAGE}">`,
    `    <meta name="twitter:image:alt" content="${alt}">`
  ].join('\n');
}

/**
 * Make sure the page carries the share image and the large card.
 *
 * @param {string} source the page as it is on disk
 * @param {string} locale the locale of the page
 * @returns {string} the page with complete social tags
 */
export function ensureShareTags(source, locale = 'ro') {
  const tree = parseHtml(source);
  const patches = [];
  const nl = newlineOf(tree);

  const meta = (key, kind = 'property') => findFirst(tree, e =>
    e.tag === 'meta' && (getAttr(e, kind) || '').toLowerCase() === key
  );

  const existing = {
    'og:image': meta('og:image'),
    'og:image:width': meta('og:image:width'),
    'og:image:height': meta('og:image:height'),
    'og:image:type': meta('og:image:type'),
    'og:image:alt': meta('og:image:alt'),
    'twitter:image': meta('twitter:image', 'name'),
    'twitter:image:alt': meta('twitter:image:alt', 'name')
  };

  const wanted = {
    'og:image': OG_IMAGE,
    'og:image:type': 'image/jpeg',
    'og:image:width': String(OG_IMAGE_WIDTH),
    'og:image:height': String(OG_IMAGE_HEIGHT),
    'og:image:alt': OG_IMAGE_ALT[locale] || OG_IMAGE_ALT.ro,
    'twitter:image': OG_IMAGE,
    'twitter:image:alt': OG_IMAGE_ALT[locale] || OG_IMAGE_ALT.ro
  };

  for (const [key, value] of Object.entries(wanted)) {
    const element = existing[key];
    if (!element) continue;
    const attr = element.attrs.find(a => a.name.toLowerCase() === 'content');
    if (attr && attr.hasValue && attr.value !== value) {
      patches.push({ start: attr.valueStart, end: attr.valueEnd, text: value });
    }
  }

  // Alt text is written per locale, not translated: the share tag is
  // generated, so a localized page must not inherit the Romanian alt.
  const missing = ['og:image:type', 'og:image:width', 'og:image:height', 'twitter:image', 'twitter:image:alt', 'og:image:alt']
    .filter(key => !existing[key]);

  if (!existing['og:image']) {
    const head = findFirst(tree, e => e.tag === 'head');
    if (head) {
      const block = shareTags(locale).split('\n').join(nl);
      patches.push({ start: head.openEnd, end: head.openEnd, text: `${nl}${block}` });
    }
  } else if (missing.length) {
    const head = findFirst(tree, e => e.tag === 'head');
    if (head) {
      const block = missing
        .map(key => {
          const kind = key.startsWith('twitter:') ? 'name' : 'property';
          const value = key === 'og:image:alt' || key === 'twitter:image:alt'
            ? (OG_IMAGE_ALT[locale] || OG_IMAGE_ALT.ro)
            : wanted[key];
          return `    <meta ${kind}="${key}" content="${value}">`;
        })
        .join(nl);
      patches.push({ start: head.openEnd, end: head.openEnd, text: `${nl}${block}` });
    }
  }

  /* A large card needs the image; the site's cards were downgraded to
     `summary` when the share image was retired. */
  for (const card of findElements(tree, e =>
    e.tag === 'meta' && (getAttr(e, 'name') || '').toLowerCase() === 'twitter:card'
  )) {
    const attr = card.attrs.find(a => a.name.toLowerCase() === 'content');
    if (attr?.hasValue && attr.value === 'summary') {
      patches.push({ start: attr.valueStart, end: attr.valueEnd, text: 'summary_large_image' });
    }
  }

  return applyPatches(source, patches);
}

/* ------------------------------------------------------------
   Product terms
   ------------------------------------------------------------ */

/** The meta keywords value of a locale. */
export function keywordsFor(locale) {
  return productTerms(locale).keywords.join(', ');
}

/**
 * The JSON-LD fields that name the products of the business.
 *
 * `makesOffer` is written with one `Service` per direction, each
 * carrying a `serviceType`: that is the field an agent host reads
 * when the site has no keyword list of its own.
 */
export function agentFields(locale) {
  const terms = productTerms(locale);
  return {
    keywords: terms.keywords,
    knowsAbout: terms.knowsAbout,
    makesOffer: terms.services.map(([name, serviceType]) => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name,
        serviceType,
        provider: { '@type': 'Organization', name: 'Digital Online', url: SITE_URL }
      }
    }))
  };
}

/** True when the two JSON values are deeply equal. */
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The offsets of a top-level member's value inside raw JSON text.
 *
 * The build patches by offset rather than re-serializing, so the
 * indentation and the key order the author wrote survive. A scan is
 * needed because a value may be a string with escaped quotes, an
 * array of objects, or a nested object.
 *
 * @param {string} raw the JSON text
 * @param {string} key the member name
 * @returns {{ start: number, end: number } | null}
 */
function topLevelValueSpan(raw, key) {
  const needle = JSON.stringify(key);
  let depth = 0;
  let inString = false;
  let escaped = false;
  let index = -1;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      if (depth === 1 && raw.startsWith(needle, i)) {
        // Skip the closing quote of the key, then the colon.
        let after = i + needle.length;
        while (after < raw.length && /\s/.test(raw[after])) after += 1;
        if (raw[after] === ':') {
          index = after + 1;
          break;
        }
      }
      inString = true;
      continue;
    }

    if (ch === '{' || ch === '[') depth += 1;
    else if (ch === '}' || ch === ']') depth -= 1;
  }

  if (index === -1) return null;
  while (index < raw.length && /\s/.test(raw[index])) index += 1;

  const start = index;
  depth = 0;
  inString = false;
  escaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') {
        inString = false;
        if (depth === 0) return { start, end: i + 1 };
      }
      continue;
    }

    if (ch === '"') { inString = true; continue; }
    if (ch === '{' || ch === '[') { depth += 1; continue; }
    if (ch === '}' || ch === ']') { depth -= 1; continue; }
    if (depth === 0 && (ch === ',' || ch === '}')) return { start, end: i };
    if (depth === 0 && /\s/.test(ch)) {
      let next = i;
      while (next < raw.length && /\s/.test(raw[next])) next += 1;
      if (raw[next] === ',' || raw[next] === '}') return { start, end: i };
    }
  }
  return null;
}

/**
 * Add the product terms to the business JSON-LD and the meta keywords.
 *
 * Only the homepage carries them: an agent that lands anywhere else
 * follows the canonical to it.
 *
 * @param {string} source the page as it is on disk
 * @param {string} locale the locale of the page
 * @returns {string} the page with the agent metadata
 */
export function ensureAgentMetadata(source, locale = 'ro') {
  const tree = parseHtml(source);
  const patches = [];
  const nl = newlineOf(tree);

  /* --- meta keywords --- */
  const keywords = keywordsFor(locale);
  const keywordsMeta = findFirst(tree, e =>
    e.tag === 'meta' && (getAttr(e, 'name') || '').toLowerCase() === 'keywords'
  );
  if (keywordsMeta) {
    const attr = keywordsMeta.attrs.find(a => a.name.toLowerCase() === 'content');
    if (attr?.hasValue && attr.value !== keywords) {
      patches.push({ start: attr.valueStart, end: attr.valueEnd, text: keywords });
    }
  } else {
    const description = findFirst(tree, e =>
      e.tag === 'meta' && (getAttr(e, 'name') || '').toLowerCase() === 'description'
    );
    const head = findFirst(tree, e => e.tag === 'head');
    if (head) {
      const tag = `    <meta name="keywords" content="${keywords}">`;
      if (description) {
        const end = lineEndOf(source, description);
        patches.push({ start: end, end, text: `${tag}${nl}` });
      } else {
        patches.push({ start: head.openEnd, end: head.openEnd, text: `${nl}${tag}` });
      }
    }
  }

  /* --- JSON-LD --- */
  for (const script of findElements(tree, e => e.tag === 'script')) {
    if ((getAttr(script, 'type') || '').toLowerCase() !== 'application/ld+json') continue;
    const rawNode = script.children.find(child => child.type === 'raw');
    if (!rawNode) continue;

    let schema;
    try {
      schema = JSON.parse(rawNode.value);
    } catch {
      continue;
    }
    const types = Array.isArray(schema['@type']) ? schema['@type'] : [schema['@type']];
    if (!types.some(type => type === 'LocalBusiness' || type === 'ProfessionalService')) continue;

    const fields = agentFields(locale);
    const current = {
      keywords: schema.keywords,
      knowsAbout: schema.knowsAbout,
      makesOffer: schema.makesOffer
    };
    if (Object.keys(fields).every(key => deepEqual(current[key], fields[key]))) continue;

    /* Fields are added, or their value replaced, in place: the rest of
       the block keeps the indentation and the key order it had, so a
       build only touches what it actually changes. */
    const raw = rawNode.value;

    for (const [key, value] of Object.entries(fields)) {
      const span = topLevelValueSpan(raw, key);
      if (span) {
        if (deepEqual(Object.hasOwn(schema, key) ? schema[key] : undefined, value)) continue;
        patches.push({
          start: rawNode.start + span.start,
          end: rawNode.start + span.end,
          text: JSON.stringify(value, null, 2).split('\n').join(`${nl}      `)
        });
        continue;
      }

      /* A field the block does not have yet: appended after the last
         member, with the same indentation as its siblings. */
      let cursor = raw.lastIndexOf('}') - 1;
      while (cursor > 0 && /\s/.test(raw[cursor])) cursor -= 1;
      if (cursor <= 0) continue;

      const block = `      ${JSON.stringify(key)}: ${JSON.stringify(value, null, 2)
        .split('\n').join(`${nl}      `)}`;
      patches.push({
        start: rawNode.start + cursor + 1,
        end: rawNode.start + cursor + 1,
        text: `,${nl}${block}`
      });
    }
  }

  return applyPatches(source, patches);
}

/** The canonical URL of the homepage in a locale. */
export function homepageUrl(locale) {
  const config = getLocale(locale);
  return config.prefix ? `${SITE_URL}/${config.prefix}/` : `${SITE_URL}/`;
}

/* ------------------------------------------------------------
   Discoverability of the Markdown sibling
   ------------------------------------------------------------ */

/**
 * Advertise the Markdown sibling and the agent guide of a page.
 *
 * llmstxt.org recommends two link relations: `rel="alternate"` with
 * `type="text/markdown"` for the Markdown of the page, and
 * `rel="describedby"` for the llms.txt that covers it. An agent that
 * looks for them finds the Markdown without guessing the URL; an
 * agent that does not is served it by content negotiation anyway.
 *
 * The paths stay relative, like every other link on the site, so a
 * page opened from disk keeps working.
 *
 * @param {string} source   the page as it is on disk
 * @param {string} fileName the page file name
 * @param {string} locale   the locale of the page
 * @returns {string} the page with the two link relations
 */
export function ensureMarkdownLinks(source, fileName, locale = 'ro') {
  const tree = parseHtml(source);
  const patches = [];
  const nl = newlineOf(tree);

  const has = (rel) => findElements(tree, e =>
    e.tag === 'link' && (getAttr(e, 'rel') || '').toLowerCase() === rel
  ).length > 0;

  const prefix = getLocale(locale).prefix ? '../' : '';
  const markdownHref = `${prefix}${fileName.replace(/\.html$/, '.md')}`;
  const guideHref = `${prefix}llms.txt`;

  const hasType = findElements(tree, e =>
    e.tag === 'link' && (getAttr(e, 'type') || '').toLowerCase() === 'text/markdown'
  ).length > 0;
  const hasDescribedBy = has('describedby');

  const wanted = [];
  if (!hasType) wanted.push(`    <link rel="alternate" type="text/markdown" href="${markdownHref}">`);
  if (!hasDescribedBy) wanted.push(`    <link rel="describedby" href="${guideHref}" title="llms.txt">`);
  if (!wanted.length) return source;

  const head = findFirst(tree, e => e.tag === 'head');
  if (!head) return source;
  patches.push({
    start: head.openEnd,
    end: head.openEnd,
    text: `${nl}${wanted.join(nl)}`
  });

  return applyPatches(source, patches);
}

/** Locales that carry a homepage. */
export const HOMEPAGE_LOCALES = LOCALES.map(locale => locale.code);

/**
 * The end offset of the line an element sits on, newline included.
 * Shared with the other SEO patchers so an inserted line never
 * swallows the indentation of the next one.
 */
function lineEndOf(source, element) {
  const newline = source.indexOf('\n', element.end);
  return newline === -1 ? element.end : newline + 1;
}
