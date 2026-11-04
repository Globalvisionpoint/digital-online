/* ============================================================
   Language switcher.

   The switcher markup is written into every page by the build
   (see tools/lib/switcher.mjs). This file only wires up the
   behaviour: open/close, keyboard support, outside-click
   dismissal and remembering the visitor's choice.

   It lives in its own file rather than inline so the site can keep
   a strict Content-Security-Policy (script-src 'self').
   ============================================================ */

(function () {
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
  //
  // The cookie is the one the server-side middleware reads, so it is
  // what makes an explicit choice win over the automatic country
  // detection. localStorage is kept as a fallback for browsers that
  // block cookies.
  var links = menu.querySelectorAll('a[data-lang]');
  for (var i = 0; i < links.length; i += 1) {
    links[i].addEventListener('click', function () {
      var lang = this.getAttribute('data-lang');
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
      try {
        document.cookie = STORAGE_KEY + '=' + encodeURIComponent(lang) +
          '; path=/; max-age=15552000; samesite=lax';
      } catch (e) {}
      setOpen(false);
    });
  }
})();
