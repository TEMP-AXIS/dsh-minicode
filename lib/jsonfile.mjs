// Tiny JSON persistence: read with a fallback, write atomically through a
// temporary sibling so a crash never leaves a half-written state file behind.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function readJson(file, fallback) {
  try {
    const text = readFileSync(file, 'utf8');
    const value = JSON.parse(text);
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = file + '.' + process.pid + '.tmp';
  writeFileSync(tmp, JSON.stringify(value, null, 1), 'utf8');
  renameSync(tmp, file);
}

export function nowIso() {
  return new Date().toISOString();
}

/** Short stable id from a string, used for memory and template keys. */
export function hashId(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}