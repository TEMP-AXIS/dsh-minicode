// Where this plugin keeps state the user owns: the crawled index, the memory of
// frequent mistakes, the template library and the id registry.  The directory is
// a sibling of ~/.dsh so a bundle upgrade never touches it, and the env override
// lets the tests point at a throwaway directory.
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, parse } from 'node:path';

export const DATA_DIR_ENV = 'DSH_UGC_DATA_DIR';
const DIR_NAME = '.dsh-ugc-wiki';

function fallbackDir() {
  return join(homedir(), DIR_NAME);
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
  const raw = String(process.env[DATA_DIR_ENV] || '').trim();
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

/** Convenience for tests: forget the resolved directory. */
export function resetDataDir() {
  cached = '';
}