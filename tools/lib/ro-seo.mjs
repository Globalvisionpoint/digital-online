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
import { ensureShareTags, ensureAgentMetadata, ensureMarkdownLinks, normalizeIcons } from './metadata.mjs';

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
 * The country of the registered office. Its PostalAddress is published
 * on purpose: agents check it to verify the business is real.
 */
const REGISTERED_COUNTRY = 'GI';

/**
 * Remove what must never be published: the coordinates of the team,
 * and any address outside the registration country, which would
 * reveal where the people actually sit.
 *
 * The registered office itself is allowed through, because it is
 * already public in the terms and the privacy policy.
 *
 * @param {string} raw the JSON-LD text
 * @returns {string} the text without the removable members
 */
function sanitizeBusinessLocation(raw) {
  const schema = JSON.parse(raw);
  const country = (schema.address?.addressCountry || '').toUpperCase();

  const removable = [];
  if (Object.hasOwn(schema, 'geo')) removable.push('geo');
  if (Object.hasOwn(schema, 'address') && country !== REGISTERED_COUNTRY) removable.push('address');
  if (!removable.length) return raw;

  let sanitized = raw;
  for (const property of removable) {
    const match = new RegExp(`"${property}"\\s*:\\s*\\{[^{}]*\\}`).exec(sanitized);
    if (!match) continue;

    let start = match.index;
    let end = start + match[0].length;
    let previous = start - 1;
    while (previous >= 0 && /\s/.test(sanitized[previous])) previous -= 1;
    let next = end;
    while (/\s/.test(sanitized[next] || '')) next += 1;

    if (sanitized[next] === ',') {
      end = next + 1;
    } else if (sanitized[previous] === ',') {
      start = previous;
    }

    sanitized = sanitized.slice(0, start) + sanitized.slice(end);
  }

  const result = JSON.parse(sanitized);
  if (Object.hasOwn(result, 'geo')) {
    throw new Error('Business coordinates could not be removed safely');
  }
  const keptCountry = (result.address?.addressCountry || '').toUpperCase();
  if (Object.hasOwn(result, 'address') && keptCountry !== REGISTERED_COUNTRY) {
    throw new Error('A non-registered business address could not be removed safely');
  }
  return sanitized;
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

  /* --- Do not publish the business' physical location --- */
  const locationMeta = findElements(tree, e => {
    if (e.tag !== 'meta') return false;
    const key = (getAttr(e, 'name') || getAttr(e, 'property') || '').toLowerCase();
    return key.startsWith('geo.') || key === 'icbm';
  });
  for (const element of locationMeta) {
    const start = source.lastIndexOf('\n', element.start - 1) + 1;
    const newline = source.indexOf('\n', element.end);
    patches.push({
      start,
      end: newline === -1 ? element.end : newline + 1,
      text: ''
    });
  }

  for (const script of findElements(tree, e => e.tag === 'script')) {
    if ((getAttr(script, 'type') || '').toLowerCase() !== 'application/ld+json') continue;
    const rawNode = script.children.find(child => child.type === 'raw');
    if (!rawNode) continue;

    const schema = JSON.parse(rawNode.value);
    const types = Array.isArray(schema['@type']) ? schema['@type'] : [schema['@type']];
    if (!types.some(type => type === 'LocalBusiness' || type === 'ProfessionalService')) continue;
    if (!Object.hasOwn(schema, 'address') && !Object.hasOwn(schema, 'geo')) continue;

    patches.push({
      start: rawNode.start,
      end: rawNode.end,
      text: sanitizeBusinessLocation(rawNode.value)
    });
  }

  /* --- Remove social image metadata after retiring the share image ---
     The share image is back (img/og-cover.jpg, 1200x630), so only
     the old, retired cover is dropped here. */
  const imageMeta = findElements(tree, e => {
    if (e.tag !== 'meta') return false;
    const key = (getAttr(e, 'property') || getAttr(e, 'name') || '').toLowerCase();
    return /^(og:image(?::.*)?|twitter:image(?::.*)?)$/.test(key);
  });
  for (const element of imageMeta) {
    const start = source.lastIndexOf('\n', element.start - 1) + 1;
    const newline = source.indexOf('\n', element.end);
    const value = (getAttr(element, 'content') || '').toLowerCase();
    if (!value.includes('og-cover.png')) continue;
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

  /* --- Favicon: the same mark as the header logo, in one order --- */
  /* normalizeIcons rewrites the whole block below; nothing to do per
     icon here. Kept in the pipeline so every page is normalized by
     one function rather than by two that could disagree. */

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
      // Open Graph tags keeps them untouched. The share image is
      // appended by ensureShareTags below.
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

  const withSocial = applyPatches(source, patches);

  /* --- Share image, favicons, Markdown sibling, product terms --- */
  const withIcons = normalizeIcons(withSocial, '');
  const withLinks = ensureMarkdownLinks(withIcons, fileName, 'ro');
  const withImage = ensureShareTags(withLinks, 'ro');
  if (fileName !== 'index.html') return withImage;
  return ensureAgentMetadata(withImage, 'ro');
}
