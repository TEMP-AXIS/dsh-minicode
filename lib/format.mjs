// Text renderers. Every renderer emits compact, line-oriented text: the model
// pays per token, so signature lines stay one line and cards stay under ~400 chars.
import { moduleOf } from './store.mjs';

export function oneLine(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

export function trunc(s, n) {
  const t = oneLine(s);
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + '…';
}

function retText(rec) {
  const list = rec.returns || [];
  if (!list.length) return '';
  const types = [];
  for (const r of list) {
    const t = r.type || r.name;
    if (t) types.push(t);
  }
  return types.join('|');
}

function paramTypes(rec) {
  const list = rec.params || [];
  if (!list.length) return '';
  return list.map((p) => p.name + (p.type ? ':' + p.type : '')).join(', ');
}

/** One-line signature: the cheapest possible representation of a function. */
export function apiLine(rec) {
  const ret = retText(rec);
  let line = rec.id + '  ' + (rec.sig || rec.name);
  if (ret) line += ' -> ' + ret;
  const desc = trunc(rec.desc || rec.note, 24);
  if (desc) line += '  ' + desc;
  return line;
}

/** Full detail card for a single function. */
export function apiCard(rec, opts) {
  const o = opts || {};
  const out = [];
  const ret = retText(rec);
  out.push((rec.sig || rec.name) + (ret ? ' -> ' + ret : ''));
  const where = (rec.moduleCn || '') + ' (' + (rec.receiver || rec.module) + ', ' + rec.module + ')';
  out.push('module: ' + where);
  if (rec.desc) out.push('use: ' + oneLine(rec.desc));
  if (rec.note && oneLine(rec.note) !== oneLine(rec.desc)) out.push('note: ' + trunc(rec.note, o.noteLimit || 300));
  const params = rec.params || [];
  if (params.length) {
    out.push('params:');
    for (const p of params) out.push('  ' + p.name + (p.type ? ': ' + p.type : '') + (p.desc ? '  ' + trunc(p.desc, o.paramLimit || 90) : ''));
  } else {
    out.push('params: none');
  }
  const returns = rec.returns || [];
  if (returns.length) {
    const parts = returns.map((r) => (r.name ? r.name + (r.type ? ':' + r.type : '') : r.type) + (r.desc ? '  ' + trunc(r.desc, o.paramLimit || 90) : ''));
    out.push('returns: ' + parts.join(' | '));
  }
  if (rec.example && o.exampleLimit !== 0) {
    out.push('example:');
    out.push(indent(trunc(rec.example, o.exampleLimit || 700)));
  }
  out.push('source: ' + rec.page + '#' + rec.anchor);
  return out.join('\n');
}

function indent(text) {
  return String(text).split('\n').map((l) => (l.trim() ? '  ' + l.replace(/^\s+/, '  ') : '')).join('\n');
}

/**
 * Two-or-three-line card for context packs: signature, id, inline typed
 * parameters, one note line. No examples — the model can ask for those.
 */
export function apiCompact(rec, opts) {
  const o = opts || {};
  const ret = retText(rec);
  const head = (rec.sig || rec.name) + (ret ? ' -> ' + ret : '') + '  [' + rec.id + ']';
  const out = [head + (rec.desc ? '  ' + trunc(rec.desc, o.descLimit || 30) : '')];
  const params = rec.params || [];
  if (params.length) {
    const inline = params.map((p) => p.name + (p.type ? ':' + p.type : '') + (p.desc ? ' ' + trunc(p.desc, o.paramLimit || 24) : ''));
    out.push('  ' + inline.join(' · '));
  }
  const note = oneLine(rec.note || '');
  if (note && note !== oneLine(rec.desc || '')) out.push('  note: ' + trunc(note, o.noteLimit || 120));
  return out.join('\n');
}

export function eventLine(rec) {
  const desc = trunc(rec.desc, 40);
  return rec.name + (desc ? '  ' + desc : '');
}

export function eventCard(rec, opts) {
  const o = opts || {};
  const out = [rec.name + (rec.desc ? '  ' + oneLine(rec.desc) : '')];
  out.push('module: ' + rec.module);
  const params = rec.params || [];
  if (params.length) {
    out.push('args:');
    for (const p of params) out.push('  ' + p.name + (p.type ? ': ' + p.type : '') + (p.desc ? '  ' + trunc(p.desc, o.paramLimit || 90) : ''));
  }
  out.push('source: ' + rec.page + '#' + rec.anchor);
  return out.join('\n');
}

export function enumBlock(group, values, limit) {
  const list = (values || group.values || []).slice(0, limit || 60);
  const out = ['enum ' + group.name + ' (' + group.values.length + ' values, ' + group.page + '#' + group.anchor + ')'];
  for (const v of list) out.push('  ' + v.name + (v.desc ? '  ' + trunc(v.desc, 60) : ''));
  if (group.values.length > list.length) out.push('  … ' + (group.values.length - list.length) + ' more');
  return out.join('\n');
}

export function moduleSheet(store, mod, opts) {
  const o = opts || {};
  const list = store.apis.filter((r) => r.module === mod.module);
  const head = (mod.receiver || mod.module) + ' ' + mod.moduleCn + ' — ' + list.length + ' functions · ' + mod.page;
  const out = [head];
  for (const rec of list) {
    let line = '  ' + (rec.sig || rec.name);
    const ret = retText(rec);
    if (ret) line += ' -> ' + ret;
    if (o.withParams) {
      const types = paramTypes(rec);
      if (types) line += '   (' + types + ')';
    } else {
      const desc = trunc(rec.desc, 20);
      if (desc) line += '  ' + desc;
    }
    out.push(line);
  }
  return out.join('\n');
}

export function sectionsOf(doc, sectionTitle) {
  const sections = doc.sections || [];
  if (!sectionTitle) return null;
  const q = String(sectionTitle).toLowerCase();
  const hit = sections.filter((s) => String(s.title || '').toLowerCase().includes(q) || String(s.id).toLowerCase().includes(q));
  return hit.length ? hit : null;
}

export function docOutline(doc) {
  const out = ['doc ' + doc.page + ' — ' + doc.title];
  for (const s of doc.sections || []) {
    if (!s.title) continue;
    out.push('  ' + (s.level === 3 ? '  ' : '') + s.title + '  (' + (s.text || '').length + ' chars)');
  }
  return out.join('\n');
}

export function docText(doc, sections, maxChars) {
  const parts = [];
  for (const s of sections || doc.sections || []) {
    const body = s.text || '';
    if (!body && !s.title) continue;
    parts.push((s.title ? '## ' + s.title + '\n' : '') + body);
  }
  let text = parts.join('\n\n').trim();
  const limit = maxChars || 4000;
  if (text.length > limit) text = text.slice(0, limit) + '\n… (truncated: pass section= to read the rest)';
  return 'doc ' + doc.page + ' — ' + doc.title + '\n\n' + text;
}

export const GUIDE = [
  'MiniWorld (迷你世界) UGC script conventions, then the usual lookup order.',
  '',
  '1. A behaviour script is one Lua file:',
  '     local Script = {}',
  '     function Script:OnStart() end          -- server start',
  '     function Script:OnPlayerEnter(eventobjid) end',
  '     return Script',
  '   "self" is the script instance; the table named Script is returned at file end.',
  '2. Register triggers with self:AddTriggerEvent(TriggerEvent.X, self.OnX) — event names and',
  '   args come from ugc_event (e.g. TriggerEvent.GameStart, ObjectEvent.PlayerEnterGame).',
  '3. Engine singletons are global: Actor, Player, Monster, Block, Area, Item, World, Chat,',
  '   CustomUI, Graphic, Timer, ... Each call is Object:Method(...) per ugc_api.',
  '4. Constants live in global enums (WorldType, AbsoluteCampType, ...); look them up with ugc_enum',
  '   before inventing a number.',
  '5. Component APIs (GetComponent) are documented on introduction/componentapi.html — read it with',
  '   ugc_doc before writing custom-component code.',
  '',
  'Cheap workflow: ugc_search (names) -> ugc_api (one card) -> code. Use ugc_pack when a task',
  'touches several APIs at once. Read prose pages with ugc_doc only when the signatures are not',
  'enough (quickin/* = tutorial, introduction/* = concepts, apis/update.html = changelog).',
].join('\n');
