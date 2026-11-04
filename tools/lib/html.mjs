/* ============================================================
   Minimal, offset-preserving HTML parser.

   The site has no build step, so localized pages are generated from
   the Romanian originals. A generic parser (node-html-parser)
   normalises `<br />` to `<br>` and drops comments, which would make
   every generated page differ from its source for no reason. This
   parser keeps the original byte offsets of every text node and
   attribute value, so unchanged content is emitted verbatim and only
   the parts that actually differ get rewritten.
   ============================================================ */

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

/* Elements whose content is raw text: no nested markup.
   `title` is deliberately excluded — its content is plain text that
   needs translating, and it never contains markup. */
const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea']);

/* Elements whose text must never be translated (technical keys, code). */
export const UNTRANSLATABLE_ELEMENTS = new Set([
  'code', 'pre', 'kbd', 'samp', 'script', 'style', 'textarea'
]);

export function parseHtml(source) {
  const root = { type: 'root', tag: null, children: [], parent: null };
  const stack = [root];
  let current = root;
  let i = 0;
  const len = source.length;

  while (i < len) {
    const lt = source.indexOf('<', i);
    if (lt === -1) {
      pushText(current, source.slice(i), i, len);
      break;
    }
    if (lt > i) pushText(current, source.slice(i, lt), i, lt);

    if (source.startsWith('<!--', lt)) {
      const close = source.indexOf('-->', lt + 4);
      const end = close === -1 ? len : close + 3;
      current.children.push({
        type: 'comment',
        value: source.slice(lt + 4, close === -1 ? len : close),
        start: lt, end, parent: current
      });
      i = end;
      continue;
    }

    if (source.startsWith('<!', lt) || source.startsWith('<?', lt)) {
      const close = source.indexOf('>', lt);
      const end = close === -1 ? len : close + 1;
      current.children.push({
        type: 'decl',
        value: source.slice(lt, end),
        start: lt, end, parent: current
      });
      i = end;
      continue;
    }

    if (source.startsWith('</', lt)) {
      const close = source.indexOf('>', lt);
      const end = close === -1 ? len : close + 1;
      const name = source.slice(lt + 2, close === -1 ? len : close).trim().toLowerCase();
      for (let s = stack.length - 1; s > 0; s -= 1) {
        if (stack[s].tag === name) {
          stack[s].closeStart = lt;
          stack[s].closeEnd = end;
          stack.length = s;
          break;
        }
      }
      current = stack[stack.length - 1];
      i = end;
      continue;
    }

    const tagEnd = findTagEnd(source, lt);
    const parsed = parseTag(source.slice(lt, tagEnd), lt);
    const element = {
      type: 'element',
      tag: parsed.tag,
      attrs: parsed.attrs,
      children: [],
      parent: current,
      start: lt,
      openEnd: tagEnd,
      end: tagEnd
    };
    element.classList = parsed.attrs
      .filter(a => a.name.toLowerCase() === 'class')
      .flatMap(a => a.value.split(/\s+/))
      .filter(Boolean);
    current.children.push(element);

    if (parsed.selfClosing || VOID_ELEMENTS.has(parsed.tag)) {
      i = tagEnd;
      continue;
    }

    if (RAW_TEXT_ELEMENTS.has(parsed.tag)) {
      const closeRe = new RegExp(`</${parsed.tag}\\s*>`, 'i');
      const rest = source.slice(tagEnd);
      const match = closeRe.exec(rest);
      const contentEnd = match ? tagEnd + match.index : len;
      if (contentEnd > tagEnd) {
        element.children.push({
          type: 'raw',
          value: source.slice(tagEnd, contentEnd),
          start: tagEnd, end: contentEnd, parent: element
        });
      }
      if (match) {
        element.closeStart = contentEnd;
        element.closeEnd = contentEnd + match[0].length;
      }
      i = match ? contentEnd + match[0].length : len;
      continue;
    }

    stack.push(element);
    current = element;
    i = tagEnd;
  }

  return root;
}

function pushText(parent, value, start, end) {
  if (!value) return;
  parent.children.push({ type: 'text', value, start, end, parent });
}

function findTagEnd(source, from) {
  let i = from + 1;
  let quote = null;
  while (i < source.length) {
    const c = source[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      return i + 1;
    }
    i += 1;
  }
  return source.length;
}

