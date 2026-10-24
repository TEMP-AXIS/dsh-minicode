// Where this plugin keeps state the user owns: the crawled index, the memory of
// frequent mistakes, the template library and the id registry.  The directory is
// a sibling of ~/.dsh so a bundle upgrade never touches it, and the env override
// lets the tests point at a throwaway directory.
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, parse } from 'node:path';

export const DATA_DIR_ENV = 'DSH_MINICODE_DATA_DIR';
export const DEBUG_ENV = 'DSH_MINICODE_DEBUG';
// 0.3.x called this plugin dsh-ugc-wiki; both names are still accepted so an old
// script or an old README command keeps working.
const LEGACY_DATA_DIR_ENV = 'DSH_UGC_DATA_DIR';
const LEGACY_DEBUG_ENV = 'DSH_UGC_DEBUG';
const DIR_NAME = '.dsh-minicode';
const LEGACY_DIR_NAME = '.dsh-ugc-wiki';

function migrateLegacy() {
  // Move a pre-rename data directory once, so the id registry the player already
  // filled in is not left behind under the old name.
  const before = join(homedir(), LEGACY_DIR_NAME);
  const after = join(homedir(), DIR_NAME);
  if (existsSync(after) || !existsSync(before)) return after;
  try {
    renameSync(before, after);
    return after;
  } catch {
    return before; // still usable, just under the old name
  }
}

function fallbackDir() {
  return migrateLegacy();
}

/** A filesystem root would make every later cleanup dangerous, so refuse it. */
function isRoot(value) {
  const parsed = parse(value);
  return value === parsed.root || value.replace(/[\\/]+$/, '') === parsed.root.replace(/[\\/]+$/, '');
}

let cached = '';

/** Absolute path of the data directory, created on first use. */
export function dataDir() {
  if (cached) return cached;
  const raw = String(process.env[DATA_DIR_ENV] || process.env[LEGACY_DATA_DIR_ENV] || '').trim();
  let dir = fallbackDir();
  if (raw && isAbsolute(raw) && !isRoot(raw)) dir = raw;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  cached = dir;
  return dir;
}

/** One file inside the data directory. */
export function dataFile(name) {
  return join(dataDir(), name);
}

/** The index produced by a manual crawl; it wins over the bundled data file. */
export function crawledIndexFile() {
  return dataFile('index.json');
}

/** File the opt-in boot trace is appended to, or '' when tracing is off. */
export function debugFile() {
  return String(process.env[DEBUG_ENV] || process.env[LEGACY_DEBUG_ENV] || '').trim();
}

/** Convenience for tests: forget the resolved directory. */
export function resetDataDir() {
  cached = '';
}
