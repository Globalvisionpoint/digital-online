/* ============================================================================
   DIGITAL ONLINE — Image sequence scroll animation
   Fundalul hero-ului este o secventa de imagi (40 cadre) derulata de scroll.
   Cadrul afisat este o functie pura a pozitiei de scroll: daca te-ai oprit,
   secventa ramane in cadrul in care ai lasat-o; daca urci inapoi, revine.
   Nimic nu depinde de ceas, la fel ca restul animatiilor de pe site.
   ========================================================================== */
(function () {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.querySelector('.hm-seq');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const FRAMES = 40;
  const NARROW = 860;
  /* Setul pentru ecrane mici are jumatate din latime: pe telefon 1200px
     este mai mult decat suficient, iar dimensiunea conteaza, pentru ca
     fiecare cadru se descarca o singura data. */
  const narrow = window.innerWidth < NARROW;
  const base = window.location.pathname.replace(/[^/]*$/, '');
  const path = base + 'img/seq/' + (narrow ? 'm/' : '');

  /* Punctul de focalizare trebuie sa fie identic cu cel al fundalului vechi
     (background-position: center 40%), altfel prima imagine pictata ar sari
     fata de imaginea de rezerva pusa in CSS. */
  const FOCAL_Y = 0.4;

  const frames = [];
  let drawn = -1;
  let queue = [];
  let running = 0;
  const MAX_PARALLEL = 8;

  function srcFor(i) {
    return path + 'f' + ('00' + i).slice(-3) + '.webp';
  }

  /* Desenare "cover": cadrul umple canvasul si este decupat, exact cum se
     comporta background-size: cover pe fundalul vechi. */
  function draw(img) {
    if (!img || !img.naturalWidth) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return false;
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (w - dw) * 0.5, (h - dh) * FOCAL_Y, dw, dh);
    return true;
  }

  /* Se deseneaza cel mai apropiat cadru descarcat de cel cerut. Daca cadrul
     exact nu e inca gata, se pastreaza ultimul cadru afisat: mai bine o
     imagine stabila decat un cadru lipsa.

     Cadrul cerut si cel desenat sunt tinute separate: daca s-ar marca
     "desenat" inainte de a desena efectiv, un cadru descarcat intarziat nu
     ar mai fi redesenat niciodata, iar canvasul ar ramane gol. */
  function paint(index) {
    if (drawn === index) return;
    let pick = -1;
    for (let i = index; i >= 0; i--) {
      if (frames[i] && frames[i].complete && frames[i].naturalWidth) {
        pick = i;
        break;
      }
    }
    if (pick < 0) return;
    if (pick !== drawn && draw(frames[pick])) drawn = pick;
  }

  /* Progresul secventei: 0 cat timp hero-ul nu a fost derulat, 1 cand hero-ul
     a iesit complet din ecran. Asa se misca fundalul in ritm cu restul
     continutului, care urca si se estompeaza odata cu el.

     Pozitiile se masoara prin offsetTop/offsetHeight, nu prin
     getBoundingClientRect: fundalul are o animatie de drift care ii muta
     permanent cadrul, iar rect-ul transformat ar face ca progresul sa
     oscileze in loc sa depinda doar de scroll. */
  function docTop(el) {
    let top = 0;
    while (el) {
      top += el.offsetTop;
      el = el.offsetParent;
    }
    return top;
  }

  function progress() {
    const hero = canvas.closest('.hero-theme') || canvas;
    const travel = hero.offsetHeight || window.innerHeight;
    const p = (window.scrollY - docTop(hero)) / travel;
    return Math.max(0, Math.min(1, p));
  }

  function frameAt() {
    const p = progress();
    const idx = Math.round(p * (FRAMES - 1));
    return Math.max(0, Math.min(FRAMES - 1, idx));
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      paint(frameAt());
    });
  }

  /* La redimensionare se schimba si dimensiunea canvasului, deci trebuie
     redesenat cadrul curent, chiar daca indicele nu s-a schimbat. */
  function onResize() {
    drawn = -1;
    onScroll();
  }

  function loadFrame(i) {
    if (frames[i]) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = srcFor(i);
    frames[i] = img;
    img.addEventListener('load', () => {
      /* Fiecare cadru nou poate fi cel cerut, deci se redeseneaza. */
      paint(frameAt());
    });
  }

  /* Incarcarea e limitata ca numar de cereri in paralel: 40 de cereri
     dintr-o data ar incetina randarea paginii pe conexiuni lente. */
  function pump() {
    while (running < MAX_PARALLEL && queue.length) {
      const i = queue.shift();
      running++;
      const img = new Image();
      img.decoding = 'async';
      img.src = srcFor(i);
      frames[i] = img;
      const done = () => {
        running--;
        paint(frameAt());
        pump();
      };
      img.addEventListener('load', done);
      img.addEventListener('error', done);
    }
  }

  function start() {
    /* Primul cadru apare imediat: este fundalul vizibil la deschidere. */
    loadFrame(0);
    if (reduced) {
      /* Fara miscare: un singur cadru static, in pozitia de start. */
      paint(0);
      return;
    }
    for (let i = 1; i < FRAMES; i++) queue.push(i);
    pump();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onResize, { passive: true });
    onScroll();
  }

  if (document.readyState === 'complete') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
