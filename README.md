# Digital Online — Website

Site complet pentru **Digital Online** (Global Vision Point Limited), cu toate serviciile de IT, web development, Magazine Online, integrări automate, consultanță business, import China, promovare digitală, video/foto/AI, implementare AI și platforme custom.

## Structură

```
digital-online/
├── index.html              # Pagina principală
├── servicii-it.html        # Servicii IT & Web
├── magazine-online.html    # Magazine Online
├── integrari.html          # Integrări Automate
├── consultanta.html        # Consultanță Business
├── import-china.html       # Import Produse China
├── promovare.html          # Promovare & Marketing (Google/Meta/TikTok Ads)
├── montaj-editare-video-foto.html  # Montaj & Editare Video-Foto
├── implementare-ai.html    # Implementare AI & Chatboți
├── platforme-custom.html   # Platforme & Aplicații Custom
├── css/
│   └── styles.css          # Stylesheet principal (luminous, no dark mode)
└── js/
    └── script.js           # Interacțiuni (meniu, formular, reveal-on-scroll)
```

## Caracteristici

- ✅ **Design luminos**, fără dark mode (așa cum a fost cerut)
- ✅ **Date companie ascunse** — în secțiunea „Încredere & Transparență" cu buton „Afișează datele companiei"
- ✅ **Dashboard-uri analytics** pentru Google Analytics, Shopify, SmartBill, Google Ads, Meta Ads, TikTok Ads, Curierat, AI Agents
- ✅ **9 pagini dedicate** pentru fiecare serviciu în parte
- ✅ **Formulare de contact** cu validare pe toate paginile
- ✅ **Mobile-responsive** complet
- ✅ **SEO friendly** — meta descriptions, headings ierarhice, breadcrumbs
- ✅ **Animații subtile** la scroll
- ✅ **Titluri hero animate** — liniile intră alternativ din stânga și din dreapta, ca un fermoar, urmărind liniile reale de text (rand 1 stânga, rand 2 dreapta, rand 3 stânga), măsurate la runtime deci corecte la orice lățime și după redimensionare (ex. `DIGITAL` / `ONLINE` pe prima pagină)
- ✅ **Fonturi premium** (Aspera + Inter Tight) găzduite local, fără cereri către Google Fonts

## Deschidere locală

Deschide `index.html` în browser pentru paginile statice. Pentru middleware (negocierea Markdown, 404 în Markdown) folosește serverul local descris mai jos.

## Generare (i18n, Markdown, middleware)

Pagina în română este sursa; versiunile `/en/`, `/es/`, `/pt-br/` și fișierele pentru agenți sunt generate din ea.

```bash
npm install
npm run i18n        # extract + build: pagini localizate, middleware.ts, sitemap, .md
npm run verify      # lint cataloage + teste
```

Ce scrie `npm run i18n` în rădăcină:

- `middleware.ts` — rutare Vercel: alegerea limbii, negocierea `Accept` (HTML ↔ Markdown), 404/406 în Markdown, un singur host canonic (`www` → apex)
- `sitemap.xml` — fiecare pagină în fiecare limbă, cu alternates și `<lastmod>`
- `index.md`, `servicii-it.md`, … și echivalentele din `/en/`, `/es/`, `/pt-br/` — conținutul paginii, fără navigare, servit la `Accept: text/markdown`
- `llms.txt` și versiunile localizate sunt scrise manual, nu generate

Fișierele `.md` și `middleware.ts` trebuie regenerate după orice modificare de HTML: testele verifică dacă sunt actuale.

### `<lastmod>`: data vine din conținut, nu din ceas

`tools/sitemap-state.json` ține un hash al fiecărei pagini și data la care a fost schimbată ultima dată. La build, pagina se hash-uiește din nou: dacă bytes-ii sunt identici, data rămâne; dacă diferă, primește data de azi.

De ce contează: Google ignoră `<lastmod>` dacă îl vede schimbându-se la fiecare deploy fără motiv. Un build care nu schimbă nimic produce un `sitemap.xml` identic byte cu byte, deci crawlerul nu e trimis să recitească tot site-ul degeaba.

State-ul se commite în git. Ștergerea lui nu strică nimic — următorul build datează toate paginile cu ziua respectivă.

## Pentru agenți

- `/llms.txt` — ghidul site-ului: servicii, contact, când să fie recomandat
- `Accept: text/markdown` pe orice pagină — varianta Markdown a paginii
- `<page>.md` — varianta Markdown, direct
- `<link rel="alternate" type="text/markdown">` și `<link rel="describedby">` în `<head>`

```bash
# Opțional: pornire server local cu Python
cd digital-online
python -m http.server 8000
# apoi accesează http://localhost:8000
```

## Compania

- **Brand comercial:** Digital Online
- **Companie legală:** Global Vision Point Limited
- **Sediu social:** Suite 2, 260 Main Street, Gibraltar
- **Email contact:** contact@digital-online.ro

Datele legale sunt plasate în secțiunea „Încredere & Transparență" a paginii principale (buton expandabil), nu la vedere pe fiecare pagină.

## Tehnologii folosite

- HTML5 semantic
- CSS3 (variabile, flexbox, grid, animații, gradient)
- Vanilla JavaScript pentru UI, plus `@vercel/functions` pentru middleware
- Fonturi găzduite local (Aspera, Inter Tight), fără Google Fonts

---

© Digital Online · Global Vision Point Limited
