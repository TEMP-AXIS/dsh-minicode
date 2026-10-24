// The HTTP surface behind the Settings page.  Everything the page can do is one
// JSON call: read the index status, start a manual crawl, mine ids out of the
// corpus, and edit the memory / template / id registries.
import { crawlWiki, writeIndex } from './crawl.mjs';
import { harvest } from './harvest.mjs';
import { crawledIndexFile } from './paths.mjs';
import * as M from './memory.mjs';
import * as T from './templates.mjs';
import * as I from './ids.mjs';
import { getConfig, updateConfig } from './config.mjs';
import { syncOfficial } from './idsource.mjs';
import { fail, ok, queryOf, readJsonBody, subPath } from './web.mjs';

export const PREFIX = '/ugc-wiki/api';
export const API_PREFIX = PREFIX;

let job = { state: 'idle', startedAt: '', finishedAt: '', done: 0, total: 0, message: '', counts: null, failures: [] };
let controller = null;

// Official id tables are a second, slow network job (eight pages), so it gets its
// own state instead of piggy-backing on the crawl job the page is polling.
let idJob = { state: 'idle', startedAt: '', finishedAt: '', done: 0, total: 0, message: '', result: null };
let idController = null;

export function idSyncState() {
  return {
    state: idJob.state,
    startedAt: idJob.startedAt,
    finishedAt: idJob.finishedAt,
    done: idJob.done,
    total: idJob.total,
    message: idJob.message,
    result: idJob.result,
  };
}

/** Download the official id tables in the background. */
export function startIdSync(deps) {
  if (idJob.state === 'running') return { started: false, error: 'official id sync already running' };
  idController = new AbortController();
  idJob = { state: 'running', startedAt: new Date().toISOString(), finishedAt: '', done: 0, total: 0, message: 'fetching official id tables', result: null };
  const runner = async () => {
    try {
      const result = await syncOfficial({
        signal: idController.signal,
        log: (line) => {
          idJob.message = String(line);
          deps.log('ids: ' + line);
        },
        onProgress: (p) => {
          idJob.done = p.done;
          idJob.total = p.total;
          idJob.message = 'id table ' + p.done + '/' + p.total;
        },
      });
      idJob.result = result;
      idJob.state = result.failures.length && !result.fetched ? 'error' : 'done';
      idJob.message = 'imported ' + result.fetched + ' official ids (' + (result.merged ? result.merged.total : 0) + ' total)';
    } catch (err) {
      idJob.state = 'error';
      idJob.message = String(err && err.message ? err.message : err);
      deps.log('ids failed: ' + idJob.message);
    } finally {
      idJob.finishedAt = new Date().toISOString();
      idController = null;
    }
  };
  runner().catch(() => {});
  return { started: true };
}

export function crawlState() {
  return {
    state: job.state,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    done: job.done,
    total: job.total,
    message: job.message,
    counts: job.counts,
    failures: job.failures,
  };
}

export function cancelCrawl() {
  if (controller && job.state === 'running') {
    controller.abort();
    job.message = 'cancelled by user';
    return true;
  }
  return false;
}

/** Start a crawl in the background; the page polls GET /crawl for progress. */
export function startCrawl(deps, mode) {
  if (job.state === 'running') return { started: false, error: 'a crawl is already running' };
  const offline = mode === 'offline';
  controller = new AbortController();
  job = { state: 'running', startedAt: new Date().toISOString(), finishedAt: '', done: 0, total: 0, message: 'fetching page list', counts: null, failures: [] };
  const runner = async () => {
    try {
      const result = await crawlWiki({
        offline: offline,
        cacheDir: deps.cacheDir,
        homeFile: deps.homeFile,
        signal: controller.signal,
        log: (line) => { job.message = String(line); deps.log('crawl: ' + line); },
        onProgress: (p) => {
          job.done = p.done;
          job.total = p.total;
          job.message = p.phase === 'list' ? 'page list: ' + p.total : 'page ' + p.done + '/' + p.total;
        },
      });
      const file = crawledIndexFile();
      const bytes = await writeIndex(file, result.index);
      job.counts = result.index.meta.counts;
      job.failures = result.failures;
      job.state = result.failures.length && !result.index.apis.length ? 'error' : 'done';
      job.message = job.state === 'done'
        ? 'wrote ' + Math.round(bytes / 1024) + ' KiB, ' + result.index.apis.length + ' apis'
        : 'crawl finished with no usable pages';
      deps.reloadStore();
      // A fresh crawl is the natural moment to refresh the official id tables too;
      // it is a separate network job so the page can watch it independently.
      if (getConfig().autoIds && !controller.signal.aborted) startIdSync(deps);
      else deps.log('crawl: official id sync skipped (autoIds off)');
    } catch (err) {
      job.state = 'error';
      job.message = String(err && err.message ? err.message : err);
      deps.log('crawl failed: ' + job.message);
    } finally {
      job.finishedAt = new Date().toISOString();
      controller = null;
    }
  };
  runner().catch(() => {});
  return { started: true };
}

function statusPayload(deps) {
  const info = deps.indexInfo();
  return {
    index: {
      path: info.path,
      source: info.source,
      builtAt: info.meta.builtAt,
      wikiUpdated: info.meta.wikiUpdated,
      counts: info.meta.counts,
      bytes: info.bytes,
      pages: info.pages,
    },
    crawl: crawlState(),
    official: idSyncState(),
    config: getConfig(),
    memory: M.memoryStats(),
    templates: T.templateStats(),
    ids: I.idStats(),
    dataDir: deps.dataDir(),
  };
}

