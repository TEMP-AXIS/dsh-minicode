import { apply } from '../index.js';

const tools = new Map();
let apiHandler = null;
const ctx = {
  tools: { register(def) { tools.set(def.name, def); } },
  logger: () => ({ debug() {}, info() {}, warn() {}, error() {} }),
  effect() {},
  inject(deps, cb) {
    const sub = { webServer: { register(route) { apiHandler = route; return () => {}; } }, effect() {} };
    cb(sub);
  },
};

apply(ctx);
console.log('tools:', [...tools.keys()].join(','));
console.log('api prefix:', apiHandler && apiHandler.path, typeof apiHandler.handler);

function run(name, args) {
  const def = tools.get(name);
  const value = def.execute(args);
  const block = value && typeof value.then === 'function' ? null : value;
  return block;
}

// asynchronous tool outputs are fine here: every execute is synchronous
console.log('--- ugc_ids miss');
console.log(run('ugc_ids', { action: 'lookup', kind: 'comp', name: '计分板' }).text);
console.log('--- ugc_ids set');
console.log(run('ugc_ids', { action: 'set', kind: 'comp', name: '计分板', value: '77', note: '玩家提供' }).text);
console.log('--- ugc_ids lookup again');
console.log(run('ugc_ids', { action: 'lookup', kind: 'comp', name: '计分板' }).text);
console.log('--- ugc_memory add');
console.log(run('ugc_memory', { action: 'add', topic: 'SetTeam 参数顺序', wrong: '第一个参数传玩家 objid', right: 'Actor:SetTeam(objid, teamId) 玩家在前队伍在后', tags: 'team actor' }).text);
console.log('--- ugc_search with memory');
console.log(run('ugc_search', { q: 'SetTeam', limit: 3 }).text);
console.log('--- ugc_search no hit records miss');
console.log(run('ugc_search', { q: '不存在的词语' }).text);
console.log('--- ugc_template list');
console.log(run('ugc_template', { action: 'list' }).text.slice(0, 400));
console.log('--- ugc_template get player-join');
console.log(run('ugc_template', { action: 'get', id: 'player-join' }).text.split('\n').slice(0, 4).join('\n'));
console.log('--- ugc_guide tail');
console.log(run('ugc_guide', {}).text.split('\n').slice(-8).join('\n'));
console.log('--- ugc_status');
console.log(run('ugc_status', {}).text);

function call(method, url, body) {
  return new Promise((resolve) => {
    const req = { method, url, on(event, fn) { if (event === 'end') fn(); }, destroy() {} };
    const res = {
      statusCode: 0,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(text) { resolve({ status: this.statusCode, body: JSON.parse(text || '{}') }); },
    };
    
    apiHandler.handler(req, res);
  });
}

const status = await call('GET', '/ugc-wiki/api/status');
console.log('--- api status', status.status, JSON.stringify(status.body.index.counts), JSON.stringify(status.body.memory));
const ids = await call('GET', '/ugc-wiki/api/ids');
console.log('--- api ids', ids.status, ids.body.items.length, ids.body.kinds.length);
const tpl = await call('GET', '/ugc-wiki/api/templates');
console.log('--- api templates', tpl.status, tpl.body.items.length);
const harvest = await call('POST', '/ugc-wiki/api/harvest');
console.log('--- api harvest', harvest.status, JSON.stringify(harvest.body.merged), JSON.stringify(harvest.body.mentions));
const mem = await call('GET', '/ugc-wiki/api/memory');
console.log('--- api memory', mem.status, mem.body.items.length, mem.body.misses.length);
const crawl = await call('GET', '/ugc-wiki/api/crawl');
console.log('--- api crawl', crawl.status, JSON.stringify(crawl.body.crawl.state));
const bad = await call('GET', '/ugc-wiki/api/nope');
console.log('--- api unknown', bad.status, bad.body.error);