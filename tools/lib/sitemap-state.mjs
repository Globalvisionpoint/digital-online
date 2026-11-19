/* ============================================================
   The modification date of each page, for the sitemap.

   Google only trusts <lastmod> when it reflects a real change. A
   build that stamps every URL with today's date teaches the crawler
   to ignore the field, which is worse than having no dates at all.

   So the date of a page is derived from its content: the build
   hashes every page it writes, compares the hash with the one in
   this state file, and only moves the date when the bytes differ.
   A no-op build therefore produces a byte-identical sitemap.
   ============================================================ */

import fs from 'node:fs';
import crypto from 'node:crypto';

/** The date format the sitemaps.org protocol expects. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A short, stable fingerprint of a page's bytes. */
export function hashContent(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Read the recorded state, or start a fresh one.
 *
 * A missing or unreadable file is not an error: the build simply
 * dates every page with today, which is correct for a first run.
 *
 * @param {string} file the state file path
 * @returns {{ version: number, pages: Record<string, { hash: string, lastmod: string }> }}
 */
export function loadState(file) {
  if (!fs.existsSync(file)) return { version: 1, pages: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed.pages === 'object' && parsed.pages !== null) {
      return { version: 1, pages: parsed.pages };
    }
  } catch {
    /* A corrupt state only costs one round of fresh dates. */
  }
  return { version: 1, pages: {} };
}

/**
 * Date each page from its content hash.
 *
 * @param {{ pages: Record<string, { hash: string, lastmod: string }> }} state the recorded state
 * @param {Map<string, string>} current page key -> content hash
 * @param {string} today the date to stamp a page that changed
 * @returns {{ dates: Record<string, string>, state: object, changed: string[], removed: string[] }}
 */
export function updateState(state, current, today) {
  if (!DATE_PATTERN.test(today)) {
    throw new Error(`Refusing to write a malformed sitemap date: ${today}`);
  }

  const pages = {};
  const dates = {};
  const changed = [];

  for (const [key, hash] of current) {
    const previous = state.pages?.[key];
    /* A page whose bytes are unchanged keeps the date it already had,
       so the crawler is not told to look again for nothing. */
    const keep = previous?.hash === hash && DATE_PATTERN.test(previous?.lastmod || '');
    if (!keep) changed.push(key);

    const lastmod = keep ? previous.lastmod : today;
    pages[key] = { hash, lastmod };
    dates[key] = lastmod;
  }

  const removed = Object.keys(state.pages || {}).filter(key => !Object.hasOwn(pages, key));

  return { dates, state: { version: 1, pages }, changed, removed };
}
