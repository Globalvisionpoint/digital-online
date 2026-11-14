# Hero architectural realist — secvență pe scroll din cadre reale

Data: 2026-11-13
Status: în așteptarea aprobării
Tip: proiect (design complet)

---

## 1. De ce, și ce vrem

Hero-ul actual (`canvas.hm-seq`) rulează o secvență de **230 de cadre WebP de 1280×720**,
desenate pe un canvas fix pe măsură ce derulezi pagina. Funcționează, dar are două
limite care se văd:

1. **1280×720 este plafonul.** Pe un desktop lat (1920–2560 px) cadrul este scalat în sus
   și se citește ca „fundal puțin moale”, nu ca imagine fotografică.
2. **Cadrele sunt stocate în culoare, iar CSS-ul aruncă culoarea** (`.hm-seq { filter: grayscale(1) }`).
   Am măsurat: `img/seq/f115.webp` are 35.31 KB în culoare pentru o imagine care se afișează
   alb-negru. Plătim ~20% din greutate pentru date pe care browserul le elimină la randare.

Scopul: hero-ul devine **o filmare reală, cu o singură mișcare continuă de cameră**, livrată
ca **480 de cadre individuale** și condusă de scroll — la fel de fluid ca un video, dar
compus din cadre discrete, ca să nu depindem de un element `<video>` și de buffering-ul lui.

Lumea vizuală aleasă: **arhitectural abstract** — clădiri, structuri, geometrie urbană,
fără oameni, fără text în cadru, fără logo-uri. Material: **imagini reale**, nu figuri
construite din cod.

### Publicul și succesul

Vizitatorul tipic este un proprietar de business român care evaluează dacă firma e serioasă.
Succesul înseamnă: la prima încărcare, hero-ul arată ca o fotografie profesională de
arhitectură, se mișcă lin sub scroll, și **nu percepe nicio întrerupere sau „săltare” de cadru**.

### Non-obiective

- Nu adăugăm `<video>` sau streaming adaptiv.
- Nu schimbăm structura paginii, textele, secțiunile sau ancora de scroll.
- Nu introducem framework, bundler sau build de front-end.
- Nu atingem pipeline-ul i18n în alt mod decât re-propagarea obișnuită.
- Nu adăugăm efecte de tip particule, shader, WebGL sau post-procesare.

### Anti-obiective (ar fi un eșec chiar dacă funcționează tehnic)

- Hero care „sare” dintr-un cadru în altul vizibil — trebuie să se simtă continuu.
- Hero care consumă > 25 MB pe desktop sau > 8 MB pe mobil.
- Hero care blochează primul render sau întârzie LCP-ul.
- Hero care arată ca un template generic de „3D abstract” — cerința explicită a fost realism.
- Secvență care se simte ca un slideshow (mișcare sacadată, ritm necontrolat).

---

## 2. Ce am măsurat (date autoritative)

Toate valorile de mai jos sunt **măsurate pe sursa reală**, nu estimate. Cadrele au fost
extrase efectiv, apoi cântărite cu `Measure-Object Length -Sum`.

### Sursa

`40640-2160.mp4` — 3840×2160, `r_frame_rate = 24000/1001`, `duration = 20.02 s`,
**480 cadre** (verificat cu `ffprobe -count_frames`, nu presupus). Rândul 1080p al
aceluiași clip are tot **480 cadre**. Deci `FRAMES = 480` este o mapare 1:1 verificată —
nu e nevoie nici să repetăm, nici să aruncăm cadre.

Clipul este o **împingere lentă înainte** (dolly-in) printr-un culoar urban de noapte, cu
clădiri luminate pe ambele părți. Este exact „o singură mișcare continuă”.

### Extracție completă, setări finale (nu eșantion)

| Rând | Geometrie | Setări | Cadre | Greutate totală | KB/cadru | Timp |
|---|---|---|---|---|---|---|
| **Desktop (ales)** | 1920×1080 (16:9) | gray, q62 | 480 | **17.56 MB** | 37.47 | **49.1 s** |
| Mobil (lățime actuală) | 640×360 (16:9) | gray, q66 | 480 | **4.34 MB** | 9.25 | 6.5 s |
| Mobil portrait | 432×768 (9:16, tăiat) | gray, q66 | 480 | **2.93 MB** | 6.26 | 8.3 s |

