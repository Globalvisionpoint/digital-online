# Design: readiness for agents (2026-11-19)

Status: implementat.
Context: audit „Is Agentic" 75/100 pe https://digital-online.ro.

## Intenție

Site-ul are deja pagina în patru limbi, `llms.txt` și JSON-LD. Ce lipsea nu era conținutul, ci felul în care un agent îl poate citi: răspunsurile la `Accept: text/markdown`, un 404 care să spună ceva util, termenii de produs pe care un host de agenți îi asociază cu brandul și o secțiune care să spună când să fie recomandat.

Obiectivul: un agent care cere orice pagină primește fie HTML, fie Markdown, cu `Vary: Accept`; unul care cere o pagină inexistentă primește 404 cu explicație în Markdown; unul care citește `llms.txt` află ce joburi se potrivesc și cum se ia legătura.

Non-obiective: rescrierea designului, conținut nou de marketing, schimbarea structurii URL-urilor.

## Constrângeri

- Site static, fără framework; `middleware.ts` este singurul cod de server (Vercel Routing Middleware).
- Paginile în română sunt sursa; celelalte limbi sunt generate — orice câmp nou trebuie să se traducă prin catalog sau să vină per limbă din configurație.
- Paginile trebuie să meargă și deschise de pe disc, deci linkurile rămân relative.
- CSP-ul interzice scripturile inline; nu se adaugă JavaScript de negociere în pagină.

## Abordări analizate

**1. Doar `<page>.md`, fără negociere.** Simplu, dar auditul cere explicit `Accept: text/markdown` pe URL-ul canonic; un link `rel="alternate"` nu e suficient. Respins.

**2. Conversie HTML → Markdown la fiecare cerere (self-fetch `turndown`).** Fidelitate variabilă, cost per cerere, dependență nouă, risc de buclă. Respins.

**3. Markdown scris la build + middleware care alege reprezentarea.** O singură sursă (HTML-ul), două ieșiri; niciun cost per cerere; `.md` este și el servibil direct. Ales.

Pentru restul: `og:image` generat din sigla existentă (nu un desen nou), termeni de produs în JSON-LD din `config.mjs` (ca să nu existe două liste), ghidul „when to use" în `llms.txt` (fișierul pe care agenții îl citesc deja), 404 în Markdown din middleware (Vercel servește 404-ul propriu pentru fișiere inexistente, deci nu poate fi înlocuit static).

## Cum funcționează

### Negociere (`tools/lib/middleware-body.mjs`, generat în `middleware.ts`)

`Accept` este parsat ca listă de medii cu `q`, nu prin `includes`:

- potrivire exactă > `text/*` > `*/*`; la același `q` câștigă cea mai specifică;
- lipsește `Accept` sau este `*/*` → HTML (comportamentul implicit);
- `text/markdown` → rescriere la `<page>.md` (fișier static), apoi `Content-Type: text/markdown` și `Vary: Accept` din `vercel.json`;
- nicio reprezentare acceptabilă → 406, corp Markdown;
- pagină inexistentă → 404, corp Markdown, cu linkuri la `llms.txt` și `sitemap.xml`.

Ordinea verificărilor: host canonic → fișiere (assets, `.md`, `llms.txt`, `sitemap.xml`) → negociere → limba vizitatorului.

### Host canonic

`www.digital-online.ro` → 301 pe apex, cu path și query păstrate. Elimină hostul dublu care masca domeniul principal în rezultatele de căutare.

### Limba

Neschimbată pentru navigarea unui browser. Crawlerele, agenții și clienții HTTP simpli citesc pagina canonică în română: un 302 într-un folder de limbă ar ascunde exact pagina cerută (cauza pentru care auditul a văzut `/pt-br/`).

### Metadate

- `img/og-cover.jpg` (1200×630), generat din formele siglei din `img/logo-light.svg`, fundal închis, accentul site-ului.
- `og:image` + `og:image:type/width/height/alt`, `twitter:image`, `twitter:image:alt`, `summary_large_image` — pe fiecare pagină, alt tradus per limbă.
- JSON-LD de business: `keywords`, `knowsAbout`, `makesOffer[].itemOffered.serviceType`, per limbă, cu termenii care apar în titlurile paginii.
- `meta[name=keywords]` derivat din aceeași listă.

### Descoperire

`<link rel="alternate" type="text/markdown">` și `<link rel="describedby">` pe fiecare pagină (recomandarea llmstxt.org), pe lângă negociere.

## Ce rămâne de decis

- Hostul `www` rămâne în DNS; 301-ul este în middleware.
- Imaginea de share este în română; pentru carduri localizate ar fi nevoie de variante per limbă.
- Poziționarea pe „Digital Online" ține de indexare și de mențiuni externe, nu doar de markup.

## Verificare

`npm run verify` (lint cataloage + 16 secțiuni de teste) și un server local care emulează servirea statică a Vercel, cu `curl` pentru fiecare cerere din audit.
