// Memory of the mistakes that keep coming back.
//
// The wiki documents what the engine can do; it cannot document what this player's
// project got wrong.  Two kinds of records live here:
//   items  - an explicit correction the agent (or the user) recorded: a topic, what
//            was wrong, and the fact that replaces it.  Surfaced by ugc_search and
//            ugc_pack, and printed by ugc_guide when pinned.
//   misses - queries no lookup could answer, recorded automatically.  They are the
//            evidence the Settings page shows so the user can turn a recurring miss
//            into a correction.
//
// SEED is the part that ships with the plugin: corrections learned from real
// project scripts (the ui-clone / ui-slider traps above all).  They behave like
// built-in templates - always matched, never deleted - so a fresh install already
// knows the traps without the user retyping them.
import { dataFile } from './paths.mjs';
import { readJson, writeJson, nowIso, hashId } from './jsonfile.mjs';

const FILE = 'memory.json';
const MAX_ITEMS = 400;
const MAX_MISSES = 80;
const SEED_AT = '2026-10-25T00:00:00.000Z';

/* Corrections distilled from real project scripts.  topic / wrong / right, in the
   same shape ugc_memory(action=add) writes, so matching and display stay uniform. */
const SEED = [
  {
    id: 'builtin:clone-element',
    topic: '克隆元件（CustomUI:CloneElement）',
    wrong: '直接 CloneElement，然后拿模板元件的 ID 去 SetText/SetColor，以为克隆会把文本图片一起复制',
    right: '先把模板元件 HideElement，再 CloneElement(player, uiid, 模板ID)；返回的新ID形如「模板ID#cloneN」，克隆出来的元件不带文本/颜色，必须自己 SetText/SetColor/SetPosition；行内子元件ID = UI_ID .. 子后缀 .. clone:match("#clone%d+$")',
    tags: ['ui', 'clone', '克隆', 'cloneelement', '列表'],
    pinned: true,
  },
  {
    id: 'builtin:clone-cleanup',
    topic: '克隆元件的清理',
    wrong: '关闭界面只清 state，克隆元件留在界面上；或者每次 UIShow 都重新克隆一批，元件越堆越多',
    right: '每玩家存 cloneIds，OnUIHide 里 for 循环 CustomUI:DeleteElement(player, uiid, id)，再 state[player] = nil；只是暂时不显示的行用 HideElement 留着复用（先建满再逐行 Show/Hide）',
    tags: ['ui', 'clone', '克隆', '生命周期', '清理'],
  },
  {
    id: 'builtin:clone-click',
    topic: '克隆元件的点击事件',
    wrong: '给每个克隆ID单独 AddTriggerEvent（克隆ID运行时才存在，OnStart 注册时还没有）',
    right: 'TriggerEvent.UIButtonClick 只注册一次，回调里用 event.uielement 去 cloneMap[clickedId] 反查业务数据，反查不到就 return',
    tags: ['ui', 'clone', 'event', 'uielement', '点击'],
  },
  {
    id: 'builtin:clone-perf',
    topic: '大量克隆要分帧',
    wrong: '一个 for 循环连续克隆几十上百个元件，打开界面直接卡一下',
    right: '循环里每 6 个 threadpool:wait(0.01)；一批克隆完再统一 SetText/SetPosition/ShowElement',
    tags: ['ui', 'clone', 'threadpool', '性能'],
  },
  {
    id: 'builtin:slider-read',
    topic: '滑动条取值（滚动面板）',
    wrong: '用 UIButtonClick 或文本事件去读滑块位置，拖动过程中数值根本不动',
    right: 'TriggerEvent.UIScrollPaneTouchBegin / UIScrollPaneTouchEnd 注册时第三个参数写滑动元件ID；位置用 CustomUI:GetElementAttrValue(player, 滑动元件ID, ElementAttr.ScrollPosition) 取，返回 {x=,y=}',
    tags: ['ui', 'slider', '滑动', 'scrollpane'],
    pinned: true,
  },
  {
    id: 'builtin:slider-loop',
    topic: '拖动过程要轮询位置',
    wrong: '只在 TouchEnd 读一次位置，拖动时界面不跟着变',
    right: 'TouchBegin 里 self:DoPeriodicTask(fn, 0.03, 0) 起循环轮询位置，任务存 per-player 表；TouchEnd 里 :Cancel() 并再读一次最终位置；UIHide / 玩家离开也要 Cancel',
    tags: ['ui', 'slider', '滑动', 'doperiodictask', '轮询'],
  },
  {
    id: 'builtin:slider-writeback',
    topic: 'TurnSliderToPos 回写打架',
    wrong: '数值一变就 TurnSliderToPos，拖动时手指位置被拽回去、数值来回跳',
    right: '用 active 标志：拖动中只更新数值、不写回位置，松手后再 TurnSliderToPos；坐标换算先 math.max(0, math.min(1, ratio)) 再乘范围',
    tags: ['ui', 'slider', '滑动', 'turnslidertopos'],
  },
  {
    id: 'builtin:slider-direction',
    topic: '滑块坐标方向',
    wrong: '假设 pos.x 越大数值越大，或直接把像素当数值用',
    right: '样例是反向换算：(SLIDER_W - pos.x) / SLIDER_W，回写时 (1 - ratio) * SLIDER_W；方向按界面实际摆法调，两端用 clamp 兜住，TouchEnd 再算一次',
    tags: ['ui', 'slider', '滑动', '坐标'],
  },
  {
    id: 'builtin:engine-api',
    topic: 'wiki 里查不到的引擎接口',
    wrong: 'ugc_search 查 DoPeriodicTask / AddTriggerEvent / GetElementAttrValue 查不到，就以为不能用',
    right: '这三个是组件脚本自带的：self:AddTriggerEvent(TriggerEvent.X, self.Handler, 元件ID可省)；self:DoPeriodicTask(fn, 间隔秒, 0) 返回带 :Cancel() 的任务；CustomUI:GetElementAttrValue(player, 元件ID, ElementAttr.ScrollPosition)',
    tags: ['ui', '接口', '引擎', 'addtriggerevent', 'doperiodictask'],
    pinned: true,
  },
  {
    id: 'builtin:ui-ids',
    topic: '界面 / 变量 / 组件 ID',
    wrong: '编造 v 开头的变量ID、c 开头的组件ID 或界面ID',
    right: 'v**** 变量、c**** 组件、界面ID 都由玩家从编辑器里给；变量读写 Data:GetValue(varId, player) / Data:SetValue(varId, player, json.encode(t))，全局变量玩家参数传 nil；调别的组件用 GameObject:FindObject(对象ID):GetComponent(组件ID)',
    tags: ['id', '变量', '组件', 'data'],
  },
  {
    id: 'builtin:player-state',
    topic: '每玩家状态与定时器生命周期',
    wrong: '顶层 local 表只增不减，定时器不停，玩家走了还在跑',
    right: 'state[player] 在 OnUIHide（或玩家离开）里整体置 nil；每个 DoPeriodicTask 的任务都要在同一处 :Cancel()；只做界面业务的数据界面隐藏就销毁，要存档的才写进 Data',
    tags: ['生命周期', 'state', '定时器'],
  },
  {
    id: 'builtin:code-style',
    topic: '代码风格（范本要求）',
    wrong: '到处 type(x) == "number" / if x then 防护，顶部堆一排只用一次的局部常量，函数拆得又碎又重复',
    right: '类型确定的变量直接用；一次性常量写成函数内 local 或直接内联；文件按 常量 → 每玩家状态 → 刷新 → 事件 → OnStart 注册 分块，公共逻辑抽一个函数，不复制粘贴',
    tags: ['style', '风格', '规范'],
  },
];

