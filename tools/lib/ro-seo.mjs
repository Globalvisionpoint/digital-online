/* ============================================================
   The SEO tags of the Romanian (source) pages.

   The Romanian pages live at the root of the site and are the
   source of truth for the content, but their SEO tags were
   written before the site had other languages:

     - most of them still point every hreflang at the Romanian URL,
     - the homepage had no hreflang block and no og:url at all,
     - the two legal pages had no Open Graph or Twitter Card tags.

   This module repairs them, so that all four languages tell search
   engines the same, correct story.
   ============================================================ */

import { parseHtml, findElements, findFirst, getAttr, applyPatches } from './html.mjs';
import { LOCALES, getLocale, canonicalFor } from './config.mjs';
import { replaceHreflang, replaceOgLocale, newlineOf } from './build-page.mjs';

/**
 * Build the Open Graph and Twitter Card tags of a page that has
 * none yet.
 *
 * The values come from what the page already has: the title and
 * the meta description. Nothing is invented.
 */
function socialTags(fileName, title, description) {
  const url = canonicalFor(fileName, 'ro');

  return [
    `    <meta property="og:title" content="${title}">`,
    `    <meta property="og:description" content="${description}">`,
    `    <meta property="og:type" content="website">`,
    `    <meta property="og:url" content="${url}">`,
    `    <meta property="og:site_name" content="Digital Online">`,
    `    <meta name="twitter:card" content="summary">`,
    `    <meta name="twitter:title" content="${title}">`,
    `    <meta name="twitter:description" content="${description}">`
  ].join('\n');
}

/**
 * Build only the Twitter Card tags of a page.
 *
 * Used for the pages that already have the Open Graph tags but no
 * Twitter Card ones.
 */
function twitterTags(title, description) {
  return [
    `    <meta name="twitter:card" content="summary">`,
    `    <meta name="twitter:title" content="${title}">`,
    `    <meta name="twitter:description" content="${description}">`
  ].join('\n');
}

