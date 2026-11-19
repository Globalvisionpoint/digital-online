/* ============================================================
   Generating the Vercel Routing Middleware.

   The middleware is what picks the language for a visitor who
   has not chosen one yet: it reads the country of the incoming
   IP and sends the visitor to the matching language folder.

   It also serves the Markdown an agent asks for. The site writes
   a Markdown file next to every page at build time
   (tools/lib/markdown.mjs), so the middleware only has to choose
   the representation, never convert anything per request:

     Accept: text/markdown -> that page's Markdown,
     Accept: text/html     -> the page itself,
     neither can be served -> 406,
     a page that is missing -> 404 whose body is also Markdown.

   Both representations carry Vary: Accept, so no cache hands an
   agent the HTML a browser warmed up.

   `middleware-body.mjs` holds the logic as a string, so the tests
   can import it, evaluate it and call the handler with real Request
   objects; this module only substitutes the locale tables that the
   rest of the build owns.
   ============================================================ */

import { LOCALES } from './config.mjs';
import { MIDDLEWARE_BANNER, MIDDLEWARE_BODY } from './middleware-body.mjs';

/** Bot user-agent patterns that must never be redirected. */
const BOT_PATTERN =
  'bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|' +
  'headless|scrapy|semrush|ahrefs|mj12bot|dotbot|blexbot|petalbot|' +
  'gptbot|claudebot|ccbot|bytespider|perplexity|oai-searchbot|' +
  'chatgpt-user|adsbot|applebot|twitterbot|linkedinbot|discordbot|' +
  'telegrambot|whatsapp|preview|python-requests|curl|wget|libwww';

/**
 * The country, prefix and Accept-Language tables of the middleware.
 *
 * They come from the locale configuration so the country list and
 * the URL prefixes can never drift apart from the rest of the build.
 */
export function localeTables() {
  const countryToLocale = {};
  for (const locale of LOCALES) {
    for (const country of locale.countries) {
      countryToLocale[country] = locale.code;
    }
  }

  const localeToPrefix = {};
  const localePaths = [];
  for (const locale of LOCALES) {
    localeToPrefix[locale.code] = locale.prefix;
    if (locale.prefix) localePaths.push(`/${locale.prefix}`);
  }

  // The Accept-Language fallback: the primary language subtag of the
  // browser decides, so pt-BR and pt-PT both land on Brazilian
  // Portuguese.
  const languageToLocale = {
    ro: 'ro',
    pt: 'pt-BR',
    es: 'es',
    en: 'en'
  };

  return { countryToLocale, localeToPrefix, localePaths, languageToLocale };
}

/** Substitute a placeholder, failing loudly when one is missing. */
function fill(template, token, value) {
  if (!template.includes(token)) throw new Error(`middleware template is missing ${token}`);
  return template.split(token).join(value);
}

/**
 * The Markdown sibling of every page that exists, in every locale.
 *
 * The middleware answers a request for a Markdown page from this
 * list, so an agent asking for a page that does not exist gets a 404
 * instead of a fetch and a 404 from the CDN.
 *
 * @param {string[]} pages the page file names (index.html, ...)
 */
function knownPages(pages) {
  const keys = [];
  for (const locale of LOCALES) {
    const prefix = locale.prefix ? `/${locale.prefix}` : '';
    for (const page of pages) {
      if (page === 'index.html') {
        keys.push(prefix === '' ? '/' : `${prefix}/`);
      } else {
        keys.push(`${prefix}/${page}`.replace(/\.html$/, ''));
      }
    }
  }
  return keys;
}

/**
 * The trust pages, which answer with and without the .html extension.
 *
 * An agent checking whether a business is legitimate opens /about,
 * /contact and /privacy, and it opens them without the extension.
 * Those three paths are the only clean URLs the site adds; every
 * other page keeps the one address it already had.
 */
const CLEAN_PAGE_KEYS = ['about', 'contact', 'privacy'];

/**
 * The clean paths of the trust pages, in every locale.
 *
 * @param {string[]} pages the page file names (index.html, ...)
 */
function cleanPaths(pages) {
  const available = new Set(pages.map(page => page.replace(/\.html$/, '')));
  const keys = [];
  for (const locale of LOCALES) {
    const prefix = locale.prefix ? `/${locale.prefix}` : '';
    for (const key of CLEAN_PAGE_KEYS) {
      if (available.has(key)) keys.push(`${prefix}/${key}`);
    }
  }
  return keys;
}

/**
 * Render middleware.ts.
 *
 * @param {string[]} pages the page file names the site publishes
 * @returns {string} the TypeScript source
 */
export function renderMiddleware(pages = []) {
  const { countryToLocale, localeToPrefix, localePaths, languageToLocale } = localeTables();

  let body = MIDDLEWARE_BODY;
  body = fill(body, '__COUNTRY_TO_LOCALE__', JSON.stringify(countryToLocale, null, 2));
  body = fill(body, '__LOCALE_PREFIX__', JSON.stringify(localeToPrefix, null, 2));
  body = fill(body, '__LOCALE_PATHS__', JSON.stringify(localePaths));
  body = fill(body, '__LANGUAGE_TO_LOCALE__', JSON.stringify(languageToLocale, null, 2));
  body = fill(body, '__KNOWN_PAGES__', JSON.stringify(knownPages(pages), null, 2));
  body = fill(body, '__CLEAN_PATHS__', JSON.stringify(cleanPaths(pages)));
  body = fill(body, '__BOT_PATTERN__', JSON.stringify(BOT_PATTERN));

  return `${MIDDLEWARE_BANNER}${body}`;
}