/** The shipped corrections, in the same record shape as stored items. */
function seeds() {
  return SEED.map((item) => Object.assign({ created: SEED_AT, updated: SEED_AT, hits: 0, pinned: false }, item, { builtin: true }));
}

let state = null;

function emptyState() {
  return { version: 1, updated: nowIso(), items: [], misses: [] };
}

function load() {
  if (state) return state;
  const raw = readJson(dataFile(FILE), null);
  state = raw && typeof raw === 'object' ? raw : emptyState();
  if (!Array.isArray(state.items)) state.items = [];
  if (!Array.isArray(state.misses)) state.misses = [];
  return state;
}

function save() {
  const s = load();
  s.updated = nowIso();
  writeJson(dataFile(FILE), s);
}

function norm(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function tagsOf(value) {
  if (Array.isArray(value)) return value.map(norm).filter(Boolean).slice(0, 8);
  return String(value || '')
    .split(/[,，\s]+/)
    .map(norm)
    .filter(Boolean)
    .slice(0, 8);
}

/** Split a query into lowercase match tokens; CJK contributes 2-grams too. */
function tokensOf(query) {
  const out = new Set();
  const text = String(query || '').toLowerCase();
  for (const part of text.split(/\s+/)) {
    if (!part) continue;
    out.add(part);
    if (/[\u3400-\u9fff]/.test(part) && part.length > 2) {
      for (let i = 0; i + 2 <= part.length; i++) out.add(part.slice(i, i + 2));
    }
  }
  return [...out].filter((t) => t.length >= 2);
}

function scoreOf(item, tokens) {
  const topic = String(item.topic || '').toLowerCase();
  const wrong = String(item.wrong || '').toLowerCase();
  const right = String(item.right || '').toLowerCase();
  const tags = (item.tags || []).join(' ').toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (topic.includes(token)) score += 6;
    else if (tags.includes(token)) score += 4;
    else if (right.includes(token)) score += 3;
    else if (wrong.includes(token)) score += 2;
  }
  return score;
}

