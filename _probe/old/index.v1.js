// @eastlake/ugc-wiki — offline MiniWorld UGC wiki lookup for the DSH agent.
//
// The heavy lifting happened at build time: scripts/build.mjs crawls
// https://dev-wiki.mini1.cn/ugc-wiki/ and writes data/ugc-wiki.json (every API
// function, event, enum value and prose section). This module only loads that
// JSON once and serves compact text answers, so a lookup costs microseconds and
// the model pays only for what it reads.
import { fileURLToPath } from 'node:url';
import { appendFileSync } from 'node:fs';
import { loadStore, searchApis, searchEvents, searchEnums, findDoc, moduleOf, taskTerms, rankByTerms } from './lib/store.mjs';
import * as F from './lib/format.mjs';

export const name = 'ugc-wiki';
export const inject = ['tools'];

const DATA_FILE = fileURLToPath(new URL('./data/ugc-wiki.json', import.meta.url));

let cachedStore = null;
function store() {
  if (!cachedStore) cachedStore = loadStore(DATA_FILE);
  return cachedStore;
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

export function apply(ctx) {
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
        return { text: noHit('entry for "' + q + '"', 'Try a shorter fragment, a Chinese verb (获取/设置), or ugc_module to browse one module.') };
      }
      const head = total + ' hit(s) for "' + q + '":';
      const tail = total > out.length ? '\n… ' + (total - out.length) + ' more (raise limit or add module=)' : '';
      return { text: head + '\n' + out.join('\n') + tail + '\n(ugc_api id= for the full card)' };
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
      const direct = s.byId.get(key.toLowerCase());
      if (direct) {
        if (direct.kind === 'event') return { text: F.eventCard(direct) };
        return { text: F.apiCard(direct, { exampleLimit: args.example === false ? 0 : 700 }) };
      }
      const byName = s.apiByName.get(key.toLowerCase()) || [];
      const byEvent = s.eventByName.get(key.toLowerCase()) || [];
      const all = byName.concat(byEvent);
      if (all.length === 1) {
        const rec = all[0];
        return { text: rec.kind === 'event' ? F.eventCard(rec) : F.apiCard(rec, { exampleLimit: args.example === false ? 0 : 700 }) };
      }
      if (all.length > 1) {
        const lines = all.map((r) => F.apiLine(r));
        return { text: 'ambiguous "' + key + '" — pick an id:\n' + lines.join('\n') };
      }
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
      if (!hits.length) return { text: noHit('event for "' + query + '"', 'Try a shorter fragment or Chinese keywords (进入, 死亡, 点击).') };
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
        const rec = hit.rec;
        const block = F.apiCompact(rec);
        if (used + block.length + 2 > budget && count > 0) break;
        out.push(block);
        used += block.length + 2;
        count++;
        if (count >= 25) break;
      }
      if (eventHits.length) {
        const evBlock = eventHits.map((h) => 'event ' + F.eventLine(h.rec));
        const joined = evBlock.join('\n');
        if (used + joined.length < budget) {
          out.push(joined);
          used += joined.length;
        }
      }
      if (count === 0) out.push('(no api matched the task wording; use ugc_search with a function name)');
      out.push('(' + count + ' api cards, ' + used + ' chars; ugc_api id= for examples, ugc_module to browse a module)');
      return { text: out.join('\n\n') };
    },
    presentCall: present('UGC context pack'),
  });

  ctx.tools.register({
    name: 'ugc_status',
    description: 'Report the bundled MiniWorld UGC wiki index: build time, wiki revision, record counts and module sizes. Use it when you are unsure whether a symbol is missing from the wiki or missing from this index.',
    parameters: {},
    output: OUTPUT,
    execute() {
      const s = store();
      const c = s.meta.counts || {};
      const lines = [
        'mini world ugc wiki index',
        'source: ' + s.meta.source,
        'built: ' + s.meta.builtAt + '  wiki updated: ' + s.meta.wikiUpdated,
        'index: ' + Math.round(s.bytes / 1024) + ' KiB, ' + s.pages.length + ' pages',
        'functions: ' + s.apis.length + ' (' + (c.params || 0) + ' params)  events: ' + s.events.length + '  enum groups: ' + s.enums.length + ' (' + (c.enumValues || 0) + ' values)  docs: ' + s.docs.length,
        'modules: ' + listModules(s),
      ];
      return { text: lines.join('\n') };
    },
    presentCall: present('UGC wiki status'),
  });

  ctx.tools.register({
    name: 'ugc_guide',
    description: 'MiniWorld UGC scripting conventions: behaviour-script skeleton, trigger registration, engine singletons, enums, and which lookup tool to use when. Read this once before writing a mini-world script.',
    parameters: {},
    output: OUTPUT,
    execute() {
      return { text: F.GUIDE };
    },
    presentCall: present('UGC scripting guide'),
  });

  // Opt-in boot trace: DSH_UGC_DEBUG=<file> appends one line after every
  // register() call above has returned, which is the only cheap way to prove
  // the bundle mounted without a full GUI restart.
  if (process.env.DSH_UGC_DEBUG) {
    try {
      appendFileSync(process.env.DSH_UGC_DEBUG, 'ugc-wiki applied: 9 tools, ' + store().apis.length + ' apis\n');
    } catch {
      /* trace only */
    }
  }
}