async function handleMemory(req, res, url, body) {
  if (req.method === 'GET') {
    const q = queryOf(url);
    const list = M.listMemory({ q: q.q, limit: 200 });
    return ok(res, { items: list.items, total: list.total, misses: list.misses, stats: M.memoryStats() });
  }
  const action = String(body.action || '');
  if (action === 'add') {
    const item = M.addMemory({ topic: body.topic, wrong: body.wrong, right: body.right, tags: body.tags, pinned: body.pinned === true });
    return ok(res, { item: item, items: M.listMemory({ limit: 200 }).items });
  }
  if (action === 'update') {
    const item = M.addMemory({ topic: body.topic, wrong: body.wrong, right: body.right, tags: body.tags, pinned: body.pinned === true });
    return ok(res, { item: item, items: M.listMemory({ limit: 200 }).items });
  }
  if (action === 'delete') return ok(res, { removed: M.removeMemory(body.id) });
  if (action === 'pin') {
    const item = M.pinMemory(body.id, body.pinned !== false);
    if (!item) return fail(res, 404, 'no memory item ' + body.id);
    return ok(res, { item: item });
  }
  if (action === 'clear-misses') {
    M.clearMisses();
    return ok(res, {});
  }
  if (action === 'drop-miss') {
    return ok(res, { removed: M.removeMiss(body.q, body.kind) });
  }
  if (action === 'promote-miss') {
    const item = M.addMemory({ topic: body.q, wrong: body.wrong || '', right: body.right || '', tags: body.tags || '', pinned: false });
    M.removeMiss(body.q, body.kind);
    return ok(res, { item: item });
  }
  return fail(res, 400, 'unknown memory action: ' + action);
}

async function handleTemplates(req, res, url, body) {
  if (req.method === 'GET') {
    const q = queryOf(url);
    if (q.id) {
      const item = T.getTemplate(q.id);
      if (!item) return fail(res, 404, 'no template ' + q.id);
      return ok(res, { item: item });
    }
    const items = T.listTemplates().map((t) => ({ id: t.id, name: t.name, desc: t.desc, tags: t.tags, builtin: t.builtin === true, updated: t.updated, chars: (t.code || '').length }));
    return ok(res, { items: items });
  }
  const action = String(body.action || '');
  if (action === 'save') return ok(res, { item: T.saveTemplate(body) });
  if (action === 'delete') return ok(res, { removed: T.removeTemplate(body.id) });
  return fail(res, 400, 'unknown template action: ' + action);
}

async function handleIds(deps, req, res, url, body) {
  if (req.method === 'GET') {
    const q = queryOf(url);
    const list = I.listIds({ q: q.q, kind: q.kind, limit: 500 });
    return ok(res, { items: list.items, total: list.total, pending: list.pending, kinds: I.KINDS, stats: I.idStats(), sync: idSyncState() });
  }
  const action = String(body.action || '');
  if (action === 'set') {
    const item = I.setId({ kind: body.kind, name: body.name, value: body.value, note: body.note });
    return ok(res, { item: item, stats: I.idStats() });
  }
  if (action === 'delete') return ok(res, { removed: I.removeId(body.key || body.id) });
  if (action === 'request') return ok(res, { item: I.requestId({ kind: body.kind, name: body.name, hint: body.hint }) });
  if (action === 'dismiss') return ok(res, { removed: I.dismissPending(body.id) });
  if (action === 'sync-official') {
    const started = startIdSync(deps);
    if (!started.started) return fail(res, 409, started.error);
    return ok(res, { sync: idSyncState(), stats: I.idStats() });
  }
  return fail(res, 400, 'unknown id action: ' + action);
}

export function createApi(deps) {
  return async function handle(req, res) {
    const url = String(req.url || '');
    const route = subPath(url, PREFIX);
    try {
      if (route === '/status' && req.method === 'GET') return ok(res, statusPayload(deps));

      if (route === '/crawl') {
        if (req.method === 'GET') return ok(res, { crawl: crawlState() });
        if (req.method === 'POST') {
          const body = await readJsonBody(req).catch(() => ({}));
          const started = startCrawl(deps, body.mode === 'offline' ? 'offline' : 'live');
          if (!started.started) return fail(res, 409, started.error);
          return ok(res, { crawl: crawlState() });
        }
      }
      if (route === '/crawl/cancel' && req.method === 'POST') {
        return ok(res, { cancelled: cancelCrawl(), crawl: crawlState() });
      }

      if (route === '/harvest' && req.method === 'POST') {
        const info = deps.indexInfo();
        const found = harvest(info.index);
        const merged = I.harvestIds(found.ids);
        return ok(res, { found: found.ids.length, merged: merged, mentions: found.mentions, ids: found.ids });
      }

      if (route === '/settings') {
        if (req.method === 'GET') return ok(res, { config: getConfig() });
        if (req.method === 'POST') {
          const body = await readJsonBody(req).catch(() => ({}));
          return ok(res, { config: updateConfig(body) });
        }
      }

      if (route === '/memory') return await handleMemory(req, res, url, req.method === 'GET' ? {} : await readJsonBody(req));
      if (route === '/templates') return await handleTemplates(req, res, url, req.method === 'GET' ? {} : await readJsonBody(req));
      if (route === '/ids') return await handleIds(deps, req, res, url, req.method === 'GET' ? {} : await readJsonBody(req));

      return fail(res, 404, 'unknown route ' + route);
    } catch (err) {
      deps.log('api error on ' + route + ': ' + String(err && err.message ? err.message : err));
      return fail(res, 500, String(err && err.message ? err.message : err));
    }
  };
}