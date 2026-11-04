/* ============================================================
   Locale configuration for the Digital Online site.

   The Romanian site stays at the root (https://digital-online.ro/)
   so every existing link, ranking and URL keeps working. Localized
   versions live under a locale prefix (/en/, /es/, /pt-br/) and are
   generated from the same Romanian source at build time.

   All generated links stay relative, exactly like the original site,
   so the pages work from any host and can be previewed from disk.
   ============================================================ */

export const SITE_URL = 'https://digital-online.ro';

export const LOCALES = [
  {
    code: 'ro',
    prefix: '',
    htmlLang: 'ro',
    ogLocale: 'ro_RO',
    hreflang: 'ro',
    label: 'Română',
    shortLabel: 'RO',
    flag: 'ro',
    countries: ['RO', 'MD'],
    locale: 'ro_RO'
  },
  {
    code: 'en',
    prefix: 'en',
    htmlLang: 'en',
    ogLocale: 'en_US',
    hreflang: 'en',
    label: 'English',
    shortLabel: 'EN',
    flag: 'gb',
    countries: ['US', 'GB', 'CA', 'AU', 'NZ', 'IE', 'ZA', 'IN', 'SG', 'AE'],
    locale: 'en_US'
  },
  {
    code: 'es',
    prefix: 'es',
    htmlLang: 'es',
    ogLocale: 'es_ES',
    hreflang: 'es',
    label: 'Español',
    shortLabel: 'ES',
    flag: 'es',
    countries: ['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'UY', 'PY', 'BO', 'GT', 'CU', 'DO', 'HN', 'CR', 'PA', 'NI', 'SV', 'PR'],
    locale: 'es_ES'
  },
  {
    code: 'pt-BR',
    prefix: 'pt-br',
    htmlLang: 'pt-BR',
    ogLocale: 'pt_BR',
    hreflang: 'pt-BR',
    label: 'Português (Brasil)',
    shortLabel: 'PT',
    flag: 'br',
    countries: ['BR', 'PT'],
    locale: 'pt_BR',
    /* The desktop navigation is set in Aspera, a display typeface
       that only holds ASCII glyphs. Transliterate its labels so
       every letter comes from the same font. */
    asciiHeaderNav: true
  }
];

export const LOCALE_CODES = LOCALES.map(l => l.code);

export function getLocale(code) {
  return LOCALES.find(l => l.code === code) || LOCALES[0];
}

/** Map an ISO-3166 alpha-2 country code to a locale, or null. */
export function localeForCountry(country) {
  if (!country) return null;
  const upper = String(country).toUpperCase();
  for (const locale of LOCALES) {
    if (locale.countries.includes(upper)) return locale.code;
  }
  return null;
}

/** The path prefix for a locale. Romanian lives at the root. */
export function prefixFor(code) {
  const locale = getLocale(code);
  return locale.prefix ? `/${locale.prefix}` : '';
}

/**
 * The site-absolute path of a page in a locale.
 *   pagePath('ro', 'index.html')     -> '/'
 *   pagePath('en', 'index.html')     -> '/en/'
 *   pagePath('es', 'integrari.html') -> '/es/integrari.html'
 */
export function pagePath(code, file) {
  const prefix = prefixFor(code);
  const name = file === 'index.html' ? '' : file;
  return `${prefix}/${name}`;
}

/**
 * Relative path from one directory to a target path.
 * Both arguments are site-absolute, e.g. '/en/' and '/es/consultanta.html'.
 */
export function relativePath(fromDir, target) {
  const fromParts = fromDir.split('/').filter(Boolean);
  const toParts = target.split('/').filter(Boolean);
  const targetIsDir = target.endsWith('/');

  let i = 0;
  while (i < fromParts.length && i < toParts.length - 1 && fromParts[i] === toParts[i]) i += 1;

  const up = fromParts.length - i;
  const down = toParts.slice(i);
  const parts = [...Array(up).fill('..'), ...down];

  if (targetIsDir && parts.length) parts.push('');
  return parts.join('/');
}

/**
 * Build a relative link from a page in `fromCode` to a page in `toCode`.
 */
export function relativePage(fromCode, fromFile, toCode, toFile) {
  const fromDir = pagePath(fromCode, fromFile).replace(/[^/]*$/, '');
  const target = pagePath(toCode, toFile);
  return relativePath(fromDir, target);
}

/**
 * Rewrite a link found in a page of locale `code` so it points at the
 * right place. Handles `index.html`, `page.html`, `page.html#anchor`,
 * bare `#anchor` (unchanged) and root-relative asset paths.
 */
export function localizeHref(href, code, file) {
  if (!href) return href;
  if (/^(https?:|mailto:|tel:|javascript:|data:)/i.test(href)) return href;
  if (href.startsWith('#')) return href;

  const [pathPart, hash] = href.split('#');
  const suffix = hash ? `#${hash}` : '';

  // Assets (css, js, img, fonts) live at the site root and are
  // referenced relative to the page, so a localized page needs one
  // more level up.
  if (/^(css|js|img|fonts)\//.test(pathPart)) {
    return `../${pathPart}${suffix}`;
  }

  const clean = pathPart.replace(/^\.\//, '').replace(/^\//, '');
  const target = clean === '' || clean === 'index.html'
    ? pagePath(code, 'index.html')
    : pagePath(code, clean);
  const fromDir = pagePath(code, file).replace(/[^/]*$/, '');

  return `${relativePath(fromDir, target)}${suffix}`;
}

/** Build the canonical URL for a page in a given locale. */
export function canonicalFor(file, code) {
  const path = pagePath(code, file);
  return `${SITE_URL}${path === '/' ? '/' : path}`;
}