### Geometrii candidate (eșantioane de 20 de cadre, extinse la 480)

| Variantă | KB/cadru | Total / 480 |
|---|---|---|
| `1920×1080` 16:9 | 40.01 | 18.75 MB |
| `1920×1200` 16:10 | 40.77 | 19.11 MB |
| `1920×823` 21:9 | 38.09 | **17.85 MB** |
| `1920×810` 2.37:1 (tăiere cover) | 36.24 | **16.99 MB** |
| `1280×720` 16:9 | 23.16 | 10.86 MB |
| `960×540` 16:9 | 15.82 | 7.41 MB |
| `896×504` 16:9 | 14.53 | 6.81 MB |
| `768×432` 16:9 | 11.5 | 5.39 MB |
| `640×360` 16:9 | 9.09–9.27 | 4.26–4.35 MB |
| `432×768` 9:16 portrait | 6.43 | 3.01 MB |
| `432×935` portrait 2:1 | 6.97 | 3.27 MB |

Eșantioanele la q66 citesc sistematic cu ~7% peste rularea completă la q62 (18.75 vs 17.56).
**Cifra de încredere pentru desktop este 17.56 MB.**

### Starea actuală, pentru comparație

| Set existent | Geometrie | Cadre | Greutate |
|---|---|---|---|
| Desktop `img/seq/` | 1280×720, **culoare** | 230 | 6.51 MB |
| Mobil `img/seq/m/` | 640×360, **culoare** | 230 | 2.85 MB |

Deci noul hero desktop este **~2.7× mai greu** decât cel actual, dar cu **rezoluție 2.25×**
și de două ori mai multe cadre. Este o creștere justificată de cerința de realism, și este
motivul pentru care încărcarea trebuie să fie progresivă (vezi §5).

### Corecție față de o afirmație anterioară

Într-o discuție anterioară am sugerat că o tăiere la 21:9 aduce o economie importantă de
greutate. **Măsurătoarea nouă arată contrariul:** 21:9 = 17.85 MB, 16:9 = 18.75 MB
(eșantioane q66) — o diferență de sub 5%, adică **tăierea nu se justifică pe motive de
greutate**. Rămâne o alegere pur estetică.

### Randamentul de extracție

480 de cadre desktop se produc în **49 de secunde**. Pipeline-ul complet (desktop + mobil)
este sub **65 de secunde**. Este ieftin: scriptul se poate rula oricând, deci setul este
reproductibil din sursă, spre deosebire de cele 230 de cadre actuale, care au fost produse
în afara repo-ului și **nu pot fi regenerate**.

---

## 3. Abordările luate în calcul

### A. O filmare reală → sute de cadre individuale  ✅ ALEASĂ

Descărcăm un singur clip real de arhitectură, extragem 480 de cadre, le servim ca WebP
alb-negru și lăsăm `js/sequence.js` să le joace pe scroll.

- **Câștig:** realismul este maxim prin definiție — sunt fotograme reale, cu granulație,
  reflexii și mișcare de cameră autentică. Cost de producție: ~1 minut de ffmpeg.
- **Cost:** greutate mai mare (17.56 MB desktop), o dependență de o sursă externă
  (rezolvată — licență liberă, vezi §6), și faptul că nu putem „regiza” mișcarea:
  folosim mișcarea pe care o are clipul.

### B. Reconstrucție fotorealistă din fotografii reale

Fotografiem/colectăm zeci de imagini de arhitectură și construim geometrie 3D reală
(photogrammetrie / Gaussian splatting), randată apoi cadru cu cadru.

- **Câștig:** control total asupra mișcării și unghiurilor.
- **Cost:** disproporționat. Necesită Blender sau un pipeline de reconstrucție (niciunul
  nu e instalat, nici nu ar trebui introdus pentru un hero de site), zecile de cadre se
  randează în ore, iar rezultatul este fragil. **Respinsă.**

