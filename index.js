// dsh-minicode — offline MiniWorld UGC wiki lookup for the DSH agent.
//
// The heavy lifting happens once: lib/crawl.mjs downloads
// https://dev-wiki.mini1.cn/ugc-wiki/ and lib/store.mjs turns it into one compact
// JSON index. This module serves that index as cheap text answers, and adds three
// things the wiki cannot know: the learned corrections in lib/memory.mjs, the
// reusable script skeletons in lib/templates.mjs, and the id registry in
// lib/ids.mjs (an id the wiki never publishes must come from the player).
import { fileURLToPath } from 'node:url';
import { appendFileSync, existsSync } from 'node:fs';
import { loadStore, searchApis, searchEvents, searchEnums, findDoc, moduleOf, taskTerms, rankByTerms } from './lib/store.mjs';
import * as F from './lib/format.mjs';
import * as M from './lib/memory.mjs';
import * as T from './lib/templates.mjs';
import * as I from './lib/ids.mjs';
import { crawledIndexFile, dataDir, debugFile } from './lib/paths.mjs';
import { getConfig } from './lib/config.mjs';
import { seedFromBundle } from './lib/idsource.mjs';
import { REPO_URL, STAR_URL, ISSUE_URL, refreshInBackground, updateInfo } from './lib/update.mjs';
import { API_PREFIX, createApi } from './lib/api.mjs';

export const name = 'dsh-minicode';
export const inject = ['tools'];

const BUNDLED_INDEX = fileURLToPath(new URL('./data/ugc-wiki.json', import.meta.url));
const PROJECT_DIR = fileURLToPath(new URL('./', import.meta.url));

let cachedStore = null;
let cachedPath = '';

/** A manual crawl writes index.json into the data directory; it wins. */
function indexPath() {
  try {
    const crawled = crawledIndexFile();
    if (existsSync(crawled)) return crawled;
  } catch {
    /* unwritable data dir: stay on the bundled index */
  }
  return BUNDLED_INDEX;
}

function store() {
  const file = indexPath();
  if (!cachedStore || cachedPath !== file) {
    cachedStore = loadStore(file);
    cachedPath = file;
  }
  return cachedStore;
}

function reloadStore() {
  cachedStore = null;
  cachedPath = '';
}

function indexInfo() {
  const s = store();
  return {
    path: cachedPath,
    source: cachedPath === BUNDLED_INDEX ? 'bundled' : 'crawled',
    meta: s.meta,
    bytes: s.bytes,
    pages: s.pages.length,
    index: { apis: s.apis, events: s.events, docs: s.docs },
  };
}

/** Every tool returns exactly one model-facing text block. */
const OUTPUT = {
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: { text: { type: 'string' } },
    required: ['text'],
  },
  render: (_args, value) => [{ type: 'text', text: value.text }],
};

function present(title) {
  return (args) => ({ card: 'generic', title: title, kind: 'other', rawInput: args });
}

