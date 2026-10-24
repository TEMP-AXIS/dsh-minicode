// The template library: whole scripts the agent can start from instead of
// rebuilding the same skeleton from prose every time.  Built-ins ship with the
// plugin from builtin/templates/*.lua (builtin:true, read-only); user templates live in templates.json.
//
// The built-ins follow the project style sheet: Script table + OnStart doing the
// AddTriggerEvent wiring, per-player tables keyed by playerid, no type checks and
// no defensive nil-guards beyond the ones the engine really needs.
import { builtinTemplates } from './builtin.mjs';
import { dataFile } from './paths.mjs';
import { readJson, writeJson, nowIso, hashId } from './jsonfile.mjs';

const FILE = 'templates.json';

function builtins() {
  return builtinTemplates().map((item) => Object.assign({}, item));
}

let state = null;

function load() {
  if (state) return state;
  const raw = readJson(dataFile(FILE), null);
  state = raw && typeof raw === 'object' ? raw : { version: 1, items: [] };
  if (!Array.isArray(state.items)) state.items = [];
  return state;
}

function save() {
  writeJson(dataFile(FILE), load());
}

function norm(v) {
  return String(v || '').trim();
}

export function listTemplates() {
  const custom = load().items.slice().sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  return builtins().concat(custom);
}

export function getTemplate(id) {
  const key = norm(id);
  const all = listTemplates();
  return all.find((t) => t.id === key) || all.find((t) => t.name === key) || null;
}

export function saveTemplate(input) {
  const s = load();
  const name = norm(input.name);
  const code = String(input.code || '');
  if (!name) throw new Error('template needs a name');
  if (!code.trim()) throw new Error('template needs code');
  const id = norm(input.id) || hashId('tpl|' + name);
  if (builtins().some((b) => b.id === id)) throw new Error('builtin template is read-only: ' + id);
  const tags = input.tags ? String(input.tags).split(/[,，\s]+/).filter(Boolean).slice(0, 8) : [];
  const now = nowIso();
  const existing = s.items.find((t) => t.id === id);
  if (existing) {
    existing.name = name;
    existing.code = code;
    existing.desc = norm(input.desc) || existing.desc;
    if (tags.length) existing.tags = tags;
    existing.updated = now;
    save();
    return existing;
  }
  const item = { id: id, name: name, desc: norm(input.desc), tags: tags, code: code, builtin: false, created: now, updated: now };
  s.items.unshift(item);
  save();
  return item;
}

export function removeTemplate(id) {
  const s = load();
  const key = norm(id);
  const before = s.items.length;
  s.items = s.items.filter((t) => t.id !== key);
  if (s.items.length === before) return false;
  save();
  return true;
}

export function templateStats() {
  return { builtin: builtins().length, custom: load().items.length };
}

export function resetTemplates() {
  state = null;
}
