/* ============================================================
   Hero title fit check.

   Every hero title must keep its words intact and stay inside the hero
   column on phone widths. This check loads each localized page in Chromium
   and compares the rendered lines with the original title text.

   Run: node tools/check-hero-fit.mjs
   Optional environment:
     CHROME_PATH       path to a Chromium/Chrome executable
     PUPPETEER_PATH    path to a puppeteer-core installation
     HERO_WIDTHS       comma separated viewport widths
     HERO_NO_JS        set to 1 to check the page without JavaScript
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { parse } from 'node-html-parser';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');

const WIDTHS = (process.env.HERO_WIDTHS || '320,360,375,390,412,430,480,600')
  .split(',')
  .map(value => Number(value.trim()))
  .filter(value => Number.isFinite(value) && value > 0);

const LOCALES = [
  { code: 'ro', dir: '' },
  { code: 'en', dir: 'en/' },
  { code: 'es', dir: 'es/' },
  { code: 'pt-BR', dir: 'pt-br/' }
];

/* A title smaller than this stops reading as a hero title. */
const MIN_FONT_SIZE = 12;

/* The hero entrance slides the title in for 1.2s. Measuring during the
   animation reports shifted rectangles, so the animation is switched off
   before anything is measured. */
const FREEZE_CSS = `
  .hm-title-fill, .hm-line {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const resolvePuppeteer = () => {
  const candidates = [
    process.env.PUPPETEER_PATH,
    'puppeteer-core',
    process.env.APPDATA ? path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer-core') : ''
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      /* try the next candidate */
    }
  }
  return null;
};

const resolveChromium = () => {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const roots = [
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'ms-playwright') : '',
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local', 'ms-playwright') : ''
  ].filter(Boolean);

  for (const base of roots) {
    if (!fs.existsSync(base)) continue;
    const candidates = [];
    for (const entry of fs.readdirSync(base)) {
      candidates.push(path.join(base, entry, 'chrome-win64', 'chrome.exe'));
      candidates.push(path.join(base, entry, 'chrome-win', 'chrome.exe'));
      candidates.push(path.join(base, entry, 'chrome-linux', 'chrome'));
      candidates.push(path.join(base, entry, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'));
    }
    const found = candidates.find(candidate => fs.existsSync(candidate));
    if (found) return found;
  }
  return null;
};

/* Pages that carry a hero title, read from the Romanian sources. */
const heroPages = () => fs.readdirSync(root)
  .filter(file => file.endsWith('.html'))
  .filter(file => /hm-title-fill/.test(fs.readFileSync(path.join(root, file), 'utf8')))
  .sort();

/* Aspera has no accented glyphs, so the page scripts strip the diacritics
   before rendering. The reference text is normalized the same way, so the
   rendered lines can be matched against it. */
const stripDiacritics = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const originalTitles = (file) => {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  return parse(html)
    .querySelectorAll('.hm-title-fill')
    .map(node => stripDiacritics(node.text.replace(/\s+/g, ' ').trim()))
    .filter(Boolean);
};

const startServer = () => new Promise((resolve) => {
  const server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent(request.url.split('?')[0]);
    let filePath = path.join(root, requestPath);
    if (requestPath.endsWith('/')) filePath = path.join(filePath, 'index.html');
    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end('forbidden');
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end('not found');
        return;
      }
      response.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
      response.end(data);
    });
  });
  server.listen(0, '127.0.0.1', () => resolve(server));
});

/* Find the breaks that cut a word in half.
   A break between two words is fine. A break inside a word is only allowed
   when the browser hyphenated it on a syllable boundary, which shows up as a
   trailing hyphen on the line and a continuation on the next one.

   The comparison ignores case and diacritics in both directions: with
   JavaScript the page strips the accents before rendering, without it the
   accents stay in place, and neither changes where a word may break. */
const normalize = (value) => stripDiacritics(value).toLowerCase();

const findMidWordBreaks = (original, lines) => {
  const reference = normalize(original).replace(/\s+/g, ' ').trim();
  const breaks = [];
  let position = 0;

  lines.forEach((line, index) => {
    const hyphenated = line.text.endsWith('-');
    const needle = normalize(hyphenated ? line.text.slice(0, -1) : line.text).trim();
    const found = reference.indexOf(needle, position);

    if (found === -1) {
      breaks.push({ index, text: line.text, reason: 'line-not-found' });
      position += needle.length;
      return;
    }

    const next = reference[found + needle.length];

    /* The line continues inside the same word when the next character of the
       reference is not a space. A trailing hyphen means the browser broke the
       word on a syllable of the page language, which is allowed. */
    if (next !== undefined && next !== ' ' && !hyphenated) {
      breaks.push({ index, text: line.text, reason: 'cut-word' });
    }

    position = found + needle.length;
  });

  return breaks;
};

const main = async () => {
  const puppeteer = resolvePuppeteer();
  if (!puppeteer) {
    console.error('puppeteer-core is required. Install it or set PUPPETEER_PATH.');
    process.exit(2);
  }

  const executablePath = resolveChromium();
  if (!executablePath) {
    console.error('No Chromium executable found. Set CHROME_PATH.');
    process.exit(2);
  }

  const server = await startServer();
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none']
  });

  const problems = [];
  const pages = heroPages();
  const withJs = process.env.HERO_NO_JS !== '1';

  for (const locale of LOCALES) {
    for (const page of pages) {
      const relative = `${locale.dir}${page}`;
      const file = path.join(locale.dir, page);
      if (!fs.existsSync(path.join(root, file))) continue;

      const originals = originalTitles(file);
      const tab = await browser.newPage();
      await tab.setJavaScriptEnabled(withJs);

      for (const width of WIDTHS) {
        await tab.setViewport({ width, height: 900 });
        await tab.goto(`${base}/${relative}`, { waitUntil: 'networkidle0' });

        if (withJs) {
          await tab.evaluate(async () => {
            await document.fonts.ready;
            await document.fonts.load('400 96px Aspera');
            await document.fonts.load('400 96px "JetBrains Mono"');
          });
        } else {
          await tab.evaluate(() => document.fonts.ready);
        }

        await tab.addStyleTag({ content: FREEZE_CSS });
        await new Promise(resolve => setTimeout(resolve, withJs ? 250 : 600));

        const measured = await tab.evaluate(() => {
          /* One entry per visual line of one fill. The zipper wraps every
             rendered line in a .hm-line span, but without JavaScript there are
             no spans, so each character is measured and grouped by its top
             edge instead. */
          function readRenderedLines(fill) {
            const lineElements = Array.from(fill.querySelectorAll('.hm-line'));
            if (lineElements.length) {
              return lineElements.map(readElement).filter(line => line.text);
            }
            return readByCharacter(fill);
          }

          function readElement(element) {
            const range = document.createRange();
            range.selectNodeContents(element);
            const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0);
            return {
              text: element.textContent.replace(/\s+/g, ' ').trim(),
              left: Math.round((rects.length ? Math.min(...rects.map(rect => rect.left)) : 0) * 10) / 10,
              right: Math.round((rects.length ? Math.max(...rects.map(rect => rect.right)) : 0) * 10) / 10
            };
          }

          function readByCharacter(root) {
            const lines = [];
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
              const value = node.nodeValue;
              if (!value) continue;
              /* Spaces carry no rectangle and are dropped at a soft wrap, but
                 they still separate two words on the same line, so append them
                 to the line that is open at that point in the text. */
              let openLine = null;
              for (let i = 0; i < value.length; i += 1) {
                const character = value[i];
                const range = document.createRange();
                range.setStart(node, i);
                range.setEnd(node, i + 1);
                const rect = range.getBoundingClientRect();
                if (!rect.width && !rect.height) continue;
                const line = lines.find(candidate => Math.abs(candidate.top - rect.top) < 2);
                if (/\s/.test(character)) {
                  if (line) line.text += ' ';
                  continue;
                }
                if (line) {
                  line.text += character;
                  line.left = Math.min(line.left, rect.left);
                  line.right = Math.max(line.right, rect.right);
                } else {
                  openLine = { top: rect.top, text: character, left: rect.left, right: rect.right };
                  lines.push(openLine);
                }
              }
            }
            return lines
              .sort((a, b) => a.top - b.top)
              .map(line => ({
                text: line.text.replace(/\s+/g, ' ').trim(),
                left: Math.round(line.left * 10) / 10,
                right: Math.round(line.right * 10) / 10
              }))
              .filter(line => line.text);
          }

          return Array.from(document.querySelectorAll('.hm-title-fill')).map((fill) => {
            const style = getComputedStyle(fill);
            const box = fill.getBoundingClientRect();
            return {
              text: fill.textContent.replace(/\s+/g, ' ').trim(),
              fontSize: parseFloat(style.fontSize),
              available: fill.clientWidth,
              boxLeft: Math.round(box.left * 10) / 10,
              boxRight: Math.round(box.right * 10) / 10,
              lines: readRenderedLines(fill)
            };
          });
        });

        measured.forEach((item, index) => {
          const original = originals[index] || item.text;
          const breaks = findMidWordBreaks(original, item.lines);

          /* The text has to stay inside the hero column: a line may not
             reach past the right edge of its own box. */
          const overflow = item.lines.some(line => line.right > item.boxRight + 1);
          const tooSmall = withJs && item.fontSize < MIN_FONT_SIZE;

          if (breaks.length || overflow || tooSmall) {
            problems.push([
              `${locale.code}/${page} @${width}px`,
              `title="${original}"`,
              `font=${item.fontSize}px`,
              `available=${item.available}`,
              `lines=${JSON.stringify(item.lines.map(line => line.text))}`,
              `rights=${JSON.stringify(item.lines.map(line => line.right))}`,
              `boxRight=${item.boxRight}`,
              breaks.length ? `MID_WORD_BREAK=${JSON.stringify(breaks)}` : '',
              overflow ? 'OVERFLOW' : '',
              tooSmall ? 'FONT_TOO_SMALL' : ''
            ].filter(Boolean).join(' '));
          }
        });
      }

      await tab.close();
    }
  }

  await browser.close();
  server.close();

  console.log(`Checked ${pages.length} pages x ${LOCALES.length} locales x ${WIDTHS.length} widths${withJs ? '' : ' (no JavaScript)'}.`);
  if (problems.length) {
    console.log(`${problems.length} problem(s):`);
    problems.forEach(problem => console.log(`  ${problem}`));
    process.exit(1);
  }
  console.log('No hero title overflows and no word is broken.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
