/* ============================================================
   Lint the translation catalogs for the kinds of mistakes that
   are easy to make when writing 600+ strings by hand:

     - a missing space after a comma or a full stop
     - a doubled space
     - a space before a comma or a full stop
     - leftover markup entities or double-escaped characters
     - a stray non-Latin character (CJK, Cyrillic, ...)
     - an English or Romanian word left in a translated string

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
  }
];

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
  }

  console.log(`[${label}] ${entries.length} entries checked`);
}

console.log(problemCount ? `\n${problemCount} problem(s) found.` : '\nNo problems found.');
process.exit(problemCount ? 1 : 0);
