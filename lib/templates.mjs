// The template library: whole scripts the agent can start from instead of
// rebuilding the same skeleton from prose every time.  Built-ins ship with the
// plugin (builtin:true, read-only); user templates live in templates.json.
import { dataFile } from './paths.mjs';
import { readJson, writeJson, nowIso, hashId } from './jsonfile.mjs';

const FILE = 'templates.json';

/* Lua snippets are arrays of lines so the quotes inside them stay readable. */
const LUA = {
  skeleton: [
    '-- 行为脚本骨架：任何新脚本的起点',
    'local Script = {}',
    '',
    'function Script:GameStart()',
    '  -- 游戏开始：初始化变量、发欢迎语',
    '  -- Chat:SendSystemMsg("欢迎", 0)  -- 参数用 ugc_api chat:sendsystemmsg 核对',
    'end',
    '',
    'TriggerEvent.GameStart()',
    'return Script',
  ],
  playerJoin: [
    '-- 玩家进入：ObjectEvent.PlayerEnterGame(eventobjid, x, y, z, eventworldid)',
    'local Script = {}',
    '',
    'function Script:PlayerEnterGame(eventobjid, x, y, z, eventworldid)',
    '  local name = Actor:GetNickName(eventobjid)',
    '  Chat:SendSystemMsg("欢迎 " .. name, 0)',
    'end',
    '',
    'ObjectEvent.PlayerEnterGame()',
    'return Script',
  ],
  timerLoop: [
    '-- 定时循环：CreateTimer 拿 id，再用 StartBackwardTimer 启动',
    '-- interval 单位与 repeated 含义用 ugc_api timer:startbackwardtimer 核对',
    'local Script = {}',
    'local tickTimer = 0',
    '',
    'function Script:GameStart()',
    '  tickTimer = Timer:CreateTimer("tick")',
    '  Timer:StartBackwardTimer(tickTimer, 1000, true)',
    'end',
    '',
    '-- TODO 用 ugc_event 查定时器到期事件，再把回调补在这里',
    'return Script',
  ],
  areaCheck: [
    '-- 区域判定：矩形区域 + 取区域内的玩家',
    'local Script = {}',
    'local areaId = -1',
    '',
    'function Script:GameStart()',
    '  -- Area:CreateAreaRectByRange(posBeg, posEnd, btmp, worldId) -> areaId',
    '  areaId = Area:CreateAreaRectByRange({x=0,y=0,z=0}, {x=10,y=5,z=10}, false, 0)',
    'end',
    '',
    'function Script:Check()',
    '  local players = Area:GetAreaPlayers(areaId)',
    '  -- 单个对象判定用 Area:ObjInArea(areaId, objid)',
    '  return players',
    'end',
    '',
    'return Script',
  ],
  teamBuff: [
    '-- 按队伍加减益：取队伍 -> 判定 -> 加/掉 buff',
    'local Script = {}',
    '',
    'function Script:OnRoundStart(objid, buffid)',
    '  local team = Actor:GetTeam(objid)',
    '  if team and team > 0 then',
    '    Buff:AddBuff(objid, buffid, 0)',
    '  else',
    '    Buff:RemoveBuff(objid, buffid)',
    '  end',
    'end',
    '',
    'return Script',
  ],
  uiText: [
    '-- 自定义 UI：改文本（SetText / SetTexture / SetState 同一套参数）',
    'local Script = {}',
    '',
    'function Script:ShowScore(objid, uiid, elementid, score)',
    '  CustomUI:SetText(objid, uiid, elementid, "得分 " .. tostring(score), 0, 0, 0)',
    'end',
    '',
    'return Script',
  ],
};

const META = [
  { id: 'skeleton', name: '行为脚本骨架', lua: 'skeleton', desc: 'Script 表 + GameStart + return，任何新脚本的起点', tags: ['skeleton'] },
  { id: 'player-join', name: '玩家进入地图', lua: 'playerJoin', desc: 'ObjectEvent.PlayerEnterGame 取名字并播欢迎', tags: ['event', 'player'] },
  { id: 'timer-loop', name: '定时循环', lua: 'timerLoop', desc: 'CreateTimer + StartBackwardTimer 循环骨架', tags: ['timer'] },
  { id: 'area-check', name: '区域判定', lua: 'areaCheck', desc: '创建矩形区域并取区域内的玩家', tags: ['area'] },
  { id: 'team-buff', name: '按队伍加减益', lua: 'teamBuff', desc: 'Actor:GetTeam 判定后加/掉 buff', tags: ['team', 'buff'] },
  { id: 'ui-text', name: '自定义 UI 文本', lua: 'uiText', desc: 'CustomUI:SetText 刷新界面文字', tags: ['ui'] },
];

function builtins() {
  return META.map((item) => ({
    id: item.id,
    name: item.name,
    desc: item.desc,
    tags: item.tags,
    code: LUA[item.lua].join('\n'),
    builtin: true,
    updated: '2026-10-24T00:00:00.000Z',
  }));
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