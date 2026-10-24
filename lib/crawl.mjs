// The crawler, shared by scripts/build.mjs (CLI) and the Settings page (manual
// re-crawl).  It is dependency-free: plain fetch plus the tiny HTML reader, so it
// also runs inside the DSH host process without a build step.
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parsePage } from '../scripts/parse.mjs';

export const BASE = 'https://dev-wiki.mini1.cn';
export const ROOT = '/ugc-wiki/';
/** Pages that carry no prose worth serving to the model. */
export const NAV_PAGES = ['/ugc-wiki/apis/API.html'];

export async function fetchText(url, options) {
  const o = options || {};
  const tries = Number(o.tries) || 3;
  const timeoutMs = Number(o.timeoutMs) || 20000;
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    if (o.signal && o.signal.aborted) throw new Error('crawl aborted');
    const timer = setTimeout(() => {}, 0);
    clearTimeout(timer);
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'dsh-minicode-index/1.0 (+manual crawl)' },
        signal: o.signal ? o.signal : AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (o.signal && o.signal.aborted) break;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw lastErr;
}

export function cacheName(pagePath) {
  return pagePath.replace(/^\/ugc-wiki\//, '').replace(/\//g, '__');
}

export function pageListFrom(html) {
  const out = new Set();
  const asideStart = html.indexOf('<aside class="VPSidebar"');
  const scope = asideStart < 0 ? html : html.slice(asideStart);
  const re = /href="(\/ugc-wiki\/[^"#?]*?\.html)"/g;
  let m;
  while ((m = re.exec(scope))) out.add(m[1]);
  if (!out.size) {
    const re2 = /href="(\/ugc-wiki\/[^"#?]*?\.html)"/g;
    while ((m = re2.exec(html))) out.add(m[1]);
  }
  return [...out].sort();
}

/** Turn parsed pages into the index object the tools read. */
export function assemble(results) {
  const apis = [];
  const events = [];
  const enums = [];
  const docs = [];
  const pageMeta = [];
  const failures = [];
  for (const page of results) {
    if (!page) continue;
    if (page.kind === 'error') {
      failures.push({ path: page.path, error: page.error || 'parse failed' });
      continue;
    }
    pageMeta.push({ path: page.path, title: page.title || '', kind: page.kind, updated: page.updated || '' });
    if (page.kind === 'api') apis.push(...(page.records || []));
    else if (page.kind === 'event') events.push(...(page.records || []));
    else if (page.kind === 'enum') {
      for (const group of page.records || []) {
        enums.push(group);
        group.values.forEach((v, i) => { v.id = 'enumv:' + (v.name || i).toLowerCase(); });
      }
    } else if (page.kind === 'doc') {
      if (NAV_PAGES.includes(page.path)) continue;
      docs.push({ page: page.path, title: page.title, sections: page.sections || [] });
    }
  }

  const modules = [];
  const seen = new Map();
  for (const rec of apis) {
    let mod = seen.get(rec.module);
    if (!mod) {
      mod = { module: rec.module, receiver: rec.receiver || '', moduleCn: rec.moduleCn || rec.module, page: rec.page, count: 0 };
      seen.set(rec.module, mod);
      modules.push(mod);
    }
    mod.count++;
  }
  modules.sort((a, b) => b.count - a.count || a.module.localeCompare(b.module));

  const updated = pageMeta.map((p) => p.updated).filter(Boolean).sort().pop() || '';
  const index = {
    meta: {
      source: BASE + ROOT,
      builtAt: new Date().toISOString(),
      wikiUpdated: updated,
      counts: {
        pages: pageMeta.length,
        apis: apis.length,
        params: apis.reduce((n, r) => n + (r.params ? r.params.length : 0), 0),
        events: events.length,
        enumGroups: enums.length,
        enumValues: enums.reduce((n, g) => n + g.values.length, 0),
        docs: docs.length,
      },
    },
    pages: pageMeta,
    modules,
    apis,
    events,
    enums,
    docs,
  };
  return { index: index, failures: failures };
}

export async function crawlWiki(options) {
  const o = options || {};
  const offline = o.offline === true;
  const cache = o.cacheDir || '_probe/pages';
  const concurrency = Math.max(1, Math.min(8, Number(o.concurrency) || 4));
  const log = typeof o.log === 'function' ? o.log : () => {};
  const onProgress = typeof o.onProgress === 'function' ? o.onProgress : () => {};
  const signal = o.signal;

  const homeFile = o.homeFile || path.join(cache, '..', 'home.html');
  let home;
  if (offline) home = await readFile(homeFile, 'utf8');
  else home = await fetchText(BASE + ROOT, { signal: signal });
  let pages = pageListFrom(home);
  if (offline) {
    const names = await readdir(cache);
    pages = names
      .filter((n) => n.endsWith('.html') && n !== 'home.html')
      .map((n) => ROOT + n.replace(/__/g, '/'))
      .sort();
  }
  log('pages: ' + pages.length);
  onProgress({ phase: 'list', done: 0, total: pages.length });

  const results = new Array(pages.length);
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    while (cursor < pages.length) {
      if (signal && signal.aborted) return;
      const idx = cursor++;
      const pagePath = pages[idx];
      try {
        let html;
        if (offline) {
          const file = path.join(cache, cacheName(pagePath));
          if (!existsSync(file)) throw new Error('missing cached page ' + file);
          html = await readFile(file, 'utf8');
        } else {
          html = await fetchText(BASE + pagePath, { signal: signal });
        }
        results[idx] = parsePage({ path: pagePath, html: html });
      } catch (err) {
        const message = String(err && err.message ? err.message : err);
        log('FAILED ' + pagePath + ' ' + message);
        results[idx] = { path: pagePath, kind: 'error', error: message };
      }
      done++;
      onProgress({ phase: 'pages', done: done, total: pages.length });
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  if (signal && signal.aborted) throw new Error('crawl aborted');
  return assemble(results);
}

export async function writeIndex(file, index) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(index), 'utf8');
  return JSON.stringify(index).length;
}