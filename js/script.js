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

  /* Hero-ul raspunde la scroll: continutul urca si se estompeaza pe masura ce
     iesi din ecran, si revine la loc daca urci inapoi. */
  const heroInner = hero && hero.querySelector('.hm-inner');
  function updateHeroDrift() {
    if (!heroInner) return;
    const height = hero.offsetHeight || innerHeight;
    const drift = Math.max(0, Math.min(1, scrollY / (height * 0.75)));
    hero.style.setProperty('--hero-drift', drift.toFixed(4));
  }

  /* ==========================================================================
     SCROLL-DRIVEN ENTRANCES
     Toate intrarile de pe site sunt antrenate de scroll: JS calculeaza pentru
     fiecare element un grad de avans (0 = neatins, 1 = complet intrat) din
     pozitia lui fata de viewport, iar CSS-ul transforma gradul in miscare.
     Astfel:
       - animatia urmeaza scrollul exact (daca te-ai opri, elementul ramane
         in punctul in care l-ai lasat);
       - urcand inapoi, elementele se retrag;
       - un salt direct la o sectiune nu lasa elemente goale care asteapta.
     Nimic nu depinde de ceas: totul se calculeaza din --fg-progress.
     ========================================================================== */

  /* ---- Directia de intrare a cardurilor de servicii ---- */
  /* Pe desktop cardurile stau in randuri (4 + 5), deci intrarea e cea „de
     puzzle": perechile vin din laterale, iar cardul din mijloc vine de jos.
     Pe mobil cele doua randuri devin o singura coloana, deci toate cele 9
     carduri formeaza o lista verticala: alternare stricta, ca un fermoar. */
  const servicesStacked = matchMedia('(max-width: 600px)');

  function assignServiceDirections() {
    let stackedIndex = 0;
    document.querySelectorAll('.hm-services-featured').forEach(container => {
      const isSecondary = container.classList.contains('hm-services-featured--secondary');
      const cards = container.querySelectorAll('.hm-feature');
      cards.forEach((card, i) => {
        let enter;
        if (servicesStacked.matches) {
          // Coloana unica: alternare stricta pe toate cele 9 carduri,
          // continuata de la primul rand la al doilea.
          enter = (stackedIndex % 2 === 0) ? 'left' : 'right';
        } else if (!isSecondary) {
          // Rand 1 (4 carduri): 0,1 stanga; 2,3 dreapta
          enter = (i < 2) ? 'left' : 'right';
        } else {
          // Rand 2 (5 carduri): 0,1 stanga; 2 jos; 3,4 dreapta
          if (i === 2)      enter = 'bottom';
          else if (i < 2)   enter = 'left';
          else              enter = 'right';
        }
        stackedIndex += 1;
        card.classList.remove('card-left', 'card-right', 'card-bottom');
        card.classList.add(`card-${enter}`);
      });
    });
  }
  assignServiceDirections();
  servicesStacked.addEventListener('change', assignServiceDirections);

  /* ---- Directia de intrare a grilelor pe randuri ---- */
  /* Cardurile dintr-o grila alterneaza dupa ordinea din DOM, care este si
     ordinea vizuala, ca zig-zag-ul sa functioneze la orice numar de coloane. */
  [
    { grid: '.feature-grid', item: '.feature' },
    { grid: '.process-flow', item: '.process-flow__item' },
    { grid: '.process-list', item: '.step-card' }
  ].forEach(({ grid: gridSelector, item: itemSelector }) => {
    document.querySelectorAll(gridSelector).forEach(grid => {
      const cards = Array.from(grid.children).filter(el => el.matches(itemSelector));
      if (!cards.length) return;
      cards.forEach((card, i) => {
        card.classList.add(i % 2 === 0 ? 'enter-left' : 'enter-right');
      });
    });
  });

  /* ---- Sectiunea „DESPRE NOI": opt panouri ---- */
  /* Titlul, lede-ul, apoi pentru fiecare act foto + panoul de sticla, si la
     final cele doua panouri de inchidere. Fiecare se deschide separat, in
     alternanta stricta stanga/dreapta, ca un fermoar pe toata lungimea
     sectiunii.

     Ordinea de mai jos este cea VIZUALA (stanga-dreapta pe fiecare rand), nu
     cea din DOM: in primul act panoul de sticla este peste marginea din
     dreapta a foto, in al doilea peste marginea din stanga. Asa directia
     alterneaza corect pe rand. */
  const aboutBlocks = [
    document.querySelector('.hm-post-title'),
    document.querySelector('.hm-post-lede'),
    ...[...document.querySelectorAll('.hm-act')].flatMap(act => {
      const photo = act.querySelector('.hm-act-photo');
      const body = act.querySelector('.hm-act-body');
      return act.classList.contains('hm-act--right') ? [body, photo] : [photo, body];
    }),
    ...document.querySelectorAll('.hm-post-close > p')
  ].filter(Boolean);

  aboutBlocks.forEach((el, i) => {
    el.classList.add(i % 2 === 0 ? 'enter-left' : 'enter-right');
  });

  /* ---- Elementele care se dezvaluie ---- */
  /* Fiecare bloc de continut de pe site intra in zig-zag: vine din stanga sau
     din dreapta, in functie de pozitia lui in pagina. */
  const revealTargets = new Set(document.querySelectorAll([
    '[data-reveal]',
    '.showcase-figure',
    '.feature-grid > .feature',
    '.hm-services-featured > .hm-feature',
    '.process-flow > .process-flow__item',
    '.process-list > .step-card',
    '.cp-media',
    '.contact-form',
    '.legal-block',
    '.legal-content > .eyebrow',
    '.legal-content > h1',
    '.footer-row',
    '.footer-contact'
  ].join(',')));

  /* Panoul de contact e impartit in doua: partea cu foto si formularul.
     Panoul ramane doar rama in care se strange cele doua jumatati. */
  document.querySelectorAll('.contact-panel').forEach(panel => {
    panel.classList.remove('fg-animated', 'fg-from-right', 'is-revealed', 'is-visible');
    revealTargets.delete(panel);
  });

  /* Titlul si subtitlul fiecarei sectiuni intra separat: titlul din stanga,
     subtitlul din dreapta — la fel ca in sectiunea „Despre noi". Containerul
     .section-head ramane doar un suport, el nu se animeaza. */
  const sectionHeads = [];
  document.querySelectorAll('.section-head').forEach(head => {
    const title = head.querySelector('h2, h1');
    const sub = head.querySelector('p');
    if (title) { sectionHeads.push(title); revealTargets.delete(head); }
    if (sub) { sectionHeads.push(sub); revealTargets.delete(head); }
  });
  sectionHeads.forEach(el => revealTargets.add(el));

  /* Toate elementele antrenate de scroll primesc aceeasi clasa, ca sa aiba
     aceeasi stare initiala si sa fie tratate identic de motor. */
  revealTargets.forEach(target => target.classList.add('fg-animated'));

  /* ---- Directia laterala pentru blocurile care nu sunt carduri ---- */
  /* Titlul vine din stanga, subtitlul din dreapta; la fel blocurile legale si
     cele doua coloane de subsol, care alterneaza pe rand. */
  document.querySelectorAll('.section-head').forEach(head => {
    const title = head.querySelector('h2, h1');
    const sub = head.querySelector('p');
    if (title) title.classList.add('fg-from-left');
    if (sub) sub.classList.add('fg-from-right');
  });
  document.querySelectorAll('.legal-content').forEach(content => {
    const items = [...content.querySelectorAll(':scope > .eyebrow, :scope > h1, :scope > .legal-block')];
    items.forEach((el, i) => el.classList.add(i % 2 === 0 ? 'fg-from-left' : 'fg-from-right'));
  });
  document.querySelectorAll('.footer-row').forEach(el => el.classList.add('fg-from-left'));
  document.querySelectorAll('.footer-contact').forEach(el => el.classList.add('fg-from-right'));
  document.querySelectorAll('.showcase-figure').forEach(el => el.classList.add('fg-from-left'));
  /* Panoul de contact se strange in doua: jumatatea cu foto vine din stanga,
     formularul din dreapta. */
  document.querySelectorAll('.cp-media').forEach(el => el.classList.add('fg-from-left'));
  document.querySelectorAll('.contact-form').forEach(el => el.classList.add('fg-from-right'));

  /* ---- Motorul comun ---- */
  /* Fiecare element primeste: tipul deplasarii (card = lateral, bloc = sus),
     distanta de scroll pe care se desfasoara intrarea si un prag de
     intarziere, ca elementele apropiate sa se deschida pe rand. */
  const scrollDriven = [];
  const layoutPosition = new WeakMap();
  const pinned = new Set();

  const TRAVEL = {
    card: () => Math.max(window.innerHeight * 0.32, 220),
    block: () => Math.max(window.innerHeight * 0.22, 160)
  };

  function register(el, kind, offset) {
    if (!el) return;
    scrollDriven.push({ el, kind, offset: offset || 0, last: -1 });
  }

  /* Elementele cu intrare laterala se misca pe orizontala; restul urca. */
  const isCard = target => target.matches(
    '.hm-feature, .feature-grid > .feature, .process-flow > .process-flow__item, .process-list > .step-card, ' +
    '.section-head > h2, .section-head > h1, .section-head > p, .legal-block, ' +
    '.legal-content > .eyebrow, .legal-content > h1, .footer-row, .footer-contact, ' +
    '.showcase-figure, .cp-media, .contact-form'
  );

  revealTargets.forEach(target => {
    register(target, isCard(target) ? 'card' : 'block', 0);
  });

  // Panourile sectiunii „Despre noi" sunt apropriate, deci fiecare incepe putin
  // mai tarziu decat precedentul — ca un fermoar.
  aboutBlocks.forEach((el, i) => {
    register(el, 'card', i * 26);
  });

  function measureLayout() {
    const all = new Set([...revealTargets, ...aboutBlocks]);
    all.forEach(target => {
      let top = 0;
      let node = target;
      while (node) {
        top += node.offsetTop;
        node = node.offsetParent;
      }
      layoutPosition.set(target, top);
    });
  }

  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

  function updateScrollDriven() {
    const viewTop = window.scrollY;
    const viewBottom = viewTop + window.innerHeight;
    // Elementul incepe sa se dezveleasca putin inainte sa atinga limita de
    // jos a ecranului, ca sa fie deja incadrat in momentul in care intra.
    const triggerLine = viewBottom - window.innerHeight * 0.12;

    scrollDriven.forEach(item => {
      const { el, offset } = item;
      if (pinned.has(el)) return;
      const top = layoutPosition.get(el);
      if (top === undefined) return;
      const travel = TRAVEL[item.kind]();
      let progress = (triggerLine - top - offset) / travel;
      // Elementul a trecut deja de marginea de sus a ecranului: e oricum
      // trecut, deci trebuie sa fie la locul lui final.
      if (top + el.offsetHeight <= viewTop) progress = 1;
      // Subsolul e ultimul element al paginii: nu mai poate cobori, deci
      // calatoria lui nu se poate termina. Cand e deja intreg pe ecran, e
      // considerat complet intrat.
      const atPageEnd = viewBottom >= document.documentElement.scrollHeight - 2;
      if (atPageEnd && top + el.offsetHeight <= viewBottom && top >= viewTop) progress = 1;
      progress = Math.max(0, Math.min(1, progress));
      const eased = easeOutCubic(progress);
      if (item.last === eased) return;
      item.last = eased;
      el.style.setProperty('--fg-progress', eased.toFixed(4));
      // Clasele de repaus se pun doar cand elementul e complet intrat, ca
      // hover-ul sa se aplice pe cardurile deja asezate.
      el.classList.toggle('is-visible', progress >= 1);
      el.classList.toggle('is-revealed', progress >= 1);
    });

    updateHeroDrift();
  }

  if (!reduced) {
    measureLayout();
    updateScrollDriven();
    updateHeroDrift();

    /* Verificarea ruleaza direct in handler, fara requestAnimationFrame:
       rAF este incetinit in filele din fundal, deci un tab deschis la rece
       ar ramane cu continutul ascuns pana la prima interactiune. */
    addEventListener('scroll', updateScrollDriven, { passive: true });

    // La redimensionare se schimba layout-ul, deci masuram din nou.
    let resizeTimer = null;
    addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        measureLayout();
        updateScrollDriven();
        updateHeroDrift();
      }, 150);
    }, { passive: true });
  } else {
    // Fara animatie: totul trebuie sa fie vizibil.
    if (hero) hero.style.setProperty('--hero-drift', '0');
    const show = el => {
      el.style.setProperty('--fg-progress', '1');
      el.classList.add('is-visible', 'is-revealed');
    };
    revealTargets.forEach(show);
    aboutBlocks.forEach(show);
  }

  /* ---- Focus cu tastatura ---- */
  /* Elementele ascunse raman in ordinea de tabulare, deci la focus trebuie
     dezvelite imediat — si raman dezvelite cat timp au focusul. */
  document.addEventListener('focusin', event => {
    let target = event.target;
    while (target && target !== document.body) {
      if (revealTargets.has(target) || aboutBlocks.includes(target)) {
        pinned.add(target);
        target.style.setProperty('--fg-progress', '1');
        target.classList.add('is-visible', 'is-revealed');
      }
      target = target.parentElement;
    }
  });

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
