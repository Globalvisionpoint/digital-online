# Digital Online — Website

Static, multilingual website for Digital Online (Global Vision Point Limited). Romanian pages are the source of truth; English, Spanish, and Brazilian Portuguese pages are generated from the same HTML and translation catalogs.

## Pages and assets

- Romanian source pages: `index.html` and 12 service, company, and policy pages at the repository root.
- Localized pages: `en/`, `es/`, and `pt-br/`.
- Shared styles and scripts: `css/` and `js/`.
- Images and the scroll-driven hero sequence: `img/`.
- Translation catalogs and build tools: `tools/locales/` and `tools/`.
- `404.html` is the branded host-level not-found page; it selects Romanian, English, Spanish, or Brazilian Portuguese from the requested URL prefix.

## Development

Install the Node.js dependencies once:

```sh
npm install
```

Common commands:

```sh
npm run i18n:extract  # refresh the Romanian source-string catalog
npm run i18n:build   # rebuild localized pages, middleware, and sitemap
npm run i18n:check   # report missing or stale catalog entries
npm run verify       # check catalog quality and run parser/pipeline tests
```

Preview with any local static HTTP server. For example:

```sh
npx serve .
```

Edit Romanian source pages and catalogs, then rebuild; do not hand-edit generated localized pages or `middleware.ts`. The generator keeps localized asset paths, SEO metadata, language links, middleware, and the sitemap in sync.

## Technical notes

- Plain HTML, CSS, and vanilla JavaScript; no front-end framework.
- Vercel serves the static site and runs the generated language-selection middleware.
- Responsive layouts, keyboard-operable navigation, reduced-motion support, and a branded localized 404 page.
- `npm run verify` is the focused validation command for build-pipeline changes.

## Company

- Brand: Digital Online
- Legal company: Global Vision Point Limited
- Contact: contact@digital-online.ro

© Digital Online · Global Vision Point Limited
