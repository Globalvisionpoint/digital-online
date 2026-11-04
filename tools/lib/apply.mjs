/* ============================================================
   Applying a translation catalog to a page.

   Every translatable string in the source is matched by its key and
   replaced with the translation. Text nodes are replaced in place,
   preserving the original leading/trailing whitespace so the
   generated page keeps the indentation of the source.
   ============================================================ */

import { parseHtml, findElements, getAttr, walk, applyPatches, spliceText } from './html.mjs';
import { keyFor } from './extract.mjs';
import { escapeForAttr, escapeForJson, escapeForText, decodeEntities } from './entities.mjs';
import { localizeHref, getLocale, prefixFor, SITE_URL } from './config.mjs';

const SKIP_TAGS = new Set(['script', 'style', 'code', 'pre', 'kbd', 'samp', 'textarea']);

/* Open Graph and Twitter Card properties that hold prose. */
const TRANSLATABLE_META_KEYS = new Set([
  'og:title', 'og:description', 'og:image:alt',
  'twitter:title', 'twitter:description', 'twitter:image:alt'
]);
const INLINE_TAGS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'em', 'i', 'ins',
  'kbd', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup',
  'time', 'u', 'var', 'del', 'br', 'wbr', 'img'
]);

/**
 * Build the localized version of a page.
 *
 * @param {string} source   original HTML
 * @param {string} fileName original file name (index.html, ...)
 * @param {object} catalog  { [key]: translation }
 * @param {string} locale   target locale code
 */