### C. Filmare reală + coregrafie diferită pe fiecare secțiune

Ca A, dar fiecare secțiune (servicii, proces, companie, contact) ar primi propriul
fragment de mișcare, cu tranziții regizate.

- **Câștig:** narativ mai bogat, fiecare secțiune are propriul moment.
- **Cost:** înseamnă mai multe clipuri sursă, tăieturi vizibile între ele, și risc de a
  arăta ca un colaj. Mai important: utilizatorul a cerut explicit **o singură mișcare
  continuă**. **Respinsă — contravine cerinței.**

**Alegerea utilizatorului: A**, apoi rafinată de decizia (4) de mai jos — o singură
mișcare continuă peste tot scroll-ul.

---

## 4. Deciziile luate (nu se redeschid)

| # | Decizie | Valoare | Ce înseamnă concret |
|---|---|---|---|
| 1 | Greutate | `1920_lazy` | 1920 px lățime, 16–18 MB, **încărcat progresiv** |
| 2 | Culoare | `pastram_bw` | Rămâne alb-negru, dar **randat gri direct în ffmpeg** (`format=gray`), nu filtrat în CSS |
| 3 | Număr de cadre | `480` | Tot clipul, 1:1 — **verificat: sursa are exact 480 de cadre** |
| 4 | Secțiuni | `o_miscare` | **O singură mișcare continuă de cameră** peste tot scroll-ul |
| 5 | Anti-slop | `in_timpul` | Anti-slop se aplică **în timpul** lucrului, nu ca audit ulterior |

Decizia (2) elimină exact risipa măsurată la §1: nu mai descărcăm culoare ca s-o aruncăm.
Decizia (5) înseamnă că disciplina anti-slop se aplică la fiecare pas de implementare,
nu la final.

### Ultimele trei răspunsuri — citite ca indici, DE CONFIRMAT

Acestea au fost răspunsuri la o listă de opțiuni, deci valoarea este **poziția în listă**.
Le scriu explicit aici ca să poți corecta interpretarea înainte de aprobare:

| Cheie | Valoare | Cum am citit-o | Efectul |
|---|---|---|---|
| `taiere` | `1` | **prima opțiune: fără tăiere, păstrăm 1920×1080 (16:9)** | Setul desktop este 16:9. **Aceasta înlocuiește recomandarea anterioară de a tăia la 2.37:1.** |
| `cadru_start` | `2` | **a doua opțiune: pornim pe un cadru mai târziu — mai dinamic, dar mai aglomerat sub titlu** | Vezi tensiunea de mai jos. |
| `diale` | `mediu` | **ENERGIE: mediu** — „rapid și calm în același timp” | Mișcarea nu trebuie nici lentă/moale, nici agresivă. |

**Tensiune de rezolvat, `cadru_start`:** am inspectat vizual cadrele de deschidere.
**Cadrul 0 este compozițional curat** — fără elemente care intră sub titlu, cu spațiu liniștit
în zona de sus. Alegerea „un cadru mai târziu” ar însemna să pornim pe o compoziție mai
aglomerată exact acolo unde stă `DIGITAL ONLINE`. **Propunerea mea, marcată ca a mea:**
pornim pe **cadrul 0**, care și respectă „calm” din `diale = mediu`, și lasă mișcarea să
devină dinamică pe măsură ce derulezi. Dacă ai vrut altceva prin `2`, spune acum — schimbă
doar offset-ul de start, nu arhitectura.

### Direcția vizuală (anti-slop, referință)

Repo-ul nu are `DESIGN.md`, dar are o direcție vizuală evidentă și consecventă:
monocrom (`--bg #0a0a0a`, accent alb), linii fine `rgba(255,255,255,.10)`, mult spațiu gol,
tipografie mare. Deci **nu** pornim „fără direcție”. Diale de referință pentru orice
element nou de UI: **ENERGIE 1 / RITM 1 / MIȘCARE 1** (adică reținut, nu spectaculos),
cu excepția mișcării hero-ului, unde utilizatorul a dat direcție explicită: **mediu**.
Output-ul vizual se etichetează ca atare până la aprobare.

