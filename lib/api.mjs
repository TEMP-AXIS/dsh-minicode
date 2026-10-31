// The HTTP surface behind the Settings page. Everything the page can do is one
// JSON call: read the index status and edit the memory / template / id
// registries. The plugin never reaches the network on its own — the index and
// the id tables ship inside the bundle.
import * as M from './memory.mjs';
import * as T from './templates.mjs';
import * as I from './ids.mjs';
import { getConfig, updateConfig } from './config.mjs';
import { checkForUpdate, updateInfo } from './update.mjs';
import { fail, ok, queryOf, readJsonBody, subPath } from './web.mjs';

export const PREFIX = '/dsh-minicode/api';
export const API_PREFIX = PREFIX;

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
    config: getConfig(),
    update: updateInfo(),
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
  // Writes belong to the agent (ugc_memory action=add) or to a pull request against
  // builtin/memory/*.json; the Settings page is a read-only view.
  if (action === 'add' || action === 'update' || action === 'promote-miss') {
    return fail(res, 403, '记忆由 AI 写入（ugc_memory action=add）；设置页只读，人工补条目请改 builtin/memory/*.json 提 PR');
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
  if (action === 'save') {
    return fail(res, 403, '模板由 AI 保存（ugc_template action=save）；设置页只读，人工加模板请改 builtin/templates/*.lua 提 PR');
  }
  if (action === 'delete') return ok(res, { removed: T.removeTemplate(body.id) });
  return fail(res, 400, 'unknown template action: ' + action);
}

async function handleIds(req, res, url, body) {
  if (req.method === 'GET') {
    const q = queryOf(url);
    const list = I.listIds({ q: q.q, kind: q.kind, source: q.source, limit: 500 });
    return ok(res, { items: list.items, total: list.total, pending: list.pending, kinds: I.KINDS, stats: I.idStats() });
  }
  const action = String(body.action || '');
  if (action === 'set') {
    const item = I.setId({ kind: body.kind, name: body.name, value: body.value, note: body.note });
    return ok(res, { item: item, stats: I.idStats() });
  }
  if (action === 'delete') return ok(res, { removed: I.removeId(body.key || body.id) });
  if (action === 'request') return ok(res, { item: I.requestId({ kind: body.kind, name: body.name, hint: body.hint }) });
  if (action === 'dismiss') return ok(res, { removed: I.dismissPending(body.id) });
  return fail(res, 400, 'unknown id action: ' + action);
}

export function createApi(deps) {
  return async function handle(req, res) {
    const url = String(req.url || '');
    const route = subPath(url, PREFIX);
    try {
      if (route === '/status' && req.method === 'GET') return ok(res, statusPayload(deps));

      if (route === '/update') {
        if (req.method === 'GET') return ok(res, { update: updateInfo() });
        if (req.method === 'POST') {
          const body = await readJsonBody(req).catch(() => ({}));
          const state = await checkForUpdate({ force: body.force !== false });
          return ok(res, { update: state });
        }
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
      if (route === '/ids') return await handleIds(req, res, url, req.method === 'GET' ? {} : await readJsonBody(req));

      return fail(res, 404, 'unknown route ' + route);
    } catch (err) {
      deps.log('api error on ' + route + ': ' + String(err && err.message ? err.message : err));
      return fail(res, 500, String(err && err.message ? err.message : err));
    }
  };
}
