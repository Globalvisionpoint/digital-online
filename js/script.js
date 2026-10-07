/* ============================================================================
   DIGITAL ONLINE — Editorial main.js
   No dependencies. IntersectionObserver, custom cursor, scroll-driven motion.
   ============================================================================ */
(function () {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarse = matchMedia('(pointer: coarse)').matches;

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

  /* ------- Scroll reveal ------- */
  const reveals = document.querySelectorAll('[data-reveal]');
  if (reveals.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-revealed'));
  }

  /* ------- Services cards: entrance animation (CSS transitions only) -------
     Specificatii (per index in rand, 0-based):
       Rand 1 (4 carduri):  card 0,1 vin din stanga;  card 2,3 vin din dreapta
       Rand 2 (5 carduri):  card 0,1 vin din stanga;  card 3,4 vin din dreapta;
                            card 2 (mijloc) vine de jos
     Strategie (puzzle pe randuri de cate doua):
       1. La init: setam clasa card-left/card-right/card-bottom conform pozitiei.
       2. IntersectionObserver PER RAND declanseaza .is-visible cand randul intra
          in viewport.
       3. In loc sa apara toate deodata, cardurile primesc transition-delay
          calculat pe "perechi oglinde": (0,n-1) impreuna, apoi (1,n-2) etc.;
          cardul de jos (mijloc la randul 2) vine ultimul.
       4. Dupa declansare facem unobserve - ruleaza o singura data.
     Nota: NU folosim requestAnimationFrame (am avut bug de accelerare la
     schimbarea de tab). Totul se bazeaza pe CSS transitions + clasa. */
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

  if ('IntersectionObserver' in window && !reduced) {
    // Folosim un IntersectionObserver per rand, cu threshold 0 si rootMargin
    // extins mult in jos (50% viewport) — IO ne notifica doar cand randul
    // intra EFECTIV in viewport, NU la prima paint cand e inca sub el.
    // Trigger zone: rect.top <= vh (marginea de sus a atins viewport-ul).
    const cardObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const rect = entry.target.getBoundingClientRect();
        // declansam doar cand marginea de sus a randului a intrat in viewport
        // (nu doar cand e in rootMargin extins)
        if (rect.top >= window.innerHeight) return;
        // Puzzle: perechi oglinde (stanga + dreapta deodata), la ~500ms una dupa alta.
        const cards = Array.from(entry.target.querySelectorAll('.hm-feature'));
        const n = cards.length;
        cards.forEach((card, i) => {
          const pair = Math.min(i, n - 1 - i);
          const delay = pair * 500;
          card.style.transitionDelay = `${delay}ms`;
          card.classList.add('is-visible');
          const content = card.querySelector('.hm-feature-content');
          if (content) content.style.transitionDelay = `${800 + delay}ms`;
        });
        obs.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px 0px 0px' });

    document.querySelectorAll('.hm-services-featured').forEach(row => {
      cardObserver.observe(row);
    });
  } else {
    // Fara IO sau reduced motion: afisam tot instant
    document.querySelectorAll('.hm-services-featured').forEach(row => {
      row.querySelectorAll('.hm-feature').forEach(card => {
        card.classList.add('is-visible');
      });
    });
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
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (en.isIntersecting) {
            const words = h.querySelectorAll('.word');
            words.forEach((w, i) => setTimeout(() => w.classList.add('is-in'), i * 35));
            io.unobserve(h);
          }
        });
      }, { threshold: 0.3 });
      io.observe(h);
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