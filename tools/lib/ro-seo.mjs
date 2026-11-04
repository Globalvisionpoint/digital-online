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
import { LOCALES, getLocale, canonicalFor, SITE_URL } from './config.mjs';
import { replaceHreflang, replaceOgLocale, newlineOf } from './build-page.mjs';

/**
 * Build the Open Graph and Twitter Card tags of a page that has
 * none yet.
 *
 * The values come from what the page already has: the title, the
 * meta description and the share image. Nothing is invented.
 */
function socialTags(fileName, title, description, image) {
  const url = canonicalFor(fileName, 'ro');
  const imageUrl = image ? `${SITE_URL}/${image.replace(/^\//, '')}` : `${SITE_URL}/img/og-cover.png`;
  const imageAlt = title;

  return [
    `    <meta property="og:title" content="${title}">`,
    `    <meta property="og:description" content="${description}">`,
    `    <meta property="og:type" content="website">`,
    `    <meta property="og:url" content="${url}">`,
    `    <meta property="og:site_name" content="Digital Online">`,
    `    <meta property="og:image" content="${imageUrl}">`,
    `    <meta property="og:image:alt" content="${imageAlt}">`,
    `    <meta name="twitter:card" content="summary_large_image">`,
    `    <meta name="twitter:title" content="${title}">`,
    `    <meta name="twitter:description" content="${description}">`,
    `    <meta name="twitter:image" content="${imageUrl}">`,
    `    <meta name="twitter:image:alt" content="${imageAlt}">`
  ].join('\n');
}

/**
 * Build only the Twitter Card tags of a page.
 *
 * Used for the pages that already have the Open Graph tags but no
 * Twitter Card ones.
 */
function twitterTags(fileName, title, description, image) {
  const imageUrl = image ? `${SITE_URL}/${image.replace(/^\//, '')}` : `${SITE_URL}/img/og-cover.png`;

  return [
    `    <meta name="twitter:card" content="summary_large_image">`,
    `    <meta name="twitter:title" content="${title}">`,
    `    <meta name="twitter:description" content="${description}">`,
    `    <meta name="twitter:image" content="${imageUrl}">`,
    `    <meta name="twitter:image:alt" content="${title}">`
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

    const imageMeta = findFirst(tree, e =>
      e.tag === 'meta' && (getAttr(e, 'property') || '') === 'og:image'
    );
    const image = imageMeta ? (getAttr(imageMeta, 'content') || '') : '';

    const head = findFirst(tree, e => e.tag === 'head');
    if (head) {
      // Only the missing half is added: a page that already has the
      // Open Graph tags keeps them untouched.
      const block = (hasOgTitle
        ? twitterTags(fileName, escapeAttr(title), escapeAttr(description), image)
        : socialTags(fileName, escapeAttr(title), escapeAttr(description), image)
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
