/* ============================================================
   Extraction: collect every translatable string from the site.

   Each translatable string gets a stable key derived from the
   Romanian source text, plus context notes that tell the translator
   where the string appears and what it means in the domain. Those
   notes are what keep a translation from reading like a machine
   translation: "magazine" must become "loja online" in Brazilian
   Portuguese, not "revista".
   ============================================================ */

import { parseHtml, findElements, getAttr, hasAttr, walk, normalize, UNTRANSLATABLE_ELEMENTS } from './html.mjs';
import { decodeEntities } from './entities.mjs';

/* Open Graph and Twitter Card properties that hold text a reader
   actually sees. Everything else in those families is a URL, a
   locale code or a file type, and must stay as it is. */
const TRANSLATABLE_META_KEYS = new Set([
  'og:title', 'og:description', 'og:image:alt',
  'twitter:title', 'twitter:description', 'twitter:image:alt'
]);

/* JSON-LD keys that carry prose. The rest of the schema is URLs,
   coordinates, opening hours and country codes. */
const TRANSLATABLE_JSONLD_KEYS = new Set(['name', 'description']);

/* Attributes that carry user-visible text. */
const TRANSLATABLE_ATTRS = new Set([
  'title',
  'alt',
  'placeholder',
  'aria-label',
  'content' // only for <meta name="description">, handled separately
]);

/* Elements whose text content is never translated. */
const SKIP_TAGS = new Set(['script', 'style', 'code', 'pre', 'kbd', 'samp', 'textarea']);

/* Inline elements that do not interrupt a sentence. A text run that
   only contains inline children is still one translation unit. */
const INLINE_TAGS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'em', 'i', 'ins',
  'kbd', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup',
  'time', 'u', 'var', 'del', 'br', 'wbr', 'img'
]);

/* Values that are identifiers rather than prose: emails, phones,
   URLs, storage keys, tracking ids, currency amounts. */
const IDENTIFIER_PATTERNS = [
  /^[\w.+-]+@[\w-]+\.[\w.]+$/,
  /^\+?[\d\s().-]{7,}$/,
  /^https?:\/\//i,
  /^[\w-]+-[\w-]+$/,
  /^[a-z0-9_]+(-[a-z0-9_]+)+$/
];

function looksLikeIdentifier(value) {
  const text = value.trim();
  if (!text || text.length < 4) return false;
  return IDENTIFIER_PATTERNS.some(re => re.test(text));
}

/** Characters that hint at language, used to skip non-prose strings. */
const HAS_LETTER = /[A-Za-zÀ-ÿ]/;

function isTranslatableText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (!HAS_LETTER.test(normalized)) return false;
  if (looksLikeIdentifier(normalized)) return false;
  // A bare number, currency or time range is not prose.
  if (/^[\d\s.,%€$£RON€+-]+$/.test(normalized)) return false;
  return true;
}

/**
 * Normalize a string for use as a catalog key.
 *
 * The HTML entities are decoded first, so "Implementare AI &amp; Chatboți"
 * and "Implementare AI & Chatboți" — the same visible text, written two
 * different ways in the markup — collapse into one catalog entry. Without
 * this the catalog fragments and half the strings stop matching.
 */
export function normalizeText(value) {
  return normalize(decodeEntities(value));
}

/* ------------------------------------------------------------
   Catalog
   ------------------------------------------------------------ */

export class Catalog {
  constructor() {
    /** key -> { source, context, places: [] } */
    this.entries = new Map();
  }

  add(source, place, context) {
    const key = keyFor(source);
    if (!key) return null;
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { key, source: normalizeText(source), context: context || '', places: [] };
      this.entries.set(key, entry);
    }
    // Merge context notes so translators see every usage.
    if (context && !entry.context.includes(context)) {
      entry.context = entry.context ? `${entry.context} | ${context}` : context;
    }
    if (place && !entry.places.includes(place)) entry.places.push(place);
    return entry;
  }

  toJSON() {
    return [...this.entries.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(e => ({ key: e.key, source: e.source, context: e.context, places: e.places }));
  }
}