export function localizePage(source, fileName, catalog, locale) {
  const tree = parseHtml(source);
  const patches = [];

  const translate = (value) => {
    const key = keyFor(value);
    if (!key) return null;
    const hit = catalog[key];
    if (hit === undefined || hit === null || hit === '') return null;
    return hit;
  };

  /* ---------- Text nodes ---------- */
  walk(tree, (node) => {
    if (node.type !== 'element') return;
    if (SKIP_TAGS.has(node.tag)) return;

    for (const child of node.children || []) {
      if (child.type !== 'text') continue;
      const original = child.value;
      const trimmed = original.trim();
      if (!trimmed) continue;

      const translated = translate(trimmed);
      if (translated !== null) {
        patches.push({
          start: child.start,
          end: child.end,
          text: spliceText(original, escapeForText(translated))
        });
      }
    }
  });

  /* ---------- Attributes ---------- */
  walk(tree, (node) => {
    if (node.type !== 'element') return;
    if (SKIP_TAGS.has(node.tag)) return;

    for (const attr of node.attrs || []) {
      const name = attr.name.toLowerCase();
      if (!attr.hasValue) continue;

      if (name === 'content' && node.tag === 'meta') {
        const metaName = (getAttr(node, 'name') || '').toLowerCase();
        const metaProperty = (getAttr(node, 'property') || '').toLowerCase();
        const metaKey = metaProperty || metaName;

        const isPlainMeta = metaName === 'description' || metaName === 'keywords';
        const isSocialMeta = TRANSLATABLE_META_KEYS.has(metaKey);
        if (!isPlainMeta && !isSocialMeta) continue;

        const translated = translate(attr.value);
        if (translated !== null) {
          patches.push({ start: attr.valueStart, end: attr.valueEnd, text: escapeForAttr(translated) });
        }
        continue;
      }

      if (name === 'alt' || name === 'placeholder' || name === 'aria-label' || name === 'title') {
        const translated = translate(attr.value);
        if (translated !== null) {
          patches.push({ start: attr.valueStart, end: attr.valueEnd, text: escapeForAttr(translated) });
        }
      }
    }
  });

  /* ---------- JSON-LD (schema.org) ---------- */
  patches.push(...translateJsonLd(tree, translate, locale));

  /* ---------- Links ---------- */
  for (const node of findElements(tree, e => e.tag === 'a')) {
    const attr = (node.attrs || []).find(a => a.name.toLowerCase() === 'href');
    if (!attr || !attr.hasValue) continue;
    const href = attr.value;
    if (!href || /^(https?:|mailto:|tel:|javascript:|#)/i.test(href)) continue;

    const localized = localizeHref(href, locale, fileName);
    if (localized !== href) {
      patches.push({ start: attr.valueStart, end: attr.valueEnd, text: localized });
    }
  }

  /* ---------- <html lang> ---------- */
  const html = findElements(tree, e => e.tag === 'html')[0];
  if (html) {
    const lang = (html.attrs || []).find(a => a.name.toLowerCase() === 'lang');
    const localeConfig = getLocale(locale);
    if (lang && lang.hasValue && lang.value !== localeConfig.htmlLang) {
      patches.push({ start: lang.valueStart, end: lang.valueEnd, text: localeConfig.htmlLang });
    }
  }

  const out = applyPatches(source, patches);
  return out;
}

function escapeAttr(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------
   JSON-LD
   ------------------------------------------------------------ */

/**
 * Translate the `name` and `description` strings inside the
 * schema.org blocks.
 *
 * The blocks are patched by offset instead of being re-serialized:
 * the raw text of a JSON string literal appears verbatim in the
 * source, so the replacement can be written straight over it and
 * the rest of the JSON — the indentation, the key order, the
 * trailing commas — stays exactly as the author wrote it.
 */
function translateJsonLd(tree, translate, locale) {
  const patches = [];

  for (const script of findElements(tree, e => e.tag === 'script')) {
    const type = (getAttr(script, 'type') || '').toLowerCase();
    if (type !== 'application/ld+json') continue;

    const rawNode = (script.children || []).find(c => c.type === 'raw');
    if (!rawNode) continue;

    const raw = rawNode.value;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    // Collect the literal JSON strings that need a translation.
    //
    // The walk has to go into nested objects as well: the breadcrumb
    // names live inside itemListElement -> ListItem -> name.
    const wanted = new Set();
    const visit = (node) => {
      if (Array.isArray(node)) {
        for (const item of node) visit(item);
        return;
      }
      if (!node || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node)) {
        if ((key === 'name' || key === 'description') && typeof value === 'string') {
          wanted.add(value);
        } else {
          visit(value);
        }
      }
    };
    visit(parsed);

    if (!wanted.size) continue;

    // Replace each occurrence of the literal JSON string.
    //
    // The longest literal goes first: one value can be the prefix of
    // another ("Digital Online" inside "Digital Online Agency"), and
    // the longer one has to win so the patches never overlap.
    const targets = [...wanted]
      .map((value) => ({ value, literal: JSON.stringify(value) }))
      .sort((a, b) => b.literal.length - a.literal.length);

    for (const target of targets) {
      const translated = translate(target.value);
      if (translated === null) continue;
      if (translated === target.value) continue;

      let index = raw.indexOf(target.literal);
      while (index !== -1) {
        patches.push({
          start: rawNode.start + index,
          end: rawNode.start + index + target.literal.length,
          text: JSON.stringify(translated)
        });
        index = raw.indexOf(target.literal, index + target.literal.length);
      }
    }

    /* --- The absolute URLs of the schema have to point at the
       localized pages, not at the Romanian ones. --- */
    for (const value of collectJsonLdUrls(parsed)) {
      const literal = JSON.stringify(value);
      const localized = localizeJsonLdUrl(value, locale);
      if (localized === value) continue;

      let index = raw.indexOf(literal);
      while (index !== -1) {
        patches.push({
          start: rawNode.start + index,
          end: rawNode.start + index + literal.length,
          text: JSON.stringify(localized)
        });
        index = raw.indexOf(literal, index + literal.length);
      }
    }
  }

  return patches;
}

/** The URL-like values of the JSON-LD block. */
function collectJsonLdUrls(parsed) {
  const out = new Set();
  const visit = (node) => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const value of Object.values(node)) {
      if (typeof value === 'string' && value.startsWith(SITE_URL)) {
        out.add(value);
      } else {
        visit(value);
      }
    }
  };
  visit(parsed);
  return [...out];
}

/**
 * Point an absolute site URL at the right language folder.
 *
 * The organisation and the service keep their identifiers, because
 * those are stable across the site: the "#organization" anchor has to
 * stay the same on every page. Only the page URLs are rewritten.
 */
function localizeJsonLdUrl(value, locale) {
  const rest = value.slice(SITE_URL.length);

  // A fragment alone (https://digital-online.ro/#organization).
  if (rest.startsWith('/#') || rest === '/') return value;

  const [pathPart] = rest.split('#');
  if (!pathPart || pathPart === '/') return value;

  // Only the paths that mirror a page of the site are rewritten.
  const file = pathPart.replace(/^\//, '');
  if (!file.endsWith('.html')) return value;

  const prefix = prefixFor(locale);
  const next = `${SITE_URL}${prefix}/${file}`;
  return next;
}
