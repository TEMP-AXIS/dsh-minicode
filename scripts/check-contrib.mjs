// Validates builtin/memory/*.json and builtin/templates/*.lua before a PR.
//
//   node scripts/check-contrib.mjs
//
// Exits 1 on any problem, so it can gate a pull request (and scripts/_smoke.mjs
// already fails when the loader skips a file).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { builtinMemory, builtinTemplates } from '../lib/builtin.mjs';

const DIR = fileURLToPath(new URL('../builtin/', import.meta.url));
const ID = /^[a-z0-9][a-z0-9-]{0,40}$/;
const MEMORY_KEYS = new Set(['topic', 'wrong', 'right', 'tags', 'pinned']);
const problems = [];

function fail(file, message) {
  problems.push(file + ': ' + message);
}

function checkMemory() {
  const files = readdirSync(DIR + 'memory').filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const id = file.slice(0, -5);
    if (!ID.test(id)) fail(file, '文件名只能用小写字母、数字和短横线');
    let rec;
    try {
      rec = JSON.parse(readFileSync(DIR + 'memory/' + file, 'utf8'));
    } catch (err) {
      fail(file, 'JSON 解析失败: ' + err.message);
      continue;
    }
    for (const key of Object.keys(rec)) if (!MEMORY_KEYS.has(key)) fail(file, '多了字段 ' + key);
    if (typeof rec.topic !== 'string' || !rec.topic.trim()) fail(file, '缺 topic');
    if (typeof rec.right !== 'string' || !rec.right.trim()) fail(file, '缺 right');
    if (rec.wrong != null && typeof rec.wrong !== 'string') fail(file, 'wrong 必须是字符串');
    if (rec.right && rec.right.length > 400) fail(file, 'right 超过 400 字，拆成两条');
    if (rec.topic && rec.topic.length > 60) fail(file, 'topic 超过 60 字');
    if (rec.pinned != null && typeof rec.pinned !== 'boolean') fail(file, 'pinned 必须是 true / false');
    if (rec.tags != null) {
      if (!Array.isArray(rec.tags)) fail(file, 'tags 必须是数组');
      else {
        if (rec.tags.length > 8) fail(file, 'tags 最多 8 个');
        for (const tag of rec.tags) if (typeof tag !== 'string' || !tag.trim()) fail(file, 'tags 里有空值');
      }
    }
  }
  return files.length;
}

function checkTemplates() {
  const files = readdirSync(DIR + 'templates').filter((f) => f.endsWith('.lua'));
  for (const file of files) {
    const id = file.slice(0, -4);
    if (!ID.test(id)) fail(file, '文件名只能用小写字母、数字和短横线');
    const text = readFileSync(DIR + 'templates/' + file, 'utf8');
    const lines = text.split(/\r?\n/);
    const head = {};
    let i = 0;
    for (; i < lines.length; i++) {
      const hit = /^--\s*(name|desc|tags):\s*(.*)$/.exec(lines[i]);
      if (!hit) break;
      head[hit[1]] = hit[2].trim();
    }
    if (!head.name) fail(file, '头部缺 -- name:');
    if (!head.desc) fail(file, '头部缺 -- desc:');
    const code = lines.slice(i).join('\n').trim();
    if (!code) fail(file, '没有代码');
    if (!/local Script\s*=\s*\{/.test(code)) fail(file, '缺 local Script = {}');
    if (!/return Script/.test(code)) fail(file, '缺 return Script');
    if (lines.length > 220) fail(file, '超过 220 行，模板要能一眼看完');
    if (/\t/.test(code)) fail(file, '用空格缩进，不要 tab');
  }
  return files.length;
}

const memFiles = checkMemory();
const tplFiles = checkTemplates();

// The loader must see exactly the files on disk: a silently skipped file is a typo.
const memLoaded = builtinMemory().length;
const tplLoaded = builtinTemplates().length;
if (memLoaded !== memFiles) problems.push('记忆: 磁盘 ' + memFiles + ' 个文件，加载到 ' + memLoaded + ' 条（有文件被跳过）');
if (tplLoaded !== tplFiles) problems.push('模板: 磁盘 ' + tplFiles + ' 个文件，加载到 ' + tplLoaded + ' 个（有文件被跳过）');

if (problems.length) {
  console.log('内置记忆 / 模板检查失败（' + problems.length + ' 条）：');
  for (const line of problems) console.log('  - ' + line);
  process.exit(1);
}
console.log('内置记忆 ' + memFiles + ' 条、模板 ' + tplFiles + ' 个，全部通过。');