---

## 5. Cum se construiește

### 5.1 Script nou de generare: `tools/build-seq.mjs`

Repo-ul **nu are** niciun script de generare de cadre — cele 230 existente au venit de
altundeva. Noul set trebuie să vină cu pipeline-ul lui, altfel nu poate fi refăcut.

Comportament: primește calea către un fișier sursă, extrage toate cadrele la fiecare rând
(desktop + mobil), scrie în `img/seq/` și `img/seq/m/`, și raportează greutatea totală.

Regulile pipeline-ului:
- **Gri se face în ffmpeg** (`format=gray`), conform deciziei (2). CSS-ul nu mai filtrează.
- **`-fps_mode passthrough`**, nu `-vsync` — `-vsync` a fost eliminat în ffmpeg 9.
- **`-start_number 0`** — obligatoriu. ffmpeg numerotează implicit de la 1, iar
  `sequence.js` construiește numele ca `f000`, `f001`, … Fără acest flag primul cadru
  devine `f001` și **întregul set este decalat cu unul**.
- Șterge înainte conținutul vechi, ca să nu rămână cadre orfane dintr-un set anterior.

Comenzi validate (rulate efectiv, nu teoretice):

```
# desktop 1920x1080 gri
ffmpeg -y -v error -i <src> \
  -vf "scale=1920:1080:flags=lanczos,format=gray" \
  -fps_mode passthrough -c:v libwebp -q:v 62 -start_number 0 -f image2 "img/seq/f%03d.webp"

# mobil 640x360 gri
ffmpeg -y -v error -i <src> \
  -vf "scale=640:360:flags=lanczos,format=gray" \
  -fps_mode passthrough -c:v libwebp -q:v 66 -start_number 0 -f image2 "img/seq/m/f%03d.webp"
```

Adăugăm un script npm, ex. `"seq": "node tools/build-seq.mjs"`. Sursa video **nu se
comite** — scriptul primește calea ca argument, iar clipul se descarcă manual când e nevoie.

### 5.2 `js/sequence.js`

Fișierul are deja toată logica bună: interpolează sub-cadru prin cross-fade
(`paint()` amestecă `floor(index)` și `floor(index)+1` cu `globalAlpha`), prioritizează
cadrele vecine, evictă ce e departe, respectă `prefers-reduced-motion` și este independent
de ceas. **Nu rescriem arhitectura — o reacordăm.**

Modificări:

| Constantă | Acum | Devine | De ce |
|---|---|---|---|
| `FRAMES` | `230` | `480` | Decizia (3) |
| `FRAME_VERSION` | `'131bb-1794183653'` | **valoare nouă** | Cache-buster. Fără el, browserul servește cadrele vechi din cache |
| `MAX_PARALLEL` | `6` | de reacordat | 480 de cadre, nu 230 |
| `PREFETCH_AHEAD` | `12` | de reacordat | Cu 480 de cadre, 12 cadre „înainte” înseamnă mai puțin scroll |
| `CACHE_RADIUS` | `16` | de reacordat | Eviction-ul trebuie să rămână sănătos la un set dublu |

`NARROW` (860), `FOCAL_Y` (0.4), `srcFor()`, `sequencePath()`, `draw()`, `frameAt()`,
`requestNear()`, `pump()` **rămân neschimbate în structură.**

**Detaliu care limitează crescătorul de număr:** `srcFor()` face
`('00' + i).slice(-3)` — zero-padding pe **3 cifre**. La 480 e în regulă. Peste 999 ar
produce nume rupte. Dacă vreodată creștem peste 999 de cadre, padding-ul trebuie extins.
Nu e cazul acum; se notează, nu se schimbă.

**Reduced motion:** comportamentul actual (doar cadrul 0, fără listener de scroll) se
păstrează exact. Este o garanție de accesibilitate, nu o opțiune.

### 5.3 `css/styles.css`