/**
 * Stable key for a source string. A hash keeps the catalog compact
 * and avoids the risk of two different strings colliding on a
 * slugified form.
 */
export function keyFor(source) {
  const normalized = normalizeText(source);
  if (!normalized) return null;
  let hash = 5381;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
  }
  const slug = normalized
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${slug}#${(hash >>> 0).toString(36)}`;
}

/* ------------------------------------------------------------
   Extraction
   ------------------------------------------------------------ */

/**
 * Extract translatable strings from one HTML file.
 * Returns { strings: [{ source, context, place }], title, description }
 */
export function extractFromHtml(source, fileName) {
  const tree = parseHtml(source);
  const found = [];
  const seen = new Set();

  const push = (text, context, place) => {
    const normalized = normalizeText(text);
    if (!isTranslatableText(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    found.push({ source: normalized, context, place });
  };

  /* --- <title> --- */
  const titleEl = findElements(tree, e => e.tag === 'title')[0];
  if (titleEl) {
    const text = titleEl.children.map(c => c.value || '').join('');
    push(text, 'Browser tab / page title (SEO). Keep the brand name "Digital Online" untranslated.', `${fileName} <title>`);
  }

  /* --- <meta name="description"> --- */
  for (const meta of findElements(tree, e => e.tag === 'meta')) {
    const name = (getAttr(meta, 'name') || '').toLowerCase();
    if (name === 'description') {
      push(getAttr(meta, 'content') || '', 'SEO meta description. One or two sentences that describe the page and appear in search results.', `${fileName} meta description`);
    }
    if (name === 'keywords') {
      push(getAttr(meta, 'content') || '', 'SEO keywords.', `${fileName} meta keywords`);
    }
  }

  /* --- Open Graph and Twitter Card --- */
  for (const meta of findElements(tree, e => e.tag === 'meta')) {
    const property = (getAttr(meta, 'property') || '').toLowerCase();
    const name = (getAttr(meta, 'name') || '').toLowerCase();
    const key = property || name;
    if (!TRANSLATABLE_META_KEYS.has(key)) continue;
    push(
      getAttr(meta, 'content') || '',
      metaContext(key),
      `${fileName} meta ${key}`
    );
  }

  /* --- JSON-LD (schema.org) --- */
  for (const value of collectJsonLdStrings(tree)) {
    push(
      value,
      jsonLdContext(value),
      `${fileName} JSON-LD`
    );
  }

  /* --- Translatable attributes --- */
  walk(tree, (node) => {
    if (node.type !== 'element') return;
    if (SKIP_TAGS.has(node.tag)) return;

    for (const attr of node.attrs || []) {
      const name = attr.name.toLowerCase();
      if (!TRANSLATABLE_ATTRS.has(name)) continue;
      if (!attr.hasValue) continue;
      // <meta content> was handled above; skip it here to avoid duplicates.
      if (node.tag === 'meta' && name === 'content') continue;

      const context = attrContext(node, name);
      push(attr.value, context, `${fileName} <${node.tag} ${attr.name}>`);
    }
  });

  /* --- Text content --- */
  const textUnits = collectTextUnits(tree, fileName);
  for (const unit of textUnits) {
    push(unit.source, unit.context, unit.place);
  }

  return found;
}

/** Context note for an Open Graph or Twitter Card property. */
function metaContext(key) {
  if (key === 'og:title' || key === 'twitter:title') {
    return 'Social share title. This is what appears when the page is shared on Facebook, LinkedIn or X. Keep the brand name "Digital Online" untranslated.';
  }
  if (key === 'og:description' || key === 'twitter:description') {
    return 'Social share description. One or two sentences that summarise the page for someone who sees the link in a feed.';
  }
  if (key === 'og:image:alt' || key === 'twitter:image:alt') {
    return 'Alt text of the social share image. Describes what the picture shows for people who cannot see it.';
  }
  return `Meta tag ${key}.`;
}

/** Context note for a string that comes from the JSON-LD block. */
function jsonLdContext(value) {
  if (value === 'Digital Online') {
    return 'The name of the company in the structured data. Keep the brand name "Digital Online" untranslated.';
  }
  if (value === 'Acasă') {
    return 'Breadcrumb label for the home page in the structured data.';
  }
  return 'Structured data (schema.org) name or description. Describes the organisation, the service or the breadcrumb to search engines.';
}

/**
 * Collect the translatable strings from the JSON-LD blocks.
 *
 * Only `name` and `description` are prose; everything else in the
 * schema is a URL, a coordinate, a country code or an opening hour.
 */
function collectJsonLdStrings(tree) {
  const out = [];

  for (const script of findElements(tree, e => e.tag === 'script')) {
    const type = (getAttr(script, 'type') || '').toLowerCase();
    if (type !== 'application/ld+json') continue;

    const raw = script.children.map(c => c.value || '').join('');
    if (!raw.trim()) continue;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    const visit = (node) => {
      if (Array.isArray(node)) {
        for (const item of node) visit(item);
        return;
      }
      if (!node || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node)) {
        if (TRANSLATABLE_JSONLD_KEYS.has(key) && typeof value === 'string') {
          out.push(value);
        }
      }
    };
    visit(parsed);
  }

  return out;
}

function attrContext(element, attrName) {
  const tag = element.tag;
  if (attrName === 'alt') {
    return `Alt text of the <img> inside "${describeElement(element)}". Describe what the image shows; screen readers read it aloud.`;
  }
  if (attrName === 'placeholder') {
    return `Placeholder inside the "${describeElement(element)}" input. Show an example of the expected value.`;
  }
  if (attrName === 'aria-label') {
    return `Accessible label of the "${describeElement(element)}" control. Read by screen readers; keep it short and action-oriented.`;
  }
  if (attrName === 'title') {
    return `Tooltip of the "${describeElement(element)}" element.`;
  }
  return `Attribute ${attrName} on <${tag}>.`;
}

function describeElement(element) {
  const cls = getAttr(element, 'class');
  if (cls) return cls.split(/\s+/)[0];
  if (element.tag === 'a') return 'link';
  if (element.tag === 'button') return 'button';
  return element.tag;
}

/**
 * Walk the tree and group text into translation units.
 * A unit is a maximal run of text that belongs to one visual block:
 * inline elements (links, bold, spans) do not break the run, but
 * block elements do.
 */
function collectTextUnits(tree, fileName) {
  const units = [];

  const walkChildren = (element) => {
    for (const child of element.children || []) {
      if (child.type === 'text') {
        units.push({
          source: child.value,
          context: '',
          place: `${fileName} text`,
          isRun: true
        });
      } else if (child.type === 'element') {
        if (SKIP_TAGS.has(child.tag)) continue;
        if (INLINE_TAGS.has(child.tag)) {
          const inner = [];
          const collectInner = (el) => {
            for (const c of el.children || []) {
              if (c.type === 'text') inner.push(c.value);
              else if (c.type === 'element' && INLINE_TAGS.has(c.tag)) collectInner(c);
            }
          };
          collectInner(child);
          const text = inner.join('');
          if (normalizeText(text)) {
            units.push({
              source: text,
              context: inlineContext(child),
              place: `${fileName} <${child.tag}>`,
              isRun: true
            });
          }
          // <img alt> is handled through attributes, but images nested in
          // links also need their alt considered — already covered.
          walkChildren(child);
        } else {
          walkChildren(child);
        }
      }
    }
  };

  walkChildren(tree);
  return units;
}

function inlineContext(element) {
  if (element.tag === 'a') {
    const href = getAttr(element, 'href') || '';
    if (href.startsWith('mailto:')) return 'Link label showing an email address. Keep the address unchanged.';
    if (href.startsWith('tel:')) return 'Link label showing a phone number. Keep the number unchanged.';
    return 'Link label. Name the destination in a natural way, not a literal translation of the Romanian.';
  }
  if (element.tag === 'strong' || element.tag === 'b') return 'Emphasised phrase inside a sentence. Keep the emphasis meaning.';
  if (element.tag === 'em' || element.tag === 'i') return 'Italic phrase inside a sentence, usually a clarification.';
  if (element.tag === 'small') return 'Small print, usually a legal or supplementary note.';
  return `Text inside <${element.tag}>.`;
}
