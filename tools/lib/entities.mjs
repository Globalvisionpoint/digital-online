/* ============================================================
   HTML entity handling for the translation pipeline.

   The site uses `&amp;` in its markup, but the same visible text
   also appears with a raw `&` inside attribute values and inside
   JSON-LD. If the catalog keys on the raw spelling, "Implementare
   AI & Chatboți" and "Implementare AI &amp; Chatboți" become two
   different keys for one visible string — the catalog fragments and
   one of the two never matches.

   The fix: the catalog always stores the *decoded* text, so one
   visible string has exactly one key. On the way out the text is
   re-encoded for the context it lands in:
     - text nodes   -> a raw `&` is valid HTML text
     - attributes   -> `&amp;` keeps the attribute well-formed
     - JSON-LD     -> JSON string escaping
   ============================================================ */

/** Named entities that actually occur on this site, plus the usual
    suspects, so decoding stays predictable. */
const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  ndash: '\u2013',
  mdash: '\u2014',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201c',
  rdquo: '\u201d',
  hellip: '\u2026',
  bull: '\u2022',
  middot: '\u00b7',
  copy: '\u00a9',
  reg: '\u00ae',
  trade: '\u2122',
  euro: '\u20ac',
  pound: '\u00a3',
  deg: '\u00b0',
  laquo: '\u00ab',
  raquo: '\u00bb',
  eacute: '\u00e9',
  egrave: '\u00e8',
  agrave: '\u00e0',
  ccedil: '\u00e7',
  uuml: '\u00fc',
  ouml: '\u00f6',
  auml: '\u00e4',
  szlig: '\u00df',
  ntilde: '\u00f1',
  iacute: '\u00ed',
  iquest: '\u00bf',
  iuml: '\u00ef',
  aring: '\u00e5',
  oslash: '\u00f8',
  aacute: '\u00e1',
  uacute: '\u00fa',
  shy: '\u00ad'
};

const ENTITY_RE = /&(#[Xx][0-9A-Fa-f]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g;

/**
 * Turn the HTML entities of a string into the characters they stand for.
 * Unknown entities are left untouched, so a stray `&` in a URL or a
 * query string is never mangled.
 */
export function decodeEntities(value) {
  if (!value || value.indexOf('&') === -1) return value;
  return value.replace(ENTITY_RE, (match, body) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = Number.parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? match : named;
  });
}

/**
 * Encode a string for use inside an HTML text node.
 * `<` and `>` are escaped for safety; `&` is left raw because it is
 * perfectly valid in text and keeping it raw keeps the generated
 * page byte-identical to the source when nothing changed.
 */
export function escapeForText(value) {
  if (!value) return value;
  return value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Encode a string for use inside a double-quoted HTML attribute.
 */
export function escapeForAttr(value) {
  if (!value) return value;
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Make a JSON string literal safe to place inside a <script> block.
 *
 * The literal must already be stringified (JSON.stringify handles the
 * quotes and the backslashes). What is left to do is to stop a
 * translation from closing the script element: `<` and `>` become the
 * < and > escapes, which JSON reads back as the same characters.
 */
export function escapeForJson(literal) {
  if (!literal) return literal;
  return literal
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
