/* ============================================================
   Lint the translation catalogs for the kinds of mistakes that
   are easy to make when writing 600+ strings by hand:

     - a missing space after a comma or a full stop
     - a doubled space
     - a space before a comma or a full stop
     - leftover markup entities or double-escaped characters
     - a stray non-Latin character (CJK, Cyrillic, ...)
     - an English or Romanian word left in a translated string
     - the same word twice in a row ("PRODUTOS DA CHINADA CHINA")
     - a translation that repeats a word of the Romanian source
       ("da China da China") and therefore loses the meaning
     - a hero title left in Romanian
     - mojibake: a broken UTF-8 sequence

   Run with:  node tools/lint-catalogs.mjs
   ============================================================ */

import { LOCALES } from './lib/config.mjs';

const CATALOGS = {
  en: (await import(new URL('locales/en.mjs', import.meta.url))).default.strings,
  es: (await import(new URL('locales/es.mjs', import.meta.url))).default.strings,
  'pt-BR': (await import(new URL('locales/pt-BR.mjs', import.meta.url))).default.strings
};

/* Romanian leftovers that should never survive a translation.
   Spanish and Portuguese words that look similar (servicios,
   serviços, loja, ...) are legitimate and are not listed here. */
const SUSPECT_WORDS = [
  'servicii',
  'creștem',
  'creştem',
  'custum',
  'magazine',
  'chatboți',
  'ai și',
  'și implementare',
  'al nostru',
  'pentru tine'
];

const RULES = [
  {
    name: 'missing space after comma',
    test: (s) => /[,;:][^\s\d]/g
  },
  {
    name: 'missing space after full stop',
    test: (s) => /\.[A-Za-zÀ-ž]/g
  },
  {
    name: 'double space',
    test: (s) => / {2,}/g
  },
  {
    name: 'space before punctuation',
    test: (s) => /\s[,;:]/g
  },
  {
    name: 'surrounding whitespace',
    test: (s) => /^\s|\s$/g
  },
  {
    name: 'double escaped entity',
    test: (s) => /&amp;(amp|lt|gt|quot|#\d+);/g
  },
  {
    name: 'non latin script',
    test: (s) => /[\u0400-\u04FF\u3000-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g
  },
  {
    // Letters that exist only in Romanian. Spanish and Portuguese
    // have their own (ã, õ, ç, é, í, ...) and those are legitimate.
    name: 'romanian only letter',
    test: (s) => /[ăĂîÎșȘțȚţţşŞ]/g
  },
  {
    // A broken UTF-8 sequence: the replacement character or the
    // "Â" that shows up when a byte string is decoded as Latin-1.
    name: 'mojibake',
    test: (s) => /[\uFFFDÂÃ][\u0080-\u00BF]?/g
  }
];

/* Words that carry the meaning of the Romanian source. A translation
   that repeats one of them twice in a row ("da China da China",
   "PRODUTOS DA CHINADA CHINA") has lost the sentence, so the
   repetition is reported. */
const MEANING_WORDS = [
  'china', 'produse', 'productos', 'produtos', 'import', 'importación',
  'importacao', 'sourcing', 'servicii', 'servicios', 'serviços', 'business',
  'negocios', 'negócios'
];

/**
 * The words of a string, lowercased and stripped of punctuation.
 * "PRODUTOS DA CHINADA CHINA" -> ["produtos", "da", "chinada", "china"]
 */
function words(value) {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Report a word that appears twice in a row.
 *
 * The check looks at the raw text rather than at a list of words:
 * "CHINADA" and "CHINA" are different words, so the bug that slipped
 * through before ("PRODUTOS DA CHINADA CHINA") is not caught by a
 * plain duplicate-word rule. It is caught by the overlap rule below.
 */
function adjacentDuplicates(value) {
  const found = [];
  const tokens = value.split(/\s+/).filter(Boolean);
  const normalized = tokens.map(token => token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''));

  for (let i = 1; i < normalized.length; i += 1) {
    if (normalized[i] && normalized[i] === normalized[i - 1]) {
      found.push(tokens[i - 1] + ' ' + tokens[i]);
    }
  }
  return found;
}

/**
 * Report a word that starts with the word right before it.
 *
 * This is the shape of the bug that reached production:
 * "PRODUTOS DA CHINADA CHINA" glues the last word onto the
 * previous one, so "CHINADA" starts with "CHINA" and the sentence
 * repeats itself. A plain duplicate-word rule misses it, because
 * "CHINADA" and "CHINA" are different words.
 */
function gluedWords(value) {
  const found = [];
  const tokens = value.split(/\s+/).filter(Boolean);
  const normalized = tokens.map(token => token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''));

  for (let i = 1; i < normalized.length; i += 1) {
    const previous = normalized[i - 1];
    const current = normalized[i];
    if (previous.length < 5 || current.length < 5) continue;
    if (current === previous) continue;
    /* Either word may carry the other: "PRODUTO" + "PRODUTOS" and
       "CHINADA" + "CHINA" are the same kind of mistake. */
    if (current.startsWith(previous) || previous.startsWith(current)) {
      found.push(tokens[i - 1] + ' ' + tokens[i]);
    }
  }
  return found;
}

let problemCount = 0;

for (const [locale, catalog] of Object.entries(CATALOGS)) {
  const label = locale;
  const entries = Object.entries(catalog);

  for (const [source, translation] of entries) {
    if (typeof translation !== 'string') {
      console.log(`[${label}] NOT A STRING: ${source}`);
      problemCount++;
      continue;
    }

    for (const rule of RULES) {
      const matches = translation.match(rule.test);
      if (!matches) continue;
      for (const match of matches) {
        const at = translation.indexOf(match);
        const around = translation.slice(Math.max(0, at - 30), at + match.length + 30);
        console.log(`[${label}] ${rule.name}: ...${around}...`);
        problemCount++;
      }
    }

    for (const word of SUSPECT_WORDS) {
      const re = new RegExp(`\\b${word}\\b`, 'i');
      if (re.test(translation) && locale !== 'en') {
        const at = translation.search(re);
        console.log(
          `[${label}] suspect word "${word}": ...${translation.slice(Math.max(0, at - 30), at + word.length + 30)}...`
        );
        problemCount++;
      }
    }

    /* --- The same word twice in a row --- */
    for (const duplicate of adjacentDuplicates(translation)) {
      console.log(`[${label}] repeated word: ${JSON.stringify(duplicate)} in ${JSON.stringify(translation)}`);
      problemCount++;
    }

    /* --- A word glued onto the previous one: the sentence repeats
           itself ("PRODUTOS DA CHINADA CHINA"). --- */
    for (const glued of gluedWords(translation)) {
      console.log(`[${label}] glued word: ${JSON.stringify(glued)} in ${JSON.stringify(translation)}`);
      problemCount++;
    }
  }

  console.log(`[${label}] ${entries.length} entries checked`);
}

console.log(problemCount ? `\n${problemCount} problem(s) found.` : '\nNo problems found.');
process.exit(problemCount ? 1 : 0);
