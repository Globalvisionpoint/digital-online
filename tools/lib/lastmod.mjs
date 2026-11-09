/* ============================================================
   The <lastmod> dates for the search sitemap.

   The latest of the commit date and file modification time is used,
   so uncommitted content changes do not publish a stale <lastmod>.
   A page with no readable date gets no <lastmod> — the tag is optional.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * Read every HTML page's latest commit date in one `git log` call.
 * `git log` walks newest first, so the first mention of a file is
 * its most recent change.
 */
function readCommitDates(root) {
  const dates = new Map();
  if (!fs.existsSync(path.join(root, '.git'))) return dates;

  const out = execFileSync(
    'git',
    ['log', '--no-merges', '--pretty=format:%cI', '--name-only', '--', '*.html'],
    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let date = '';
  for (const raw of out.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^\d{4}-\d{2}-\d{2}T/.test(line)) {
      date = line;
    } else if (line.endsWith('.html') && !dates.has(line)) {
      dates.set(line, date);
    }
  }
  return dates;
}

/**
 * @param {string} root repository root
 * @returns {(fileName: string) => string} `fileName -> 'YYYY-MM-DD'`
 */
export function createLastmodResolver(root) {
  const commitDates = readCommitDates(root);
  const cache = new Map();

  return (fileName) => {
    if (cache.has(fileName)) return cache.get(fileName);

    let value = '';
    const committed = commitDates.get(fileName);
    if (committed) value = committed.slice(0, 10);
    try {
      const modified = fs.statSync(path.join(root, fileName)).mtime.toISOString().slice(0, 10);
      if (!value || modified > value) value = modified;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (!committed) value = '';
    }

    cache.set(fileName, value);
    return value;
  };
}