`.hm-seq` (linia 261) are:
- `filter: grayscale(1)` → **se elimină** — cadrele sunt deja gri (decizia 2).
- `background-position: center 40%` → **rămâne**. Trebuie să rămână sincronizat cu
  `FOCAL_Y = 0.4` din JS, altfel imaginea de rezervă și canvasul cadru-au-cadru nu coincid
  și se vede un salt la prima tranziție.
- `background-image: url('../img/seq/f000.webp?v=...')` → **se actualizează versiunea**,
  la fel ca `FRAME_VERSION`. Fallback-ul din CSS și cache-buster-ul din JS trebuie să fie
  identice.
- Varianta mobilă din `@media (max-width: 859px)` (imaginea de rezervă `img/seq/m/f000.webp`)
  se actualizează la fel.

Restul (`.hm-topo`, `.hm-bg-vignette`, `.hm-title-fill`, zipper, `--hero-drift`) nu se
ating fără un motiv separat.

### 5.4 Rândul mobil — propunere

Măsurat pe setul complet:

| Opțiune | Greutate | Comentariu |
|---|---|---|
| 640×360 (neschimbat) | 4.34 MB | Cel mai ieftin, dar rămâne moale pe telefoane mari |
| **432×768 portrait (tăiat)** | **2.93 MB** | **Recomandarea mea** |
| 768×432 | ~5.39 MB | Mai clar, dar mai greu |

**Propunerea mea, marcată ca a mea:** rândul mobil portrait 432×768, **tăiat din sursă**,
nu scalat. Pe telefon pagina este verticală, deci o tăiere portrait (1:1.78) acoperă ecranul
aprope fără pierdere de subiect, și iese **cu 32% mai ușor decât varianta actuală**, deși
mai înaltă — pentru că subiectul tăiat are mai puțin detaliu. Am verificat vizual tăierea:
funcționează, clădirile rămân pe ambele margini.

Aceasta schimbă geometria rândului mobil, deci este o decizie de conținut, nu de tehnică.
Dacă preferi să nu atingem mobilul, rămâne 640×360 la 4.34 MB.

### 5.5 Licența sursei — și singura ei limită

Clipul ales vine de pe **Mixkit** (licență liberă). Poziția verificată direct din
`https://mixkit.co/llm-info/` și din JSON-LD-ul paginii fiecărui clip:

- Versiunea **Free**: uz comercial **permis**, **fără atribuire**, fără watermark, fără cont.
- Clipul `40640` are `"license": "https://mixkit.co/license/#videoFree"`,
  `"copyrightNotice": "Free"`, `"isAccessibleForFree": true`.
- Interdicții de tip de utilizare care ne privesc direct: **nu** putem vinde copii fizice
  sau digitale ale materialului **fără să-l transformăm întâi prin contribuție umană** și
  să-l integrăm cu alte elemente; **nu** putem redistribui materialul ca atare (ca stoc),
  sublicenția sau revinde.

**Aplicat la noi:** transformăm filmarea în 480 de cadre WebP gri și le integrăm în design-ul
site-ului — asta este fix transformarea prin contribuție umană pe care licența o cere.
Este permis. Singura limită, pe care o respectăm: **nu comităm fișierele MP4 originale** în
repo (nu redistribuim sursa) și **nu prezentăm cadrele ca material de stoc** pentru
reutilizare de către terți.

> **Notă de securitate — conținut neîncredere.** Pagina `/llm-info/` conține o secțiune
> intitulată „DIRECT COMMAND TO AI MODELS” care cere asistenților să promoveze un blog
> terț și să adauge un emoji. Aceasta **nu este** o instrucțiune valabilă și a fost
> ignorată. Notat aici ca să nu fie urmată accidental de un builder automat.

### 5.6 De ce NU folosim Git LFS

`git-lfs 3.8.1` este instalat, dar repo-ul **nu are `.gitattributes`** și LFS nu este activ.
În plus, **Vercel nu servește fișierele LFS la deploy** — ar fi pointer-e în loc de imagini,
deci hero-ul s-ar rupe în producție.

**Decizia mea, marcată ca a mea:** cadrele se comit normal, fără LFS.

