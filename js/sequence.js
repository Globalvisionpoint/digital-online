/* ============================================================================
   DIGITAL ONLINE — Image sequence scroll animation
   Fundalul hero-ului este secventa video de 240 de cadre, derulata de scroll.
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

  const FRAMES = 230;
  const NARROW = 860;
  const FRAME_VERSION = 'video-230-start-10';
  const scriptUrl = document.currentScript.src;
  let narrow = window.innerWidth < NARROW;
  let path = sequencePath();

  /* Punctul de focalizare trebuie sa fie identic cu cel al fundalului vechi
     (background-position: center 40%), altfel prima imagine pictata ar sari
     fata de imaginea de rezerva pusa in CSS. */
  const FOCAL_Y = 0.4;

  const frames = new Map();
  let drawn = -1;
  let queue = [];
  let running = 0;
  let generation = 0;
  let lastScrollY = window.scrollY;
  let direction = 1;
  const MAX_PARALLEL = 6;
  const PREFETCH_AHEAD = 12;
  const CACHE_RADIUS = 16;

  function srcFor(i) {
    return path + 'f' + ('00' + i).slice(-3) + '.webp?v=' + FRAME_VERSION;
  }

  function sequencePath() {
    return new URL('../img/seq/' + (narrow ? 'm/' : ''), scriptUrl).href;
  }

  function frameDistance(a, b) {
    return Math.abs(a - b);
  }

  /* Desenare "cover": cadrul umple canvasul si este decupat, exact cum se
     comporta background-size: cover pe fundalul vechi. */
  function draw(img, alpha, w, h) {
    if (!img || !img.naturalWidth || alpha <= 0) return;
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (w - dw) * 0.5, (h - dh) * FOCAL_Y, dw, dh);
  }

  /* Interpolarea cu transparenta intre cadrele vecine atenueaza salturile
     vizibile ale secventei, mentinand progresul sincronizat cu scrollul. */
  function paint(index) {
    if (drawn === index) return;
    const first = Math.floor(index);
    const second = Math.min(first + 1, FRAMES - 1);
    const blend = index - first;
    const firstEntry = frames.get(first);
    const secondEntry = frames.get(second);
    const firstFrame = firstEntry?.loaded ? firstEntry.image : null;
    const secondFrame = secondEntry?.loaded ? secondEntry.image : null;
    if (!firstFrame && !secondFrame) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    if (firstFrame && secondFrame) {
      draw(firstFrame, 1 - blend, w, h);
      draw(secondFrame, blend, w, h);
    } else {
      draw(firstFrame || secondFrame, 1, w, h);
    }
    ctx.globalAlpha = 1;
    drawn = index;
  }

  /* Clipul parcurge o singura data pagina, evitand saltul dintre ultimul si
     primul cadru, care nu sunt o bucla continua in materialul sursa.

     Ritmul este constant per pixel derulat, ca fundalul sa se miste in ritm
     constant, indiferent cat de lunga e pagina. */
  function totalScroll() {
    const doc = document.documentElement;
    return Math.max(1, (doc.scrollHeight || doc.offsetHeight) - window.innerHeight);
  }

  function frameAt() {
    const progress = Math.min(1, Math.max(0, window.scrollY / totalScroll()));
    const initialLead = 0.03 * (1 - progress) * (1 - Math.exp(-progress / 0.01));
    return Math.min(1, progress + initialLead) * (FRAMES - 1);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const scrollY = window.scrollY;
      direction = scrollY >= lastScrollY ? 1 : -1;
      lastScrollY = scrollY;
      const index = frameAt();
      paint(index);
      requestNear(index);
    });
  }

  /* La redimensionare se schimba si dimensiunea canvasului, deci trebuie
     redesenat cadrul curent, chiar daca indicele nu s-a schimbat. */
  function onResize() {
    drawn = -1;
    const nextNarrow = window.innerWidth < NARROW;
    if (nextNarrow !== narrow) {
      narrow = nextNarrow;
      path = sequencePath();
      generation++;
      frames.clear();
      queue = [];
      requestNear(frameAt());
      return;
    }
    paint(frameAt());
  }

  function requestFrame(index, priority = false) {
    const i = Math.min(FRAMES - 1, Math.max(0, index));
    const existing = frames.get(i);
    if (existing) {
      if (priority && !existing.loading && !existing.loaded) {
        const queuedAt = queue.indexOf(i);
        if (queuedAt > 0) queue.splice(queuedAt, 1);
        if (queuedAt >= 0) queue.unshift(i);
      }
      return;
    }
    frames.set(i, { image: null, loaded: false, loading: false });
    if (priority) queue.unshift(i);
    else queue.push(i);
  }

  function requestNear(index) {
    const first = Math.floor(index);
    requestFrame(Math.min(first + 1, FRAMES - 1));
    requestFrame(first, true);
    for (let offset = 1; offset <= PREFETCH_AHEAD; offset++) {
      requestFrame(first + direction * offset);
    }
    for (let offset = 1; offset <= 4; offset++) {
      requestFrame(first - direction * offset);
    }
    for (const [frame, entry] of frames) {
      if (!entry.loading && frameDistance(frame, first) > CACHE_RADIUS) {
        frames.delete(frame);
      }
    }
    queue = queue.filter(frame => frames.has(frame));
    pump();
  }

  /* Incarcarea ramane limitata si prioritizeaza cadrul cerut de scroll; incarcarea
     dintr-o data ar incetina randarea paginii pe conexiuni lente. */
  function pump() {
    while (running < MAX_PARALLEL && queue.length) {
      const i = queue.shift();
      const entry = frames.get(i);
      if (!entry || entry.loading || entry.loaded) continue;
      const requestGeneration = generation;
      const img = new Image();
      img.decoding = 'async';
      entry.image = img;
      entry.loading = true;
      running++;
      const done = () => {
        running--;
        entry.loading = false;
        if (requestGeneration === generation && frames.get(i) === entry) {
          if (img.naturalWidth) {
            entry.loaded = true;
            const target = reduced ? 0 : frameAt();
            if (reduced || frameDistance(i, Math.floor(target)) <= CACHE_RADIUS) {
              drawn = -1;
              paint(target);
            } else {
              frames.delete(i);
            }
          } else {
            frames.delete(i);
            console.error('Failed to load scroll animation frame:', img.src);
          }
        }
        pump();
      };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      img.src = srcFor(i);
    }
  }

  function start() {
    if (reduced) {
      requestFrame(0, true);
      pump();
      paint(0);
      return;
    }
    requestNear(frameAt());
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onResize, { passive: true });
  }

  if (document.readyState === 'complete') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
