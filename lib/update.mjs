// Update check against the public GitHub repository.
//
// The plugin is installed from source (link: or a git spec), so there is no
// registry to ask "is there a newer version?": we read the repository itself —
// the package.json on its default branch for the version, plus the latest commit
// and the star / issue counters for the settings page.  Nothing here runs on the
// model's request path; a stale cache is refreshed in the background at most once
// every six hours (and only when autoUpdate is on).
import { fetchText } from './crawl.mjs';
import { dataFile } from './paths.mjs';
import { readJson, writeJson } from './jsonfile.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REPO = 'TEMP-AXIS/dsh-minicode';
export const REPO_URL = 'https://github.com/' + REPO;
export const STAR_URL = REPO_URL + '/stargazers';
export const ISSUE_URL = REPO_URL + '/issues';
export const CLONE_URL = REPO_URL + '.git';

const API = 'https://api.github.com/repos/' + REPO;
const RAW = 'https://raw.githubusercontent.com/' + REPO + '/';
const FILE = 'update.json';
const TTL_MS = 6 * 60 * 60 * 1000;

export function localVersion() {
  try {
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
    return String(pkg.version || '0.0.0');
  } catch {
    return '0.0.0';
  }
}

/** Compare dotted versions; returns >0 when a is newer than b. */
export function compareVersions(a, b) {
  const pa = String(a || '').split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '').split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function cached() {
  const raw = readJson(dataFile(FILE), null);
  return raw && typeof raw === 'object' ? raw : null;
}

function fresh(state) {
  if (!state || !state.checkedAt) return false;
  const at = Date.parse(state.checkedAt);
  return Number.isFinite(at) && Date.now() - at < TTL_MS;
}

function emptyState() {
  return {
    checkedAt: '',
    local: localVersion(),
    latest: '',
    newer: false,
    stars: 0,
    issues: 0,
    sha: '',
    message: '',
    commitAt: '',
    branch: 'main',
    error: '',
    repo: REPO,
    repoUrl: REPO_URL,
    starUrl: STAR_URL,
    issueUrl: ISSUE_URL,
  };
}

function friendly(err) {
  const text = String(err && err.message ? err.message : err);
  if (/HTTP 404/.test(text)) return '仓库还没有公开（GitHub 返回 404），暂时无法检查更新。';
  if (/HTTP 403/.test(text)) return 'GitHub 限流（403），过一会儿再试。';
  if (/ENOTFOUND|EAI_AGAIN|fetch failed|aborted|timeout/i.test(text)) return '连不上 GitHub（网络不通或被墙）。';
  return text;
}

/** Read the repository state, refreshing the cache when it is stale. */
export async function checkForUpdate(opts) {
  const o = opts || {};
  const cachedState = cached();
  if (!o.force && fresh(cachedState)) return cachedState;
  const state = emptyState();
  state.checkedAt = new Date().toISOString();
  const signalOpt = o.signal ? { signal: o.signal } : {};
  try {
    const repo = JSON.parse(await fetchText(API, Object.assign({ tries: 2, timeoutMs: 15000 }, signalOpt)));
    state.stars = Number(repo.stargazers_count || 0);
    state.issues = Number(repo.open_issues_count || 0);
    state.branch = String(repo.default_branch || 'main');
    state.commitAt = String(repo.pushed_at || '');
    try {
      const pkg = JSON.parse(await fetchText(RAW + state.branch + '/package.json', Object.assign({ tries: 2, timeoutMs: 15000 }, signalOpt)));
      state.latest = String(pkg.version || '');
    } catch (err) {
      state.error = friendly(err);
    }
    try {
      const commits = JSON.parse(await fetchText(API + '/commits?per_page=1', Object.assign({ tries: 2, timeoutMs: 15000 }, signalOpt)));
      const head = Array.isArray(commits) ? commits[0] : null;
      if (head) {
        state.sha = String(head.sha || '').slice(0, 7);
        const msg = String((head.commit && head.commit.message) || '').split('\n')[0];
        state.message = msg.slice(0, 120);
        state.commitAt = String((head.commit && head.commit.committer && head.commit.committer.date) || state.commitAt);
      }
    } catch {
      /* commit info is decoration; the version above is what decides */
    }
    state.newer = state.latest ? compareVersions(state.latest, state.local) > 0 : false;
  } catch (err) {
    state.error = friendly(err);
  }
  try {
    writeJson(dataFile(FILE), state);
  } catch {
    /* an unwritable data dir only means the cache is not kept */
  }
  return state;
}

/** What the settings page and ugc_status show: cache only, never blocks. */
export function updateInfo() {
  const state = cached();
  const local = localVersion();
  if (!state) return Object.assign(emptyState(), { local: local, stale: true });
  return Object.assign({}, state, { local: local, stale: !fresh(state) });
}

/** Background refresh used at boot; resolves to null unless something changed. */
export function refreshInBackground(log) {
  const state = cached();
  const local = localVersion();
  const sameVersion = !!state && state.local === local;
  if (sameVersion && fresh(state)) return Promise.resolve(null);
  // A fresh cache that was written by an older version of the plugin still has to
  // be refreshed: otherwise the page keeps claiming the old version is current.
  return checkForUpdate({ force: !sameVersion })
    .then((next) => {
      if (typeof log === 'function' && next) {
        log(next.error
          ? 'update check failed: ' + next.error
          : 'update check: local ' + next.local + ', latest ' + (next.latest || '?') + (next.newer ? ' (newer available)' : ' (up to date)'));
      }
      return next;
    })
    .catch(() => null);
}