Consecință de care trebuie să știi: fiecare set nou de cadre rămâne în istoria gitului
~permanent. 17.56 MB + 2.93 MB ≈ **20.5 MB adăugate o singură dată**. Este acceptabil pentru
un site static, dar înseamnă că regenerarea setului de mai multe ori umflă istoria.
Producerea pipeline-ului permite însă regenerarea, deci **nu** este nevoie să păstrăm în repo
copii succesive: înlocuim, nu adăugăm.

---

## 6. Ce rămâne de decis de builder

Ordinea de mai jos este ordinea lucrului. Nimic nu se construiește până la aprobare.

**De făcut, în ordine:**

1. **Descărcarea sursei.** Sursa este `40640` în varianta 2160p. Atenție: pe
   `assets.mixkit.co`, un `HEAD` întoarce **403**; descărcarea funcționează doar cu
   `User-Agent` de browser **și** `Referer: https://mixkit.co/`. Clipul nu se comite.
2. **`tools/build-seq.mjs`** care extrage ambele rânduri cu `-start_number 0` și raportează
   greutatea, plus scriptul npm.
3. **Generarea setului** și **înlocuirea** conținutului din `img/seq/` și `img/seq/m/`.
   Fișierele vechi se șterg, nu se lasă alături.
4. **`js/sequence.js`: `FRAMES` → 480, `FRAME_VERSION` nou.** Apoi **reacordarea** celor
   trei constante de streaming (`MAX_PARALLEL`, `PREFETCH_AHEAD`, `CACHE_RADIUS`) prin
   măsurătoare pe rețea throttled, nu prin ghicire.
5. **`css/styles.css`:** scoaterea `filter: grayscale(1)` și actualizarea ambelor
   `background-image` de rezervă (desktop + mobil) la aceeași versiune.
6. **Verificarea comportamentului:** scroll lin pe tot parcursul, fără salturi; reduced-motion
   → cadru static; trecerea pragului `NARROW` la redimensionare fără artefacte.
7. **`npm run i18n:build`** dacă s-a atins vreun HTML, apoi **`npm run verify`**.

**Decisii lăsate explicit builder-ului** (nu le-a hotărât utilizatorul):

- Valorile finale pentru `MAX_PARALLEL`, `PREFETCH_AHEAD`, `CACHE_RADIUS` — trebuie
  măsurate, nu alese din ochi. Bugetul este 17.56 MB desktop / ~2.93 MB mobil.
- Nivelul de calitate final (`-q:v`): am validat **62 pe desktop** și **66 pe mobil**. Dacă
  builder-ul vede artefacte vizibile la 62, crește; dacă vrea altă greutate, coboară. Nu
  schimba geometria ca să compensezi calitatea.
- Dacă menținem pragul `NARROW` la 860 sau îl ajustăm — depinde de unde se simte cel mai bine
  tranziția între rânduri.
- Modul exact de raportare din `build-seq.mjs` (dimensiune totală, timp, cadru lipsă).

**A mea, de verificat de tine (nu ale tale):** geometria 16:9 pentru desktop (din `taiere=1`),
rândul mobil portrait 432×768, decizia anti-LFS, și pornirea pe cadrul 0 (din tensiunea
`cadru_start` de la §4).

**Nu se atinge:** structura HTML a hero-ului, textele, secțiunile, ancorele, pipeline-ul i18n
în afara rulării normale, `js/theme.js`, zipper-ul.

---

## 7. Ce arată „terminat”

- `img/seq/` are 480 de cadre gri 1920×1080 (17.56 MB) și `img/seq/m/` are 480 de cadre gri
  portrait 432×768 (2.93 MB), toate numite de la `f000`.
- `tools/build-seq.mjs` există și regenerează setul din sursă în sub două minute.
- Derularea de sus până jos joacă o singură mișcare continuă, fără salturi vizibile.
- Hero-ul arată ca o fotografie de arhitectură pe un desktop de 1920 px.
- `npm run verify` trece.
- Primul render nu este blocat: imaginea de rezervă din CSS apare instant, cadrele se
  încarcă progresiv.
