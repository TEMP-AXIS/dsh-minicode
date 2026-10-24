// Built-in memory and templates, read from plain files under ../builtin/.
//
// One record = one file, so a contribution is a single-file pull request:
//   builtin/memory/<id>.json   { topic, wrong, right, tags, pinned }
//   builtin/templates/<id>.lua -- name / desc / tags header, then the script
// The file name is the id (memory ids get the builtin: prefix).  Malformed files
// are skipped, never thrown: a bad contribution must not break a lookup.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../builtin/', import.meta.url));
const SEED_AT = '2026-10-25T00:00:00.000Z';
const HEADER_KEYS = new Set(['name', 'desc', 'tags']);

let memory = null;
let templates = null;

function entries(sub, ext) {
  try {
    return readdirSync(DIR + sub).filter((name) => name.endsWith(ext)).sort();
  } catch {
    return [];
  }
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function tagsOf(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[,，]/);
  return list.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 8);
}

/** Templates carry their metadata in leading "-- key: value" comment lines. */
function splitHeader(text) {
  const lines = text.split(/\r?\n/);
  const meta = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const hit = /^--\s*([a-zA-Z]+):\s*(.*)$/.exec(lines[i]);
    if (!hit || !HEADER_KEYS.has(hit[1])) break;
    meta[hit[1]] = hit[2].trim();
  }
  while (i < lines.length && !lines[i].trim()) i++;
  return { meta: meta, code: lines.slice(i).join('\n').trim() };
}

export function builtinMemory() {
  if (memory) return memory;
  memory = [];
  for (const file of entries('memory', '.json')) {
    let rec;
    try {
      rec = JSON.parse(readText(DIR + 'memory/' + file));
    } catch {
      continue;
    }
    if (!rec || !rec.topic || !rec.right) continue;
    memory.push({
      id: 'builtin:' + file.slice(0, -5),
      topic: String(rec.topic),
      wrong: String(rec.wrong || ''),
      right: String(rec.right),
      tags: tagsOf(rec.tags),
      pinned: rec.pinned === true,
      created: SEED_AT,
      updated: SEED_AT,
      hits: 0,
      builtin: true,
    });
  }
  return memory;
}

export function builtinTemplates() {
  if (templates) return templates;
  templates = [];
  for (const file of entries('templates', '.lua')) {
    const { meta, code } = splitHeader(readText(DIR + 'templates/' + file));
    if (!code) continue;
    templates.push({
      id: file.slice(0, -4),
      name: meta.name || file.slice(0, -4),
      desc: meta.desc || '',
      tags: tagsOf(meta.tags),
      code: code,
      builtin: true,
      updated: SEED_AT,
    });
  }
  return templates;
}

/** Tests only. */
export function resetBuiltin() {
  memory = null;
  templates = null;
}
