/* ============================================================================
   DIGITAL ONLINE — Editorial main.js
   No dependencies. IntersectionObserver, custom cursor, scroll-driven motion.
   ============================================================================ */
(function () {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarse = matchMedia('(pointer: coarse)').matches;
  const canObserve = 'IntersectionObserver' in window;

  /* ------- Custom cursor (desktop only) ------- */
  if (!isCoarse && !reduced) {
    const c = document.createElement('div');
    c.className = 'dsh-cursor';
    document.body.appendChild(c);
    let tx = 0, ty = 0, rx = 0, ry = 0, mx = 0, my = 0;
    addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
    (function tick() {
      tx += (mx - tx) * 0.18;
      ty += (my - ty) * 0.18;
      rx += (mx - rx) * 0.08;
      ry += (my - ry) * 0.08;
      c.style.setProperty('--cx', tx + 'px');
      c.style.setProperty('--cy', ty + 'px');
      requestAnimationFrame(tick);
    })();
    const sel = 'a,button,[role="button"],.btn,.channel,.dash-card,.step-card,.why-block';
    document.addEventListener('pointerover', e => {
      if (e.target.closest(sel)) c.classList.add('is-hover');
    });
    document.addEventListener('pointerout', e => {
      if (e.target.closest(sel)) c.classList.remove('is-hover');
    });
  }

  /* ------- Viewport-triggered entrance animations ------- */
  const hero = document.querySelector('.hero-theme');
  if (hero) {
    if (canObserve && !reduced) {
      const heroObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in-view');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0 });
      heroObserver.observe(hero);
      /* Plasa de siguranta: hero-ul este primul lucru vazut, deci nu are voie
         sa ramana ascuns. Daca observatorul nu livreaza (fila in fundal, tab
         deschis la rece), il dezvelim oricum dupa o secunda. */
      setTimeout(() => {
        const rect = hero.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < innerHeight) hero.classList.add('is-in-view');
      }, 1200);
    } else {
      hero.classList.add('is-in-view');
    }
  }

  /* ------- Homepage service-card directions ------- */
  function assignEnterDirections(container) {
    const isSecondary = container.classList.contains('hm-services-featured--secondary');
    const cards = container.querySelectorAll('.hm-feature');
    cards.forEach((card, i) => {
      let enter;
      if (!isSecondary) {
        // Rand 1 (4 carduri): 0,1 stanga; 2,3 dreapta
        enter = (i < 2) ? 'left' : 'right';
      } else {
        // Rand 2 (5 carduri): 0,1 stanga; 2 jos; 3,4 dreapta
        if (i === 2)      enter = 'bottom';
        else if (i < 2)   enter = 'left';
        else              enter = 'right';
      }
      card.classList.add(`card-${enter}`);
    });
  }

  document.querySelectorAll('.hm-services-featured').forEach(assignEnterDirections);

  /* Feature-grid cards alternate sides in DOM order, which is also the visual
     order for these row-flow grids. */
  const featureGrids = document.querySelectorAll('.feature-grid');
  featureGrids.forEach(grid => {
    const cards = Array.from(grid.children).filter(el => el.classList.contains('feature'));
    if (!cards.length) return;
    cards.forEach((card, i) => {
      card.classList.add(i % 2 === 0 ? 'feature-in-left' : 'feature-in-right');
      // al doilea card al fiecarei perechi pleaca putin mai tarziu — „inchiderea
      // fermoarului" se simte mai clar
      card.style.setProperty('--fg-delay', (i % 2) * 140 + 'ms');
    });
  });

  const revealTargets = new Set(document.querySelectorAll([
    '[data-reveal]',
    '.section-head',
    '.showcase-figure',
    '.feature-grid > .feature',
    '.hm-services-featured > .hm-feature',
    '.process-flow__item',
    '.process-list > .step-card',
    '.contact-panel',
    '.hm-about .hm-post'
  ].join(',')));

  revealTargets.forEach(target => {
    if (target.matches('.hm-feature, .feature-grid > .feature')) return;
    if (!target.matches('[data-reveal]')) target.classList.add('scroll-reveal-item');
  });

  function revealTarget(target, immediate) {
    if (target.matches('.hm-feature')) {
      const cards = Array.from(target.parentElement.querySelectorAll('.hm-feature'));
      const index = cards.indexOf(target);
      const pair = Math.min(index, cards.length - 1 - index);
      // Focusul cu tastatura nu asteapta: elementul trebuie sa fie vizibil imediat.
      const delay = immediate ? 0 : pair * 500;
      target.style.transitionDelay = `${delay}ms`;
      target.classList.add('is-visible');
      const content = target.querySelector('.hm-feature-content');
      if (content) content.style.transitionDelay = immediate ? '0ms' : `${800 + delay}ms`;
    } else if (target.matches('.feature-grid > .feature')) {
      target.classList.add('is-visible');
    } else {
      target.classList.add('is-revealed');
    }
  }

  // Linkurile ascunse pana la scroll raman in ordinea de tabulare, deci la
  // focus trebuie dezvelite imediat, fara intarzierea de pereche.
  document.addEventListener('focusin', event => {
    let target = event.target;
    while (target && target !== document.body) {
      if (revealTargets.has(target)) revealTarget(target, true);
      target = target.parentElement;
    }
  });

  if (!reduced) {
    /* Pozitia de LAYOUT (fara transform) a fiecarui element, masurata fata de
       document. offsetTop nu este afectat de transformari CSS, deci ramane
       corect chiar daca elementul este momentan mutat in afara cadrului:
       exact cazul cardurilor care intra din laterala, taiate de overflow-ul
       parintelui. */
    const layoutPosition = new WeakMap();

    const measureLayout = () => {
      revealTargets.forEach(target => {
        let top = 0;
        let node = target;
        while (node) {
          top += node.offsetTop;
          node = node.offsetParent;
        }
        layoutPosition.set(target, top);
      });
    };

    const pending = new Set(revealTargets);

    const revealReached = () => {
      const viewTop = window.scrollY;
      const viewBottom = viewTop + window.innerHeight;
      // Elementul incepe sa se dezveleasca putin inainte sa atinga limita de
      // jos a ecranului, ca sa fie deja incadrat in momentul in care intra.
      const triggerLine = viewBottom - window.innerHeight * 0.12;
      pending.forEach(target => {
        const top = layoutPosition.get(target);
        if (top === undefined) return;
        // A trecut deja pe sub marginea de sus (ex. scroll restaurat de browser):
        // il arata direct, altfel ar ramane ascuns pentru totdeauna.
        const passed = top + target.offsetHeight <= viewTop;
        const reached = top <= triggerLine;
        if (!passed && !reached) return;
        revealTarget(target);
        pending.delete(target);
      });
    };

    measureLayout();
    revealReached();

    /* Verificarea ruleaza direct in handler, fara requestAnimationFrame:
       rAF este incetinit in filele din fundal, deci un tab deschis la rece
       ar ramane cu continutul ascuns pana la prima interactiune. */
    addEventListener('scroll', revealReached, { passive: true });

    // La redimensionare se schimba layout-ul, deci masuram din nou.
    let resizeTimer = null;
    addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        measureLayout();
        revealReached();
      }, 150);
    }, { passive: true });
  } else {
    revealTargets.forEach(revealTarget);
  }

  /* ------- Per-word stagger on .stagger headlines ------- */
  document.querySelectorAll('.stagger').forEach(h => {
    const text = h.textContent;
    const parts = text.split(/(\s+)/);
    h.textContent = '';
    parts.forEach(p => {
      if (/^\s+$/.test(p)) { h.appendChild(document.createTextNode(p)); return; }
      const w = document.createElement('span');
      w.className = 'word';
      w.textContent = p;
      h.appendChild(w);
    });
    const revealWords = () => {
      const words = h.querySelectorAll('.word');
      words.forEach((w, i) => setTimeout(() => w.classList.add('is-in'), i * 35));
    };
    if (canObserve && !reduced) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (en.isIntersecting) {
            revealWords();
            io.unobserve(h);
          }
        });
      }, { threshold: 0.3 });
      io.observe(h);
    } else {
      revealWords();
    }
  });

  /* ------- Number tally ------- */
  document.querySelectorAll('.tally[data-to]').forEach(el => {
    const target = Number(el.dataset.to);
    const dur = Number(el.dataset.dur || 1800);
    const dec = Number(el.dataset.dec || 0);
    if (!('IntersectionObserver' in window) || reduced) { el.textContent = target.toFixed(dec); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const start = performance.now();
        (function step(now) {
          const t = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = (target * eased).toFixed(dec);
          if (t < 1) requestAnimationFrame(step);
          else el.textContent = target.toFixed(dec);
        })(start);
        io.unobserve(el);
      });
    }, { threshold: 0.4 });
    io.observe(el);
  });

  /* ------- Header shadow on scroll ------- */
  const header = document.querySelector('.header');
  if (header) {
    const onScroll = () => {
      header.classList.toggle('is-scrolled', scrollY > 8);
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------- Mobile nav toggle ------- */
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ------- Mark active nav link omitted (no underline on any link) ------- */

  /* ------- Contact form (front-end only) ------- */
  const form = document.getElementById('contactForm');
  if (form) {
    const status = form.querySelector('.form-status');
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      status.textContent = 'Formularul online nu este conectat și mesajul nu a fost trimis. Scrie-ne la contact@digital-online.ro sau contactează-ne pe WhatsApp.';
    });
  }

  /* ------- Cursor + scroll-driven dynamic CSS ------- */
  const s = document.createElement('style');
  s.textContent = `
    .dsh-cursor {
      position: fixed; top: 0; left: 0;
      width: 36px; height: 36px;
      border: 1px solid #F2EEE5; border-radius: 50%;
      transform: translate(var(--cx,-100px), var(--cy,-100px)) translate(-50%, -50%);
      pointer-events: none; z-index: 9999;
      mix-blend-mode: difference;
      transition: width .25s var(--ease-out, ease), height .25s, border-color .25s;
      will-change: transform;
    }
    .dsh-cursor.is-hover { width: 64px; height: 64px; border-color: #8B3A2E; }
    @media (pointer: coarse) { .dsh-cursor { display: none; } }
    .header.is-scrolled { background: color-mix(in srgb, var(--paper) 92%, transparent); border-bottom-color: rgba(14,13,11,0.12); }
  `;
  document.head.appendChild(s);

  /* ------- SERVICII anchor: land below section head, frame the cards ------- */
  function docTop(el) {
    let y = 0;
    while (el) { y += el.offsetTop; el = el.offsetParent; }
    return y;
  }
  function focusServicii(smooth) {
    const sec = document.getElementById('servicii');
    if (!sec) return false;
    // Derulează puțin mai jos: chenarele (cardurile) încep exact sub subtitlu,
    // iar subtitlul rămâne vizibil imediat sub meniul fix.
    const head = sec.querySelector('.section-head') || sec;
    const header = document.querySelector('.header');
    const headerH = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    const target = Math.max(0, docTop(head) + head.offsetHeight - headerH - 12);
    window.scrollTo({ top: target, behavior: smooth && !reduced ? 'smooth' : 'auto' });
    return true;
  }

  // Same-page clicks on any anchor pointing to #servicii (nav, scroll indicator, mobile nav)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#servicii"]');
    if (!a) return;
    if (!document.getElementById('servicii')) return; // cross-page: let the browser navigate
    e.preventDefault();
    focusServicii(true);
    if (a.getAttribute('href').indexOf('#servicii') !== -1) {
      history.replaceState(null, '', a.getAttribute('href'));
    }
  });

  // Arriving from another page (index.html#servicii) or reloading with the hash:
  // rulează după scroll-ul nativ al browserului (ca la reload cu hash)
  if (location.hash === '#servicii') {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const apply = () => focusServicii(false);
    apply();
    if (document.readyState !== 'complete') {
      addEventListener('load', apply);
    }
    // siguranță: încă o trecere după ce browserul termină anchor scroll-ul nativ
    setTimeout(apply, 120);
  }
})();