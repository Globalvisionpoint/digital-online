/* ============================================================
   Load the generated middleware for tests.

   `middleware.ts` is TypeScript, but its body is plain JavaScript
   without a single type annotation in an expression position — the
   only TypeScript is the type annotations, which `node --check` and
   the Vercel build handle. To call the handler from a test, the file
   is copied to `.mjs`, and a tiny shim stands in for
   `@vercel/functions`:

     - `next()` returns the marker header the platform reads, so a
       test can tell "continue to the static file" apart from a
       response the middleware wrote.
     - `geolocation()` returns the country the test chose.

   The shim is written to a temporary folder next to the copy, and
   both are removed afterwards.
   ============================================================ */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SHIM = `export function next(init = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set('x-middleware-next', '1');
  return new Response(null, { ...init, headers });
}

export function rewrite(destination, init = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set('x-middleware-rewrite', String(destination));
  return new Response(null, { ...init, headers });
}

export function geolocation(request) {
  return { country: request.headers.get('x-test-country') || undefined };
}
`;

/**
 * Import the generated middleware with a testable @vercel/functions.
 *
 * Node runs TypeScript files by stripping the type annotations, so
 * the copy keeps its `.ts` extension (renaming it to `.mjs` would
 * leave the annotations in place and fail to parse).
 *
 * @param {string} source the text of middleware.ts
 * @param {{ country?: string }} options
 * @returns {Promise<{ handler: (request: Request) => Promise<Response>, cleanup: () => void }>}
 */
export async function loadMiddleware(source, { country } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'do-middleware-'));

  // The generated file imports @vercel/functions; point that at the
  // shim by rewriting the specifier to the local file.
  const shimPath = path.join(dir, 'vercel-functions.ts');
  fs.writeFileSync(shimPath, SHIM, 'utf8');

  const body = source.replace(
    "import { geolocation, next, rewrite } from '@vercel/functions';",
    `import { geolocation, next, rewrite } from './vercel-functions.ts';`
  );

  const modulePath = path.join(dir, 'middleware.ts');
  fs.writeFileSync(modulePath, body, 'utf8');

  const mod = await import(pathToFileURL(modulePath).href);

  return {
    handler: (request) => {
      const headers = new Headers(request.headers);
      if (country) headers.set('x-test-country', country);
      if (!headers.has('x-test-country')) headers.set('x-test-country', 'RO');
      return mod.default(new Request(request.url, {
        method: request.method,
        headers
      }));
    },
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true })
  };
}

/** True when the middleware let the request continue to the file. */
export function continued(response) {
  return response.headers.get('x-middleware-next') === '1';
}

/** The destination of a rewrite, or null when it is not a rewrite. */
export function rewrittenTo(response) {
  return response.headers.get('x-middleware-rewrite');
}