export function listMemory(opts) {
  const o = opts || {};
  const s = load();
  let items = seeds().concat(s.items);
  const q = norm(o.q);
  if (q) {
    const tokens = tokensOf(q);
    items = items.filter((item) => scoreOf(item, tokens) > 0);
  }
  items.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.hits || 0) - (a.hits || 0) || String(b.updated).localeCompare(String(a.updated)));
  const limit = Math.max(1, Math.min(200, Number(o.limit) || 60));
  return { items: items.slice(0, limit), total: items.length, misses: s.misses.slice(0, 40) };
}

export function addMemory(input) {
  const s = load();
  const topic = norm(input.topic);
  const right = norm(input.right);
  if (!topic && !right) throw new Error('memory needs topic or right');
  const key = hashId(topic.toLowerCase() + '|' + right.toLowerCase());
  const existing = s.items.find((item) => item.id === key);
  if (existing) {
    existing.wrong = norm(input.wrong) || existing.wrong;
    existing.right = right || existing.right;
    existing.tags = tagsOf(input.tags).length ? tagsOf(input.tags) : existing.tags;
    existing.updated = nowIso();
    save();
    return existing;
  }
  const item = {
    id: key,
    topic: topic,
    wrong: norm(input.wrong),
    right: right,
    tags: tagsOf(input.tags),
    created: nowIso(),
    updated: nowIso(),
    hits: 0,
    pinned: input.pinned === true,
  };
  s.items.unshift(item);
  if (s.items.length > MAX_ITEMS) s.items.length = MAX_ITEMS;
  save();
  return item;
}

export function removeMemory(id) {
  const s = load();
  const before = s.items.length;
  s.items = s.items.filter((item) => item.id !== String(id));
  if (s.items.length === before) return false;
  save();
  return true;
}

export function pinMemory(id, pinned) {
  const s = load();
  const item = s.items.find((entry) => entry.id === String(id));
  if (!item) return null;
  item.pinned = pinned !== false;
  item.updated = nowIso();
  save();
  return item;
}

/** Memory items relevant to a query, best first. Never throws. */
export function matchMemory(query, limit) {
  try {
    const tokens = tokensOf(query);
    if (!tokens.length) return [];
    const s = load();
    const scored = [];
    for (const item of seeds().concat(s.items)) {
      const score = scoreOf(item, tokens);
      if (score > 0) scored.push({ item: item, score: score + (item.pinned ? 4 : 0) });
    }
    scored.sort((a, b) => b.score - a.score || (b.item.pinned ? 1 : 0) - (a.item.pinned ? 1 : 0));
    const picked = scored.slice(0, Math.max(1, Math.min(5, Number(limit) || 3))).map((hit) => hit.item);
    if (picked.some((item) => !item.builtin)) {
      for (const item of picked) {
        if (item.builtin) continue;
        item.hits = (item.hits || 0) + 1;
      }
      save();
    }
    return picked;
  } catch {
    return [];
  }
}

export function pinnedMemory(limit) {
  const s = load();
  return seeds().concat(s.items).filter((item) => item.pinned).slice(0, Math.max(1, Math.min(12, Number(limit) || 6)));
}

/** Remember a query that matched nothing, so Settings can show it. */
export function recordMiss(query, kind) {
  try {
    const q = norm(query);
    if (!q || q.length < 2) return;
    const s = load();
    const key = q.toLowerCase();
    const hit = s.misses.find((entry) => String(entry.q).toLowerCase() === key && entry.kind === (kind || 'any'));
    if (hit) {
      hit.count = (hit.count || 0) + 1;
      hit.at = nowIso();
    } else {
      s.misses.unshift({ q: q, kind: kind || 'any', count: 1, at: nowIso() });
      if (s.misses.length > MAX_MISSES) s.misses.length = MAX_MISSES;
    }
    save();
  } catch {
    /* a miss log must never break a lookup */
  }
}

export function clearMisses() {
  const s = load();
  s.misses = [];
  save();
}

export function removeMiss(query, kind) {
  const s = load();
  const key = norm(query).toLowerCase();
  const before = s.misses.length;
  s.misses = s.misses.filter((entry) => !(String(entry.q).toLowerCase() === key && (!kind || entry.kind === kind)));
  if (s.misses.length === before) return false;
  save();
  return true;
}

export function memoryStats() {
  const s = load();
  return {
    items: s.items.length,
    builtin: SEED.length,
    pinned: seeds().concat(s.items).filter((i) => i.pinned).length,
    misses: s.misses.length,
    updated: s.updated,
  };
}

/** Tests only: drop the in-memory copy so the next read hits disk. */
export function resetMemory() {
  state = null;
}