/* ============================================================
   ASCII header navigation.

   The desktop navigation is typeset in Aspera, a display typeface
   that only contains ASCII glyphs. Any accented character in a
   nav label (INÍCIO, SERVIÇOS) falls back to a different font for
   that single letter, so it no longer lines up with its
   neighbours. Transliterating the label keeps every letter in the
   same typeface.

   The transliteration is deliberately scoped:
     - only the desktop navigation of the header,
     - only locales that opt in (see `asciiHeaderNav` in config),
     - only the nav labels themselves.

   The mobile menu, the dropdown, the hero titles and the page
   body keep their proper diacritics, and so do the aria-labels,
   which are read by screen readers rather than drawn.
   ============================================================ */

import { findElements, hasClass, spliceText } from './html.mjs';

/* Letters that do not decompose into a base character plus a
   combining mark, so NFD alone cannot fold them to ASCII. */
const SPECIAL_LETTERS = {
  'Æ': 'AE', 'æ': 'ae',
  'Œ': 'OE', 'œ': 'oe',
  'Ø': 'O', 'ø': 'o',
  'Ł': 'L', 'ł': 'l',
  'Đ': 'D', 'đ': 'd',
  'Ð': 'D', 'ð': 'd',
  'Þ': 'TH', 'þ': 'th',
  'ß': 'ss', 'ẞ': 'SS'
};

/* Punctuation that only appears in Spanish and Portuguese prose. */
const SPECIAL_PUNCTUATION = {
  '¿': '?', '¡': '!'
};

/**
 * Fold a string down to the ASCII letters it is built from.
 *
 * `NFD` splits "ç" into "c" plus a combining cedilla, so stripping
 * the combining marks removes the accent while keeping the letter.
 */
export function toAscii(value) {
  if (!value) return value;

  let folded = '';
  for (const char of value) {
    if (SPECIAL_LETTERS[char] !== undefined) {
      folded += SPECIAL_LETTERS[char];
    } else if (SPECIAL_PUNCTUATION[char] !== undefined) {
      folded += SPECIAL_PUNCTUATION[char];
    } else {
      folded += char;
    }
  }

  return folded.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Patches that fold the desktop header navigation to ASCII.
 *
 * @param {object} tree parsed page
 * @returns {Array<{start:number,end:number,text:string}>}
 */
export function asciiHeaderNavPatches(tree) {
  const patches = [];

  for (const header of findElements(tree, e => e.tag === 'header')) {
    for (const label of findElements(header, e => hasClass(e, 'nav-link'))) {
      for (const child of label.children || []) {
        if (child.type !== 'text') continue;

        const original = child.value;
        const trimmed = original.trim();
        if (!trimmed) continue;

        const ascii = toAscii(trimmed);
        if (ascii === trimmed) continue;

        patches.push({
          start: child.start,
          end: child.end,
          text: spliceText(original, ascii)
        });
      }
    }
  }

  return patches;
}
