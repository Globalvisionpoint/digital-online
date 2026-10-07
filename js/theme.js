/* ============================================================
   themes.js — Lightweight enhancements for theme hero
   - Parallax on topo lines SVG (mouse-move)
   - Header solid on scroll
   ============================================================ */
(() => {
  'use strict';

  const stripHeaderDiacritics = (value) => value.replace(/[ăĂâÂîÎșȘşŞțȚţŢ]/g, character => ({
    ă: 'a', Ă: 'A', â: 'a', Â: 'A', î: 'i', Î: 'I',
    ș: 's', Ș: 'S', ş: 's', Ş: 'S', ț: 't', Ț: 'T',
    ţ: 't', Ţ: 'T'
  })[character]);

  document.querySelectorAll('.nav-list .nav-link, .nav-dropdown a, .mobile-nav-link, .mobile-nav-sublink, .hero-theme .hm-title-fill, .hero-theme .hm-tagline-text').forEach((element) => {
    // Walk child nodes so we don't destroy <br> elements (e.g. in hero titles)
    const walk = (node) => {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 3) {
          child.nodeValue = stripHeaderDiacritics(child.nodeValue);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(element);
  });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;

  // ----- Header scroll state -----
  const header = document.getElementById('topHeader');
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 40) header.classList.add('is-scrolled');
      else header.classList.remove('is-scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ----- Parallax on topo lines (mouse) -----
  if (!reduceMotion && !isTouch) {
    const topo = document.querySelector('.hm-topo');
    const title = document.querySelector('.hm-title-fill');
    const hero = document.querySelector('.hero-theme');

    if (topo && hero) {
      let raf = null;
      let targetX = 0, targetY = 0;
      let currentX = 0, currentY = 0;

      const onMove = (e) => {
        const rect = hero.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        // map [0..1] -> [-1..1]
        targetX = (x - 0.5) * 2;
        targetY = (y - 0.5) * 2;
        if (!raf) raf = requestAnimationFrame(tick);
      };

      const tick = () => {
        // smooth easing
        currentX += (targetX - currentX) * 0.08;
        currentY += (targetY - currentY) * 0.08;

        const tx = currentX * 18; // px
        const ty = currentY * 12;
        topo.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;

        if (title) {
          title.style.backgroundPosition = `${50 + currentX * 4}% ${30 + currentY * 3}%`;
        }

        // stop when close enough
        if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
          raf = requestAnimationFrame(tick);
        } else {
          raf = null;
        }
      };

      hero.addEventListener('mousemove', onMove);
      hero.addEventListener('mouseleave', () => {
        targetX = 0; targetY = 0;
        if (!raf) raf = requestAnimationFrame(tick);
      });
    }
  }

  // ----- Year stamp -----
  const yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  // ----- Mobile menu toggle -----
  const menuToggle = document.getElementById('menuToggle');
  const mobileNav = document.getElementById('mobileNav');
  const mobileNavClose = document.getElementById('mobileNavClose');
  if (menuToggle && mobileNav) {
    const closeMenu = () => {
      menuToggle.classList.remove('is-open');
      mobileNav.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    };

    menuToggle.addEventListener('click', () => {
      const isOpen = menuToggle.classList.toggle('is-open');
      mobileNav.classList.toggle('is-open', isOpen);
      menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close button inside overlay
    if (mobileNavClose) {
      mobileNavClose.addEventListener('click', closeMenu);
    }

    // Close menu when clicking a link
    mobileNav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => closeMenu());
    });

    // Mobile sub-accordion toggles
    mobileNav.querySelectorAll('.mobile-nav-toggle').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        const targetId = btn.getAttribute('aria-controls');
        if (targetId) {
          const sub = document.getElementById(targetId);
          if (sub) sub.classList.toggle('is-open', !expanded);
        }
      });
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuToggle.classList.contains('is-open')) closeMenu();
    });

    // Close menu if resized past mobile breakpoint
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) closeMenu();
    });
  }

  // ----- Desktop dropdown menu (SERVICII) -----
  document.querySelectorAll('.has-dropdown').forEach((dd) => {
    const toggle = dd.querySelector('.nav-dropdown-toggle');
    if (!toggle) return;
    if (toggle.tagName === 'A') return;

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = dd.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.has-dropdown.is-open').forEach((dd) => {
      if (!dd.contains(e.target)) {
        dd.classList.remove('is-open');
        const t = dd.querySelector('.nav-dropdown-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Close dropdown on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.has-dropdown.is-open').forEach((dd) => {
        dd.classList.remove('is-open');
        const t = dd.querySelector('.nav-dropdown-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }
  });

  // ----- Equal-gap SCROLL positioning -----
  // SCROLL text top → tagline bottom == line bottom → viewport bottom
  // Works at every viewport size and aspect ratio.
  const hero = document.querySelector('.hero-theme');
  const tagline = document.querySelector('.hm-tagline');
  const scroll = document.querySelector('.hm-scroll');
  if (hero && tagline && scroll && !reduceMotion) {
    const positionScroll = () => {
      const taglineRect = tagline.getBoundingClientRect();
      const heroRect = hero.getBoundingClientRect();
      // Tagline bottom relative to hero top
      const taglineBottom = taglineRect.bottom - heroRect.top;
      // Available height = hero height (hero is 100vh, fills the visible area)
      const available = heroRect.height;
      // SCROLL block height (text + gap + line)
      const scrollHeight = scroll.offsetHeight;
      // Compute gap so top-of-Scroll to bottom-of-tagline equals bottom-of-line to hero bottom
      // gapAbove = scrollTop - taglineBottom
      // gapBelow = available - (scrollTop + scrollHeight)
      // Set gapAbove = gapBelow → scrollTop = (taglineBottom + available - scrollHeight) / 2
      let scrollTop = (taglineBottom + available - scrollHeight) / 2;
      // Safety: don't overlap tagline or bottom edge
      const minTop = taglineBottom + 8;
      const maxTop = available - scrollHeight - 8;
      scrollTop = Math.max(minTop, Math.min(scrollTop, maxTop));
      scroll.style.setProperty('--scroll-top', scrollTop + 'px');
      // Reveal once positioned
      scroll.classList.add('is-loaded');
    };
    // Run after fonts/images settle
    const runAfterLayout = () => {
      // requestAnimationFrame ensures layout is current
      requestAnimationFrame(() => requestAnimationFrame(positionScroll));
    };
    runAfterLayout();
    window.addEventListener('resize', runAfterLayout);
    window.addEventListener('orientationchange', runAfterLayout);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(runAfterLayout);
    }
    // Re-run when hero image swaps backgroundPosition (parallax) — they don't change height, but be safe
    const img = hero.querySelector('.hm-bg-img');
    if (img && !img.complete) img.addEventListener('load', runAfterLayout);
  }
})();

(() => {
  'use strict';

  const storageKey = 'digital-online-cookie-consent';
  const consentVersion = '1';
  const consentLifetime = 180 * 24 * 60 * 60 * 1000;
  let memoryConsent = null;
  let returnFocus = null;

  const isValidConsent = (value) => value &&
    value.version === consentVersion &&
    Number(value.expiresAt) > Date.now() &&
    value.categories &&
    typeof value.categories.analytics === 'boolean' &&
    typeof value.categories.marketing === 'boolean';

  const readConsent = () => {
    if (isValidConsent(memoryConsent)) return memoryConsent;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return isValidConsent(saved) ? saved : null;
    } catch (_) {
      return null;
    }
  };

  const ui = document.createElement('div');
  ui.innerHTML = `
    <section class="cookie-banner" aria-labelledby="cookie-banner-title" hidden>
      <div class="cookie-banner-copy">
        <h2 id="cookie-banner-title">Preferințe cookie</h2>
        <p>Reținem alegerea ta în stocarea locală necesară. În prezent, site-ul nu încarcă instrumente opționale de analiză sau publicitate. Poți consulta <a href="politica-cookie.html">politica de cookies</a>.</p>
      </div>
      <div class="cookie-banner-actions">
        <button type="button" data-cookie-reject>Respinge opționale</button>
        <button type="button" data-cookie-settings>Setări</button>
        <button type="button" data-cookie-accept>Acceptă toate</button>
      </div>
    </section>
    <dialog class="cookie-dialog" aria-labelledby="cookie-dialog-title" aria-describedby="cookie-dialog-description">
      <div class="cookie-dialog-head">
        <div>
          <p class="cookie-dialog-eyebrow">CONTROLUL PREFERINȚELOR</p>
          <h2 id="cookie-dialog-title">Setări cookie</h2>
        </div>
        <button class="cookie-dialog-close" type="button" data-cookie-close aria-label="Închide setările">×</button>
      </div>
      <p id="cookie-dialog-description">Poți schimba alegerea oricând din linkul „Setări cookie” din subsol. Preferința se păstrează 180 de zile.</p>
      <div class="cookie-category">
        <div><strong>Strict necesare</strong><p>Necesare pentru reținerea preferinței tale; sunt mereu active.</p></div>
        <input type="checkbox" checked disabled aria-label="Cookie-uri strict necesare, mereu active">
      </div>
      <label class="cookie-category" for="cookie-analytics">
        <span><strong>Analiză</strong><span class="cookie-category-note">Nu este activă în prezent pe acest site.</span></span>
        <input id="cookie-analytics" type="checkbox">
      </label>
      <label class="cookie-category" for="cookie-marketing">
        <span><strong>Marketing</strong><span class="cookie-category-note">Nu este activ în prezent pe acest site.</span></span>
        <input id="cookie-marketing" type="checkbox">
      </label>
      <div class="cookie-dialog-actions">
        <button type="button" data-cookie-close>Închide</button>
        <button type="button" data-cookie-save>Salvează preferințele</button>
      </div>
      <p class="cookie-dialog-note">Salvarea unei preferințe nu activează instrumente care nu sunt instalate pe site.</p>
    </dialog>`;
  document.body.append(ui);

  const banner = ui.querySelector('.cookie-banner');
  const dialog = ui.querySelector('.cookie-dialog');
  const analyticsToggle = ui.querySelector('#cookie-analytics');
  const marketingToggle = ui.querySelector('#cookie-marketing');

  const dispatchConsent = (consent) => {
    window.dispatchEvent(new CustomEvent('digitalonline:consentchange', { detail: consent }));
  };

  const saveConsent = (analytics, marketing) => {
    const consent = {
      version: consentVersion,
      updatedAt: new Date().toISOString(),
      expiresAt: Date.now() + consentLifetime,
      categories: { necessary: true, analytics, marketing }
    };
    memoryConsent = consent;
    try {
      localStorage.setItem(storageKey, JSON.stringify(consent));
    } catch (_) {
      // Keep the current choice for this page view if storage is unavailable.
    }
    banner.hidden = true;
    if (dialog.open) dialog.close();
    dispatchConsent(consent);
  };

  const openSettings = () => {
    returnFocus = document.activeElement;
    const saved = readConsent();
    analyticsToggle.checked = Boolean(saved?.categories.analytics);
    marketingToggle.checked = Boolean(saved?.categories.marketing);
    banner.hidden = true;
    if (!dialog.open) dialog.showModal();
  };

  ui.querySelector('[data-cookie-accept]').addEventListener('click', () => saveConsent(true, true));
  ui.querySelector('[data-cookie-reject]').addEventListener('click', () => saveConsent(false, false));
  ui.querySelectorAll('[data-cookie-settings]').forEach((button) => button.addEventListener('click', openSettings));
  ui.querySelectorAll('[data-cookie-close]').forEach((button) => button.addEventListener('click', () => dialog.close()));
  ui.querySelector('[data-cookie-save]').addEventListener('click', () => saveConsent(analyticsToggle.checked, marketingToggle.checked));
  dialog.addEventListener('close', () => {
    banner.hidden = Boolean(readConsent());
    if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus();
  });

  window.openCookieSettings = openSettings;
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest('[data-open-cookie-settings]');
    if (!trigger) return;
    event.preventDefault();
    openSettings();
  });
  const savedConsent = readConsent();
  banner.hidden = Boolean(savedConsent);
  if (savedConsent) dispatchConsent(savedConsent);

  const footerBottom = document.querySelector('.footer-bot');
  if (footerBottom && !footerBottom.querySelector('.legal-footer-links')) {
    const legalLinks = document.createElement('nav');
    legalLinks.className = 'legal-footer-links';
    legalLinks.setAttribute('aria-label', 'Informații legale');
    legalLinks.innerHTML = '<a href="politica-confidentialitate.html">Confidențialitate</a><a href="politica-cookie.html">Politica de cookies</a><a href="termeni-si-conditii.html">Termeni și condiții</a><button type="button" data-cookie-settings>Setări cookie</button>';
    footerBottom.append(legalLinks);
    legalLinks.querySelector('[data-cookie-settings]').addEventListener('click', openSettings);
  }
})();
