/* ============================================================
   The language switcher.

   A flag button in the top-right of the header that opens a small
   dropdown with the four available languages. The markup is
   rendered by the build into every page, so it is identical
   everywhere and needs no runtime wiring beyond the click handler.
   ============================================================ */

import { LOCALES, getLocale } from './config.mjs';

/**
 * The flags, drawn from the official artwork of the `flag-icons`
 * project (MIT licensed).
 *
 * They live in `img/flags/` as real files rather than inline SVG so
 * the browser caches them across pages, and so a 20x15 badge does
 * not drag 40 kB of vector paths into every page load.
 *
 * The artwork keeps its own proportions (4:3 for all four), which
 * is what the flags actually look like.
 */
const FLAGS = {
  ro: 'img/flags/ro.svg',
  gb: 'img/flags/gb.svg',
  es: 'img/flags/es.svg',
  br: 'img/flags/br.svg'
};

/**
 * The badge markup for a flag.
 *
 * The image is decorative: the language is always spelled out next
 * to it, so the badge carries no accessible name of its own.
 *
 * `eager` is for the flag in the header itself, which is above the
 * fold and must be there the moment the page paints. The badges in
 * the dropdown stay lazy, because that menu is closed on arrival.
 */
export function flagSvg(flagCode, prefix = '', eager = false) {
  const src = FLAGS[flagCode];
  if (!src) return '';
  const loading = eager ? 'eager' : 'lazy';
  return `<img class="lang-flag-img" src="${prefix}${src}" alt="" width="20" height="15" loading="${loading}" decoding="async">`;
}

/**
 * Markup for the switcher.
 *
 * @param {string} current  current locale code
 * @param {object} urls     { [localeCode]: relativeUrl }
 * @param {object} labels   { open, menu }
 * @param {string} prefix   path prefix for the shared assets
 */
export function switcherMarkup(current, urls, labels = {}, prefix = '') {
  const locale = getLocale(current);
  const items = LOCALES.map((l) => {
    const isCurrent = l.code === current;
    const href = urls[l.code] || '/';
    return `        <li role="none">
          <a role="menuitem" href="${href}" class="lang-option${isCurrent ? ' is-current' : ''}" hreflang="${l.hreflang}" lang="${l.htmlLang}" data-lang="${l.code}"${isCurrent ? ' aria-current="true"' : ''}>
            <span class="lang-option-flag">${flagSvg(l.flag, prefix)}</span>
            <span class="lang-option-name">${l.label}</span>
            <span class="lang-option-code">${l.shortLabel}</span>
          </a>
        </li>`;
  }).join('\n');

  return `      <div class="lang-switcher" id="langSwitcher" data-lang-switcher>
        <button type="button" class="lang-trigger" id="langTrigger" aria-haspopup="true" aria-expanded="false" aria-controls="langMenu" aria-label="${labels.open || 'Schimbă limba'}">
          <span class="lang-trigger-flag">${flagSvg(locale.flag, prefix, true)}</span>
          <span class="lang-trigger-code">${locale.shortLabel}</span>
          <svg class="lang-caret" viewBox="0 0 10 6" aria-hidden="true" focusable="false"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <ul class="lang-menu" id="langMenu" role="menu" aria-label="${labels.menu || 'Limbi'}">
${items}
        </ul>
      </div>`;
}

/**
 * The script that wires the switcher: open/close, keyboard support,
 * outside-click dismissal and persistence of the choice.
 */
export function switcherScript() {
  return `(function () {
  'use strict';
  var root = document.getElementById('langSwitcher');
  if (!root) return;
  var trigger = document.getElementById('langTrigger');
  var menu = document.getElementById('langMenu');
  if (!trigger || !menu) return;

  var STORAGE_KEY = 'digital-online-lang';

  function setOpen(open) {
    root.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  trigger.addEventListener('click', function (event) {
    event.stopPropagation();
    setOpen(!root.classList.contains('is-open'));
  });

  document.addEventListener('click', function (event) {
    if (!root.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && root.classList.contains('is-open')) {
      setOpen(false);
      trigger.focus();
    }
  });

  // Remember the choice so the next visit starts in the same language.
  var links = menu.querySelectorAll('a[data-lang]');
  for (var i = 0; i < links.length; i += 1) {
    links[i].addEventListener('click', function () {
      try { localStorage.setItem(STORAGE_KEY, this.getAttribute('data-lang')); } catch (e) {}
      setOpen(false);
    });
  }
})();`;
}