/** Escape a string for a double-quoted HTML attribute. */
function escapeAttr(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Repair the SEO tags of one Romanian page.
 *
 * @param {string} source   the page as it is on disk
 * @param {string} fileName the page file name
 * @returns {string} the page with correct SEO tags
 */
export function fixRoSeo(source, fileName) {
  const tree = parseHtml(source);
  const patches = [];
  const nl = newlineOf(tree);

  /* --- Remove metadata and structured data that reference the retired share image --- */
  const imageMeta = findElements(tree, e => {
    if (e.tag !== 'meta') return false;
    const key = (getAttr(e, 'property') || getAttr(e, 'name') || '').toLowerCase();
    return /^(og:image(?::.*)?|twitter:image(?::.*)?)$/.test(key) &&
      (getAttr(e, 'content') || '').includes('/img/og-cover.png');
  });
  for (const element of imageMeta) {
    const start = source.lastIndexOf('\n', element.start - 1) + 1;
    const newline = source.indexOf('\n', element.end);
    patches.push({
      start,
      end: newline === -1 ? element.end : newline + 1,
      text: ''
    });
  }
  const twitterCards = findElements(tree, e =>
    e.tag === 'meta' && (getAttr(e, 'name') || '').toLowerCase() === 'twitter:card'
  );
  for (const element of twitterCards) {
    const attr = element.attrs.find(a => a.name.toLowerCase() === 'content');
    if (attr?.hasValue && attr.value === 'summary_large_image') {
      patches.push({ start: attr.valueStart, end: attr.valueEnd, text: 'summary' });
    }
  }
  for (const match of source.matchAll(/^[ \t]*"image": "https:\/\/digital-online\.ro\/img\/og-cover\.png",\r?\n/gm)) {
    patches.push({ start: match.index, end: match.index + match[0].length, text: '' });
  }

  /* --- Favicon: use the same symbol as the header logo everywhere --- */
  const iconLinks = findElements(tree, e =>
    e.tag === 'link' && /^(icon|apple-touch-icon)$/i.test(getAttr(e, 'rel') || '')
  );
  const iconTargets = [
    { rel: 'icon', type: 'image/x-icon', href: 'img/favicon.ico' },
    { rel: 'icon', type: 'image/svg+xml', href: 'img/favicon.svg' },
    { rel: 'icon', type: 'image/png', sizes: '32x32', href: 'img/favicon-32.png' },
    { rel: 'apple-touch-icon', sizes: '192x192', href: 'img/favicon-192.png' }
  ];

  for (const target of iconTargets) {
    const existing = iconLinks.find(e =>
      (getAttr(e, 'rel') || '').toLowerCase() === target.rel &&
      ((target.type && getAttr(e, 'type') === target.type) ||
       (target.rel === 'apple-touch-icon' && !target.type))
    );
    if (!existing) continue;

    for (const [name, value] of Object.entries(target)) {
      const attr = existing.attrs.find(a => a.name.toLowerCase() === name);
      if (attr && attr.hasValue && attr.value !== value) {
        patches.push({ start: attr.valueStart, end: attr.valueEnd, text: escapeAttr(value) });
      } else if (!attr) {
        patches.push({
          start: existing.openEnd - 1,
          end: existing.openEnd - 1,
          text: ` ${name}="${escapeAttr(value)}"`
        });
      }
    }
  }

  const missingIcons = iconTargets.filter(target => !iconLinks.some(e =>
    (getAttr(e, 'rel') || '').toLowerCase() === target.rel &&
    ((target.type && getAttr(e, 'type') === target.type) ||
     (target.rel === 'apple-touch-icon' && !target.type))
  ));
  if (missingIcons.length) {
    const head = findFirst(tree, e => e.tag === 'head');
    if (head) {
      const markup = missingIcons.map(icon =>
        `    <link ${Object.entries(icon).map(([name, value]) => `${name}="${escapeAttr(value)}"`).join(' ')}>`
      ).join(nl);
      patches.push({ start: head.openEnd, end: head.openEnd, text: `${nl}${markup}` });
    }
  }

  /* --- hreflang alternates: every language, pointing at itself --- */
  patches.push(...replaceHreflang(tree, fileName, 'ro'));

  /* --- og:locale and og:locale:alternate --- */
  const ogLocale = findFirst(tree, e =>
    e.tag === 'meta' && (getAttr(e, 'property') || '') === 'og:locale'
  );
  if (!ogLocale) {
    const head = findFirst(tree, e => e.tag === 'head');
    if (head) {
      patches.push({
        start: head.openEnd,
        end: head.openEnd,
        text: `${nl}    <meta property="og:locale" content="${getLocale('ro').ogLocale}">`
      });
    }
  }
  patches.push(...replaceOgLocale(tree, 'ro'));

  /* --- og:url --- */
  const ogUrl = findFirst(tree, e => e.tag === 'meta' && (getAttr(e, 'property') || '') === 'og:url');
  const canonical = canonicalFor(fileName, 'ro');
  if (ogUrl) {
    const attr = ogUrl.attrs.find(a => a.name.toLowerCase() === 'content');
    if (attr && attr.hasValue && attr.value !== canonical) {
      patches.push({ start: attr.valueStart, end: attr.valueEnd, text: canonical });
    }
  } else {
    const head = findFirst(tree, e => e.tag === 'head');
    if (head) {
      patches.push({
        start: head.openEnd,
        end: head.openEnd,
        text: `${nl}    <meta property="og:url" content="${canonical}">`
      });
    }
  }

  /* --- Open Graph and Twitter Card, if the page has none --- */
  const hasOgTitle = findElements(tree, e =>
    e.tag === 'meta' && (getAttr(e, 'property') || '') === 'og:title'
  ).length > 0;

  const hasTwitterTitle = findElements(tree, e =>
    e.tag === 'meta' && (getAttr(e, 'name') || '') === 'twitter:title'
  ).length > 0;

  if (!hasOgTitle || !hasTwitterTitle) {
    const titleEl = findFirst(tree, e => e.tag === 'title');
    const title = titleEl
      ? titleEl.children.map(c => c.value || '').join('').trim()
      : 'Digital Online';

    const descMeta = findFirst(tree, e =>
      e.tag === 'meta' && (getAttr(e, 'name') || '').toLowerCase() === 'description'
    );
    const description = descMeta ? (getAttr(descMeta, 'content') || '').trim() : '';

    const head = findFirst(tree, e => e.tag === 'head');
    if (head) {
      // Only the missing half is added: a page that already has the
      // Open Graph tags keeps them untouched.
      const block = (hasOgTitle
        ? twitterTags(escapeAttr(title), escapeAttr(description))
        : socialTags(fileName, escapeAttr(title), escapeAttr(description))
      ).split('\n').join(nl);
      patches.push({
        start: head.openEnd,
        end: head.openEnd,
        text: `${nl}${block}`
      });
    }
  }

  return applyPatches(source, patches);
}