function int(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function listModules(s) {
  return s.modules.map((m) => m.module + '(' + m.count + ')').join(' ');
}

function noHit(what, hint) {
  return 'no ' + what + ' matched. ' + hint;
}

/** The corrections that look relevant to this query, ready to append to an answer. */
function memoryBlock(query, limit) {
  const items = M.matchMemory(query, limit || 2);
  if (!items.length) return '';
  const lines = items.map((item) => {
    const wrong = item.wrong ? '（常见错误: ' + F.trunc(item.wrong, 60) + '）' : '';
    return '- ' + (item.topic || '记忆') + ': ' + F.trunc(item.right, 120) + wrong;
  });
  return '\n\n已知易错点:\n' + lines.join('\n');
}
export function apply(ctx) {
  // First run on this machine: fill the id registry from the shipped snapshot of
  // the official tables, so ugc_ids works before anything is crawled.
  try {
    const seeded = seedFromBundle();
    const target = debugFile();
    if (seeded && target) {
      appendFileSync(target, 'dsh-minicode seeded ' + seeded.seeded + ' official ids\n');
    }
  } catch {
    /* an unwritable data dir just means ids stay empty until the player fills them */
  }
  // Automatic update check: one GitHub read at boot, and only when the cached
  // answer is older than six hours.  It never runs on a tool call, and the
  // Settings page can switch it off (autoUpdate).
  if (getConfig().autoUpdate) {
    const trace = (message) => {
      const target = debugFile();
      if (!target) return;
      try { appendFileSync(target, 'dsh-minicode ' + message + '\n'); } catch { /* best effort */ }
    };
    refreshInBackground(trace).catch(() => {});
  }
  ctx.tools.register({
    name: 'ugc_search',
    description: 'Search the MiniWorld UGC wiki for API functions and events by name or Chinese description. Returns one line per hit (id, signature, return type, short desc); follow up with ugc_api. Use when you know what a function does but not its exact name.',
    parameters: {
      q: { type: 'string', required: true, description: 'Name fragment (SetItem, GetPosition) or Chinese description (获取坐标, 队伍).' },
      kind: { type: 'string', enum: ['api', 'event', 'any'], description: 'Restrict to functions, events, or both (default any).' },
      module: { type: 'string', description: 'Optional module filter: actor, Actor, player, world, customui, ...' },
      limit: { type: 'integer', description: 'Max hits (default 8, max 30).' },
    },
    output: OUTPUT,
    execute(args) {
      const s = store();
      const q = String(args.q || '').trim();
      if (!q) throw new Error('ugc_search needs q');
      const limit = int(args.limit, 8, 1, 30);
      const kind = args.kind || 'any';
      const out = [];
      let total = 0;
      if (kind !== 'event') {
        const hits = searchApis(s, q, { module: args.module });
        total += hits.length;
        for (const hit of hits.slice(0, limit)) out.push(F.apiLine(hit.rec));
      }
      if (kind !== 'api') {
        const hits = searchEvents(s, q);
        total += hits.length;
        const room = Math.max(0, limit - out.length + (kind === 'event' ? limit : 0));
        if (kind === 'event') {
          for (const hit of hits.slice(0, limit)) out.push(F.eventLine(hit.rec));
        } else {
          for (const hit of hits.slice(0, Math.min(room, 3))) out.push('event ' + F.eventLine(hit.rec));
        }
      }
      if (!out.length) {
        M.recordMiss(q, 'search');
        return {
          text: noHit('entry for "' + q + '"', 'Try a shorter fragment, a Chinese verb (获取/设置), or ugc_module to browse one module.') + memoryBlock(q),
        };
      }
      const head = total + ' hit(s) for "' + q + '":';
      const tail = total > out.length ? '\n… ' + (total - out.length) + ' more (raise limit or add module=)' : '';
      return { text: head + '\n' + out.join('\n') + tail + '\n(ugc_api id= for the full card)' + memoryBlock(q) };
    },
    presentCall: present('UGC wiki search'),
  });

  ctx.tools.register({
    name: 'ugc_api',
    description: 'Full documentation card for one MiniWorld UGC API function: signature, parameters with types, return value, notes and a Lua example. Pass the id from ugc_search (actor:setteam) or the bare name when it is unique (SetTeam).',
    parameters: {
      id: { type: 'string', required: true, description: 'Record id (actor:setteam) or function name (SetTeam).' },
      example: { type: 'boolean', description: 'Include the wiki Lua example (default true).' },
    },
    output: OUTPUT,
    execute(args) {
      const s = store();
      const key = String(args.id || '').trim();
      if (!key) throw new Error('ugc_api needs id');
      const withExample = args.example === false ? 0 : 700;
      const direct = s.byId.get(key.toLowerCase());
      if (direct) {
        if (direct.kind === 'event') return { text: F.eventCard(direct) + memoryBlock(key, 1) };
        return { text: F.apiCard(direct, { exampleLimit: withExample }) + memoryBlock(key, 1) };
      }
      const byName = s.apiByName.get(key.toLowerCase()) || [];
      const byEvent = s.eventByName.get(key.toLowerCase()) || [];
      const all = byName.concat(byEvent);
      if (all.length === 1) {
        const rec = all[0];
        return { text: (rec.kind === 'event' ? F.eventCard(rec) : F.apiCard(rec, { exampleLimit: withExample })) + memoryBlock(key, 1) };
      }
      if (all.length > 1) {
        const lines = all.map((r) => F.apiLine(r));
        const hint = M.matchMemory(key, 1).map((item) => '\n记忆: ' + item.topic + ' -> ' + F.trunc(item.right, 100)).join('');
        return { text: 'ambiguous "' + key + '" — pick an id:\n' + lines.join('\n') + hint };
      }
      M.recordMiss(key, 'api');
      return { text: noHit('api "' + key + '"', 'Use ugc_search q=' + key + ' first.') };
    },
    presentCall: present('UGC wiki API'),
  });

  ctx.tools.register({
    name: 'ugc_module',
    description: 'List every function of one MiniWorld module (actor, player, world, block, customui, backpack, item, ...). Cheaper than many searches when you work inside a single object: one line per function with signature, return type and short description.',
    parameters: {
      module: { type: 'string', required: true, description: 'Module name: actor, Actor, player, world, customui, backpack, item, block, area, monster, buff, timer, graphic, ...' },
      withParams: { type: 'boolean', description: 'Show parameter names and types instead of the description (default false).' },
    },
    output: OUTPUT,
    execute(args) {
      const s = store();
      const mod = moduleOf(s, args.module);
      if (!mod) {
        return { text: 'unknown module "' + String(args.module) + '". Available: ' + listModules(s) + '\nProse pages: ' + s.docs.map((d) => d.page.replace('/ugc-wiki/', '')).join(' ') };
      }
      return { text: F.moduleSheet(s, mod, { withParams: args.withParams === true }) };
    },
    presentCall: present('UGC wiki module'),
  });

  ctx.tools.register({
    name: 'ugc_event',
    description: 'Look up MiniWorld script events: their exact name (TriggerEvent.GameStart), when they fire, and the arguments the handler receives. Call with no arguments to list the event modules.',
    parameters: {
      name: { type: 'string', description: 'Exact or partial event name, e.g. PlayerEnterGame or ObjectEvent.PlayerEnterGame.' },
      q: { type: 'string', description: 'Free-text search over event names and descriptions (Chinese ok).' },
      limit: { type: 'integer', description: 'Max hits (default 10, max 40).' },
    },
    output: OUTPUT,
    execute(args) {
      const s = store();
      const limit = int(args.limit, 10, 1, 40);
      const name = String(args.name || '').trim();
      const q = String(args.q || '').trim();
      if (name && s.eventByName.has(name.toLowerCase())) {
        return { text: (s.eventByName.get(name.toLowerCase()) || []).map((r) => F.eventCard(r)).join('\n\n') };
      }
      const query = name || q;
      if (!query) {
        const counts = {};
        for (const ev of s.events) counts[ev.module] = (counts[ev.module] || 0) + 1;
        const mods = Object.keys(counts).map((k) => k + ' (' + counts[k] + ')').join(', ');
        return { text: 'event modules: ' + mods + '\nquery with ugc_event q=玩家 进入 游戏, or name=GameStart.' };
      }
      const hits = searchEvents(s, query);
      if (!hits.length) {
        M.recordMiss(query, 'event');
        return { text: noHit('event for "' + query + '"', 'Try a shorter fragment or Chinese keywords (进入, 死亡, 点击).') };
      }
      const lines = hits.slice(0, limit).map((h) => F.eventLine(h.rec));
      return { text: hits.length + ' event(s) for "' + query + '":\n' + lines.join('\n') + '\n(ugc_api id= for arguments)' };
    },
    presentCall: present('UGC wiki event'),
  });

  ctx.tools.register({
    name: 'ugc_enum',
    description: 'Look up MiniWorld constant enums (WorldType, AbsoluteCampType, ...) and their values with Chinese descriptions. Call with no arguments to list all enum names.',
    parameters: {
      name: { type: 'string', description: 'Enum group name or fragment, e.g. 游戏模式, WorldType, 阵营.' },
      q: { type: 'string', description: 'Search over both group names and individual value names/descriptions.' },
      limit: { type: 'integer', description: 'Max values printed per group (default 60).' },
    },
    output: OUTPUT,
    execute(args) {
      const s = store();
      const name = String(args.name || '').trim();
      const q = String(args.q || '').trim();
      const limit = int(args.limit, 60, 1, 200);
      if (!name && !q) {
        return { text: s.enums.length + ' enum groups:\n' + s.enums.map((g) => g.name + '(' + g.values.length + ')').join(' ') };
      }
      const query = name || q;
      const groups = searchEnums(s, query);
      if (!groups.length) {
        M.recordMiss(query, 'enum');
        const names = s.enums.map((g) => g.name).join(' ');
        return { text: noHit('enum for "' + query + '"', 'Known groups: ' + names) };
      }
      const blocks = groups.slice(0, name ? 3 : 6).map((hit) => F.enumBlock(hit.group, hit.values, limit));
      return { text: blocks.join('\n\n') };
    },
    presentCall: present('UGC wiki enum'),
  });

  ctx.tools.register({
    name: 'ugc_doc',
    description: 'Read a prose page of the MiniWorld UGC wiki (tutorials, concepts, component APIs, changelog). Without section= it prints the outline plus the beginning of the page; with section= it prints just that section.',
    parameters: {
      page: { type: 'string', required: true, description: 'Page path or fragment: quickin/iteminst, introduction/componentapi, data_files/skybox, apis/update.' },
      section: { type: 'string', description: 'Section title or id fragment to print.' },
      maxChars: { type: 'integer', description: 'Character cap (default 4000, max 20000).' },
    },
    output: OUTPUT,
    execute(args) {
      const s = store();
      const doc = findDoc(s, args.page);
      if (!doc) {
        M.recordMiss(String(args.page || ''), 'doc');
        return { text: 'unknown page "' + String(args.page) + '". Pages:\n' + s.docs.map((d) => d.page + '  ' + d.title).join('\n') };
      }
      const cap = int(args.maxChars, 4000, 200, 20000);
      if (args.section) {
        const sections = F.sectionsOf(doc, args.section);
        if (!sections) return { text: 'no section "' + String(args.section) + '" in ' + doc.page + '\n' + F.docOutline(doc) };
        return { text: F.docText(doc, sections, cap) };
      }
      const total = (doc.sections || []).reduce((n, sec) => n + (sec.text || '').length, 0);
      if (total <= cap) return { text: F.docText(doc, doc.sections, cap) };
      return { text: F.docOutline(doc) + '\n\n' + F.docText(doc, doc.sections.slice(0, 2), Math.min(cap, 1200)) + '\n… pass section= for the rest' };
    },
    presentCall: present('UGC wiki page'),
  });

  ctx.tools.register({
    name: 'ugc_pack',
    description: 'Assemble a compact context pack for a whole task: extracts keywords from the task text, picks the matching API functions and events, and prints their signatures, parameters and notes within a character budget. Use once per task instead of dozens of lookups.',
    parameters: {
      task: { type: 'string', required: true, description: 'What you are trying to write, in Chinese or English, e.g. "玩家进入区域时给队伍加buff并弹出提示".' },
      budget: { type: 'integer', description: 'Character budget for the pack (default 1500, max 8000).' },
    },
    output: OUTPUT,
    execute(args) {
      const s = store();
      const task = String(args.task || '').trim();
      if (!task) throw new Error('ugc_pack needs task');
      const budget = int(args.budget, 1500, 300, 8000);
      const extracted = taskTerms(s, task);
      const terms = extracted.terms;
      const scored = rankByTerms(s, terms);
      const eventHits = rankByTerms(s, terms, s.events).slice(0, 4);
      const out = ['context pack: ' + F.trunc(task, 80) + '  (budget ' + budget + ' chars)'];
      let used = out[0].length;
      let count = 0;
      for (const hit of scored) {
        const block = F.apiCompact(hit.rec);
        if (used + block.length + 2 > budget && count > 0) break;
        out.push(block);
        used += block.length + 2;
        count++;
        if (count >= 25) break;
      }
      if (eventHits.length) {
        const joined = eventHits.map((h) => 'event ' + F.eventLine(h.rec)).join('\n');
        if (used + joined.length < budget) {
          out.push(joined);
          used += joined.length;
        }
      }
      if (count === 0) out.push('(no api matched the task wording; use ugc_search with a function name)');
      const memory = memoryBlock(task, 3);
      if (memory) out.push(memory.trim());
      out.push('(' + count + ' api cards, ' + used + ' chars; ugc_api id= for examples, ugc_module to browse a module, ugc_template for a script skeleton)');
      return { text: out.join('\n\n') };
    },
    presentCall: present('UGC context pack'),
  });
  ctx.tools.register({
    name: 'ugc_status',
    description: 'Report the wiki index, whether it was crawled manually, and the size of the memory / template / id stores. Use it to check that a manual crawl took effect.',
    parameters: {},
    output: OUTPUT,
    execute() {
      const s = store();
      const c = s.meta.counts || {};
      const info = indexInfo();
      const u = updateInfo();
      const lines = [
        'mini world ugc wiki index (' + info.source + ')',
        'source: ' + s.meta.source,
        'built: ' + s.meta.builtAt + '  wiki updated: ' + s.meta.wikiUpdated,
        'index: ' + Math.round(s.bytes / 1024) + ' KiB, ' + s.pages.length + ' pages  file: ' + info.path,
        'functions: ' + s.apis.length + ' (' + (c.params || 0) + ' params)  events: ' + s.events.length + '  enum groups: ' + s.enums.length + ' (' + (c.enumValues || 0) + ' values)  docs: ' + s.docs.length,
        'modules: ' + listModules(s),
        'memory: ' + JSON.stringify(M.memoryStats()) + '  templates: ' + JSON.stringify(T.templateStats()) + '  ids: ' + JSON.stringify(I.idStats()),
        'version: ' + u.local + (u.latest ? '  latest on github: ' + u.latest + (u.newer ? '  <-- newer available' : '  (up to date)') : ''),
      ];
      if (u.newer) lines.push('update: ' + REPO_URL + '  (star ' + STAR_URL + ', issues ' + ISSUE_URL + ')');
      if (u.error) lines.push('update check: ' + u.error);
      return { text: lines.join('\n') };
    },
    presentCall: present('UGC wiki status'),
  });

  ctx.tools.register({
    name: 'ugc_guide',
    description: 'MiniWorld UGC scripting conventions: behaviour-script skeleton, trigger registration, engine singletons, enums, the id rule (never invent an id) and which lookup tool to use when. Read this once before writing a mini-world script.',
    parameters: {},
    output: OUTPUT,
    execute() {
      const pinned = M.pinnedMemory(8);
      const lines = [
        F.GUIDE,
        '',
        '该地图的补充规则：',
        '- 动手前先 ugc_pack(任务) 抓一份上下文；写完整脚本从 ugc_template 取骨架（' + T.listTemplates().filter((t) => t.builtin).map((t) => t.id).join(' / ') + '）。',
        '- 任何 id（道具/方块/特效/音效/生物/粒子/变量/元件/自定义）都用 ugc_ids(action=lookup) 查真实值。',
        '- 查不到时绝不要编造数字，也不要猜：告诉玩家去 设置 → UGC 百科 → ID 登记 填写，登记请求会自动出现。',
        '- 玩家给了值以后用 ugc_ids(action=set) 存下来，之后同一 id 就能直接命中。',
        '- 被现实纠正过的写法在 ugc_search / ugc_pack 的结果末尾会自动附上，看到就以它为准。',
      ];
      // The two "the agent maintains it by itself" switches.  They only change
      // what the agent volunteers; the tools stay usable either way.
      const cfg = getConfig();
      if (cfg.autoMemory) {
        lines.push('- 自动记忆已开启：一次任务里只要出现过「以为是这样、实际是那样」的修正（参数顺序、变量名、接口不存在），收尾时自己用 ugc_memory(action=add) 记一条 topic/wrong/right/tags，不用问玩家。');
      } else {
        lines.push('- 自动记忆已关闭：不要主动写记忆，玩家明确要求时才用 ugc_memory(action=add)。');
      }
      if (cfg.autoTemplates) {
        lines.push('- 自动模板已开启：写出并验证过的脚本，自己用 ugc_template(action=save) 存成模板（name/desc/code/tags）；同类任务先 action=list 看有没有现成的。');
      } else {
        lines.push('- 自动模板已关闭：不要主动存模板，玩家明确要求时才用 ugc_template(action=save)。');
      }
      if (pinned.length) {
        lines.push('', '置顶的易错点：');
        for (const item of pinned) lines.push('- ' + item.topic + ': ' + F.trunc(item.right, 160));
      }
      return { text: lines.join('\n') };
    },
    presentCall: present('UGC scripting guide'),
  });

  ctx.tools.register({
    name: 'ugc_memory',
    description: 'Remember the mistakes that keep coming back. action=add stores a correction (topic + what was wrong + what is right); corrections are then appended automatically to matching ugc_search / ugc_pack answers. Use list/search to review, pin to always show in ugc_guide, clear-misses to reset the log of unanswered lookups.',
    parameters: {
      action: { type: 'string', required: true, enum: ['add', 'list', 'search', 'delete', 'pin', 'unpin', 'clear-misses'], description: 'What to do.' },
      topic: { type: 'string', description: 'add: short subject, e.g. "SetTeam 参数顺序".' },
      wrong: { type: 'string', description: 'add: the wrong habit to avoid.' },
      right: { type: 'string', description: 'add: the correct fact or code shape.' },
      tags: { type: 'string', description: 'add: space separated tags for matching (team actor 坐标).' },
      id: { type: 'string', description: 'delete/pin/unpin: memory id from the list.' },
      q: { type: 'string', description: 'search: free text.' },
    },
    output: OUTPUT,
    execute(args) {
      const action = String(args.action || '').trim();
      if (action === 'add') {
        const item = M.addMemory({ topic: args.topic, wrong: args.wrong, right: args.right, tags: args.tags });
        return { text: '记住 #' + item.id + ' ' + item.topic + ' -> ' + F.trunc(item.right, 120) };
      }
      if (String(args.id || '').startsWith('builtin:')) {
        return { text: '内置记忆只读（随插件发布，改不了也删不掉）：' + String(args.id) };
      }
      if (action === 'delete') {
        const removed = M.removeMemory(args.id);
        return { text: removed ? '已删除 #' + args.id : '没有 #' + String(args.id) };
      }
      if (action === 'pin' || action === 'unpin') {
        const item = M.pinMemory(args.id, action === 'pin');
        if (!item) return { text: '没有 #' + String(args.id) };
        return { text: (item.pinned ? '已置顶 ' : '已取消置顶 ') + '#' + item.id + ' ' + item.topic };
      }
      if (action === 'clear-misses') {
        M.clearMisses();
        return { text: '已清空未命中记录' };
      }
      const list = M.listMemory({ q: action === 'search' ? args.q : '', limit: 40 });
      if (!list.items.length && !list.misses.length) return { text: '记忆为空。用 ugc_memory action=add 记一条。' };
      const lines = [];
      if (list.items.length) {
        lines.push(list.items.length + ' 条记忆（[内置] 随插件发布，只读）：');
        for (const item of list.items) {
          const flags = (item.builtin ? ' [内置]' : '') + (item.pinned ? ' [置顶]' : '') + (item.hits ? ' 命中' + item.hits + '次' : '');
          lines.push('- #' + item.id + ' ' + item.topic + flags + '\n  错误: ' + F.trunc(item.wrong || '(未填)', 90) + '\n  正确: ' + F.trunc(item.right, 140));
        }
      }
      if (list.misses.length) {
        lines.push('', '查不到的问题（可在 设置 → UGC 百科 → 记忆 里转成记忆）：');
        for (const miss of list.misses.slice(0, 20)) lines.push('- ' + miss.q + ' (' + miss.kind + ' x' + (miss.count || 1) + ')');
      }
      return { text: lines.join('\n') };
    },
    presentCall: present('UGC memory'),
  });

  ctx.tools.register({
    name: 'ugc_template',
    description: 'Script skeletons and saved templates. action=list shows the built-ins (behaviour skeleton, UI component, cloned-element list, slider, hold-to-repeat, cross-component call, player config) plus the templates the user saved; action=get returns the full Lua source; action=save stores the current script as a template for later runs.',
    parameters: {
      action: { type: 'string', required: true, enum: ['list', 'get', 'save', 'delete'], description: 'What to do.' },
      id: { type: 'string', description: 'get/delete: template id.' },
      name: { type: 'string', description: 'save: template name.' },
      desc: { type: 'string', description: 'save: one line description.' },
      code: { type: 'string', description: 'save: the Lua source.' },
      tags: { type: 'string', description: 'save: space separated tags.' },
    },
    output: OUTPUT,
    execute(args) {
      const action = String(args.action || '').trim();
      if (action === 'get') {
        const item = T.getTemplate(args.id);
        if (!item) return { text: '没有模板 "' + String(args.id) + '". 用 ugc_template action=list 看列表。' };
        return { text: '-- ' + item.name + '  (' + item.id + (item.builtin ? ', 内置' : '') + ')' + (item.desc ? '\n-- ' + item.desc : '') + '\n' + item.code };
      }
      if (action === 'save') {
        const item = T.saveTemplate({ name: args.name, desc: args.desc, code: args.code, tags: args.tags });
        return { text: '已保存模板 ' + item.name + ' (' + item.id + ')，以后用 ugc_template action=get id=' + item.id + ' 取用。' };
      }
      if (action === 'delete') {
        const removed = T.removeTemplate(args.id);
        return { text: removed ? '已删除模板 ' + String(args.id) : '没有自定义模板 ' + String(args.id) + '（内置模板不可删）' };
      }
      const items = T.listTemplates();
      const lines = [items.length + ' 个模板（ugc_template action=get id=... 取源码）：'];
      for (const item of items) {
        lines.push('- ' + item.id + '  ' + item.name + (item.builtin ? ' [内置]' : '') + (item.tags && item.tags.length ? '  ' + item.tags.join('/') : '') + '\n  ' + F.trunc(item.desc || '', 90));
      }
      return { text: lines.join('\n') };
    },
    presentCall: present('UGC templates'),
  });

  ctx.tools.register({
    name: 'ugc_ids',
    description: 'The id registry. The UGC wiki names ids (道具ID, 方块ID, 特效ID, 音效ID, 生物ID, 粒子特效ID, 动作ID, 图片ID) but never prints the numbers. The registry ships with the complete id tables - ~26.5k names over 14 kinds: 道具 17838, 特效 2533, 方块 950, 模型 912, 生物 909, 皮肤 601, buff 544, 图片 526, 音效 494, 粒子 314, 法术 300, 坐骑技能 273, 动作 241, 附魔 58 - imported unfiltered, so reserved ranges and placeholder rows are in there too. 变量/元件 ids only exist inside the player project. action=lookup returns known values; when nothing matches it records a request and tells you to ask the player. action=set stores the value the player gave.',
    parameters: {
      action: { type: 'string', required: true, enum: ['lookup', 'set', 'list', 'request', 'pending'], description: 'lookup: find ids by name. set: store a player-answered id. list: browse. request: record a need. pending: unanswered requests.' },
      kind: { type: 'string', description: 'Id kind: item, block, effect, sound, creature, particle, buff, ui, var, comp, custom.' },
      name: { type: 'string', description: 'lookup/set/request: the thing\'s name, e.g. 星星 / 计分板 / 回合数.' },
      value: { type: 'string', description: 'set: the numeric id the player gave.' },
      note: { type: 'string', description: 'set: where it came from or how it is used.' },
      q: { type: 'string', description: 'list: filter text.' },
    },
    output: OUTPUT,
    execute(args) {
      const action = String(args.action || '').trim();
      const kind = String(args.kind || '').trim();
      const name = String(args.name || '').trim();
      if (action === 'lookup') {
        if (!name) throw new Error('ugc_ids lookup needs name');
        const hits = I.findIds(name, kind || '');
        if (hits.length) {
          const sourceLabel = { player: '玩家填写', official: '内置ID表', harvest: 'wiki 提取' };
          const lines = hits.map((item) => '- ' + I.kindLabel(item.kind) + ' "' + item.name + '" = ' + item.value + (item.note ? '  (' + F.trunc(item.note, 60) + ')' : '') + '  [' + (sourceLabel[item.source] || 'wiki 提取') + ']');
          return { text: '已知 ' + hits.length + ' 条：\n' + lines.join('\n') };
        }
        const request = I.requestId({ kind: kind || 'custom', name: name, hint: 'ugc_ids lookup 未命中' });
        return {
          text: [
            '没有登记过 ' + I.kindLabel(kind || 'custom') + ' "' + name + '" 的数值。',
            '已自动登记这条请求（第 ' + request.count + ' 次）。',
            '要求：不要猜测或编造 id —— 先问玩家，让他在 设置 → UGC 百科 → ID 登记 里填 ' + I.kindLabel(kind || 'custom') + ' 的真实值。',
            '玩家给出数字以后，用 ugc_ids(action=set, kind=' + (kind || 'custom') + ', name="' + name + '", value=<数字>) 存起来。',
          ].join('\n'),
        };
      }
      if (action === 'set') {
        const item = I.setId({ kind: kind, name: name, value: args.value, note: args.note });
        return { text: '已登记 ' + I.kindLabel(item.kind) + ' "' + item.name + '" = ' + item.value };
      }
      if (action === 'request') {
        const item = I.requestId({ kind: kind, name: name, hint: args.note });
        return { text: '已登记请求 ' + I.kindLabel(item.kind) + ' "' + item.name + '"（等待玩家填写）。' };
      }
      if (action === 'pending') {
        const pending = I.listPending();
        if (!pending.length) return { text: '没有待填写的 id 请求。' };
        return { text: pending.length + ' 条待填写的 id 请求：\n' + pending.map((p) => '- ' + I.kindLabel(p.kind) + ' "' + p.name + '" x' + p.count).join('\n') };
      }
      const list = I.listIds({ q: args.q, kind: kind || '', limit: 200 });
      if (!list.items.length) return { text: '还没有登记任何 id。用 ugc_ids(action=lookup) 查，或让玩家在设置页填写。' };
      const listLabel = { player: '玩家', official: '内置', harvest: 'wiki' };
      const lines = list.items.map((item) => '- ' + I.kindLabel(item.kind) + ' "' + item.name + '" = ' + item.value + '  [' + (listLabel[item.source] || 'wiki') + ']');
      return { text: list.total + ' 条 id：\n' + lines.join('\n') + (list.pending.length ? '\n待填写: ' + list.pending.length + ' 条' : '') };
    },
    presentCall: present('UGC ids'),
  });

  // Host-side HTTP surface for the Settings page (settings.section in client.js).
  // Host-side HTTP surface for the Settings page (settings.section in client.js).
  // The route deliberately has NO effect disposer: inside a ctx.inject(['webServer'])
  // scope the effect disposer fires immediately (measured: "effect disposer ran"
  // right after register), which silently unregistered the route and made every
  // /dsh-minicode/api request answer 404 from the SPA fallback.
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (sub) => {
      const webServer = sub.webServer;
      if (!webServer || typeof webServer.register !== 'function') return;
      const log = (message) => {
        try {
          const logger = typeof ctx.logger === 'function' ? ctx.logger('dsh-minicode') : null;
          if (logger && typeof logger.debug === 'function') logger.debug(message);
        } catch {
          /* logging is best effort */
        }
      };
      const handler = createApi({
        indexInfo: indexInfo,
        dataDir: dataDir,
        log: log,
      });
      try {
        webServer.register({ kind: 'prefix', path: API_PREFIX, handler: handler });
      } catch (err) {
        log('cannot register ' + API_PREFIX + ': ' + String(err && err.message ? err.message : err));
      }
    });
  }

  // Opt-in boot trace: DSH_MINICODE_DEBUG=<file> appends one line after every
  // register() call above has returned, which is the only cheap way to prove
  // the bundle mounted without a full GUI restart.
  const traceTarget = debugFile();
  if (traceTarget) {
    try {
      appendFileSync(traceTarget, 'dsh-minicode applied: 12 tools, ' + store().apis.length + ' apis, api ' + API_PREFIX + '\n');
    } catch {
      /* trace only */
    }
  }
}