function parseTag(raw, offset) {
  const nameMatch = /^<([a-zA-Z][a-zA-Z0-9:_.-]*)/.exec(raw);
  const tag = nameMatch ? nameMatch[1].toLowerCase() : '';
  const attrs = [];
  let i = nameMatch ? nameMatch[0].length : 1;
  const selfClosing = /\/\s*>$/.test(raw);

  while (i < raw.length - 1) {
    while (i < raw.length && /\s/.test(raw[i])) i += 1;
    if (i >= raw.length - 1) break;
    if (raw[i] === '/') { i += 1; continue; }

    const attrMatch = /^[^\s=/>]+/.exec(raw.slice(i));
    if (!attrMatch) { i += 1; continue; }
    const name = attrMatch[0];
    i += name.length;

    let j = i;
    while (j < raw.length && /\s/.test(raw[j])) j += 1;

    if (raw[j] === '=') {
      j += 1;
      while (j < raw.length && /\s/.test(raw[j])) j += 1;
      const quote = raw[j];
      if (quote === '"' || quote === "'") {
        const close = raw.indexOf(quote, j + 1);
        const valueEnd = close === -1 ? raw.length - 1 : close;
        attrs.push({
          name,
          value: raw.slice(j + 1, valueEnd),
          quote,
          hasValue: true,
          valueStart: offset + j + 1,
          valueEnd: offset + valueEnd
        });
        i = close === -1 ? raw.length : close + 1;
      } else {
        const valueMatch = /^[^\s>]*/.exec(raw.slice(j));
        const value = valueMatch ? valueMatch[0] : '';
        attrs.push({
          name,
          value,
          quote: '',
          hasValue: true,
          valueStart: offset + j,
          valueEnd: offset + j + value.length
        });
        i = j + value.length;
      }
    } else {
      attrs.push({ name, value: null, quote: '', hasValue: false });
      i = j;
    }
  }

  return { tag, attrs, selfClosing };
}

/* ------------------------------------------------------------
   Tree helpers
   ------------------------------------------------------------ */

export function getAttr(element, name) {
  if (!element || !element.attrs) return null;
  const found = element.attrs.find(a => a.name.toLowerCase() === name.toLowerCase());
  return found ? found.value : null;
}

export function hasAttr(element, name) {
  return element && element.attrs
    ? element.attrs.some(a => a.name.toLowerCase() === name.toLowerCase())
    : false;
}

/** True when the element carries the given CSS class. */
export function hasClass(element, className) {
  if (!element || !element.classList) return false;
  return element.classList.includes(className);
}

export function findElements(root, predicate) {
  const out = [];
  const visit = (node) => {
    for (const child of node.children || []) {
      if (child.type === 'element') {
        if (predicate(child)) out.push(child);
        visit(child);
      }
    }
  };
  visit(root);
  return out;
}

export function findFirst(root, predicate) {
  let found = null;
  const visit = (node) => {
    if (found) return;
    for (const child of node.children || []) {
      if (found) return;
      if (child.type === 'element') {
        if (predicate(child)) { found = child; return; }
        visit(child);
      }
    }
  };
  visit(root);
  return found;
}

/* Depth-first walk over every node in the tree. */
export function walk(root, visit) {
  const step = (node) => {
    visit(node);
    for (const child of node.children || []) step(child);
  };
  step(root);
}

/* ------------------------------------------------------------
   Patch application
   ------------------------------------------------------------ */

/**
 * Apply a set of replacements to the original source.
 * Replacements are { start, end, text } and must not overlap.
 */
export function applyPatches(source, patches) {
  if (!patches.length) return source;
  const sorted = [...patches].sort((a, b) => a.start - b.start || a.end - b.end);
  let out = '';
  let cursor = 0;
  for (const patch of sorted) {
    if (patch.start < cursor) continue; // overlap: skip
    out += source.slice(cursor, patch.start);
    out += patch.text;
    cursor = patch.end;
  }
  out += source.slice(cursor);
  return out;
}

/* ------------------------------------------------------------
   Whitespace helpers
   ------------------------------------------------------------ */

/** Collapse all whitespace runs to single spaces and trim. */
export function normalize(value) {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Replace the trimmed core of `original` with `replacement`, keeping the
 * original leading and trailing whitespace so indentation survives.
 */
export function spliceText(original, replacement) {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(original);
  if (!match) return replacement;
  const [, lead, core, trail] = match;
  if (!core) return original;
  return lead + replacement + trail;
}
