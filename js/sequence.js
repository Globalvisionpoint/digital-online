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
  const path = new URL('../img/seq/' + (narrow ? 'm/' : ''), document.currentScript.src).href;

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
    const second = (first + 1) % FRAMES;
    const blend = index - first;
    const firstFrame = frames[first]?.complete && frames[first].naturalWidth ? frames[first] : null;
    const secondFrame = frames[second]?.complete && frames[second].naturalWidth ? frames[second] : null;
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
    if (firstFrame) draw(firstFrame, 1, w, h);
    if (secondFrame) draw(secondFrame, firstFrame ? blend : 1, w, h);
    ctx.globalAlpha = 1;
    drawn = index;
  }

  /* Progresul secventei pe document: 0 la inceputul paginii, 1 la final.
     Fundalul evolueaza pe toata lungimea paginii, pana la footer, si se
     repeta in bucla: secventa este un loop perfect, deci cadrul 39 se
     continua lin cu cadrul 0.

     Ritmul este constant per pixel derulat, ca fundalul sa se miste in ritm
     constant, indiferent cat de lunga e pagina. */
  function totalScroll() {
    const doc = document.documentElement;
    return Math.max(1, (doc.scrollHeight || doc.offsetHeight) - window.innerHeight);
  }

  /* Numarul de bucle se potriveste cu lungimea paginii: o pagina scurta
     are o singura bucla, una lunga are mai multe, dar fiecare bucla are
     aproximativ aceeasi lungime in pixeli. */
  function loops() {
    const travel = totalScroll();
    return Math.max(1, Math.min(6, Math.round(travel / 1800)));
  }

  function frameAt() {
    const p = window.scrollY / totalScroll();
    const idx = p * FRAMES * loops();
    return ((idx % FRAMES) + FRAMES) % FRAMES;
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
      drawn = -1;
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
        drawn = -1;
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
