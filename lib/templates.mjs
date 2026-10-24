// The template library: whole scripts the agent can start from instead of
// rebuilding the same skeleton from prose every time.  Built-ins ship with the
// plugin (builtin:true, read-only); user templates live in templates.json.
//
// The built-ins follow the project style sheet: Script table + OnStart doing the
// AddTriggerEvent wiring, per-player tables keyed by playerid, no type checks and
// no defensive nil-guards beyond the ones the engine really needs.
import { dataFile } from './paths.mjs';
import { readJson, writeJson, nowIso, hashId } from './jsonfile.mjs';

const FILE = 'templates.json';

/* Lua snippets are arrays of lines so the quotes inside them stay readable. */
const LUA = {
  skeleton: [
    '-- 行为脚本骨架：新脚本从这里开始',
    'local Script = {}',
    '',
    'function Script:OnGameStart(event)',
    '  -- 游戏开始：初始化变量、发欢迎语',
    '  -- Chat:SendSystemMsg("欢迎", 0)',
    'end',
    '',
    'function Script:OnStart()',
    '  self:AddTriggerEvent(TriggerEvent.GameStart, self.OnGameStart)',
    'end',
    '',
    'return Script',
  ],
  uiBase: [
    '-- 界面组件骨架：常量 → 每玩家状态 → 刷新 → 事件 → 注册',
    'local Script = {}',
    '',
    'local UI_ID = "7671951514247397838-111062" -- 界面ID（玩家给，不要编）',
    'local ELEM = {',
    '  CLOSE_BTN = UI_ID .. "_1",',
    '  TITLE     = UI_ID .. "_2",',
    '}',
    '',
    'local state = {} -- state[player] = {...}',
    '',
    'local function Get(player)',
    '  local s = state[player]',
    '  if not s then',
    '    s = { score = 0 }',
    '    state[player] = s',
    '  end',
    '  return s',
    'end',
    '',
    'local function Refresh(player)',
    '  CustomUI:SetText(player, UI_ID, ELEM.TITLE, "分数 " .. Get(player).score)',
    'end',
    '',
    'function Script:OnUIShow(event)',
    '  state[event.eventobjid] = { score = 0 }',
    '  Refresh(event.eventobjid)',
    'end',
    '',
    'function Script:OnUIHide(event)',
    '  -- 只做界面业务的数据在界面隐藏时就销毁',
    '  state[event.eventobjid] = nil',
    'end',
    '',
    'function Script:OnCloseClick(event)',
    '  Player:HideUIView(event.eventobjid, UI_ID)',
    'end',
    '',
    'function Script:OnStart()',
    '  self:AddTriggerEvent(TriggerEvent.UIShow, self.OnUIShow, UI_ID)',
    '  self:AddTriggerEvent(TriggerEvent.UIHide, self.OnUIHide, UI_ID)',
    '  self:AddTriggerEvent(TriggerEvent.UIButtonClick, self.OnCloseClick, ELEM.CLOSE_BTN)',
    'end',
    '',
    'return Script',
  ],
  uiClone: [
    '-- 克隆元件做列表：模板行先隐藏，CloneElement 返回的新ID带 #cloneN 后缀，',
    '-- 行内的子元件ID = 子元件后缀 + 同一个 #cloneN 后缀。',
    'local Script = {}',
    '',
    'local UI_ID = "7671924464543367630-111562"',
    'local ROW_TEMPLATE = UI_ID .. "_10" -- 编辑器里摆好的模板行，运行时隐藏',
    'local ROW_TEXT = "_11"              -- 模板行里"文本"子元件的后缀',
    '',
    'local state = {} -- state[player] = { ids = {}, data = {} }',
    '',
    'local function SuffixOf(cloneId)',
    '  return cloneId:match("#clone%d+$")',
    'end',
    '',
    'local function EnsureRows(player, count)',
    '  local s = state[player]',
    '  for i = #s.ids + 1, count do',
    '    local clone = CustomUI:CloneElement(player, UI_ID, ROW_TEMPLATE)',
    '    s.ids[i] = clone',
    '    if i % 6 == 0 then threadpool:wait(0.01) end -- 克隆多了要分帧，否则卡帧',
    '  end',
    'end',
    '',
    'local function FillRows(player, list)',
    '  local s = state[player]',
    '  EnsureRows(player, #list)',
    '  for i, item in ipairs(list) do',
    '    local rowId = s.ids[i]',
    '    local textId = UI_ID .. ROW_TEXT .. SuffixOf(rowId)',
    '    CustomUI:SetText(player, UI_ID, textId, item.name)',
    '    CustomUI:SetPosition(player, UI_ID, rowId, 0, (i - 1) * 60)',
    '    CustomUI:ShowElement(player, UI_ID, rowId)',
    '    s.data[rowId] = item -- 点击时用 event.uielement 反查',
    '  end',
    '  for i = #list + 1, #s.ids do',
    '    CustomUI:HideElement(player, UI_ID, s.ids[i])',
    '    s.data[s.ids[i]] = nil',
    '  end',
    'end',
    '',
    'function Script:OnUIShow(event)',
    '  local player = event.eventobjid',
    '  state[player] = { ids = {}, data = {} }',
    '  CustomUI:HideElement(player, UI_ID, ROW_TEMPLATE)',
    '  FillRows(player, { { name = "第一行" }, { name = "第二行" } })',
    'end',
    '',
    'function Script:OnUIHide(event)',
    '  local player = event.eventobjid',
    '  local s = state[player]',
    '  if not s then return end',
    '  -- 克隆出来的元件必须自己删，否则下次打开又克隆一批',
    '  for _, rowId in ipairs(s.ids) do',
    '    CustomUI:DeleteElement(player, UI_ID, rowId)',
    '  end',
    '  state[player] = nil',
    'end',
    '',
    'function Script:OnClick(event)',
    '  local player = event.eventobjid',
    '  local item = state[player].data[event.uielement]',
    '  if not item then return end',
    '  Player:NotifyGameInfo2Self(player, "点了 " .. item.name)',
    'end',
    '',
    'function Script:OnStart()',
    '  self:AddTriggerEvent(TriggerEvent.UIShow, self.OnUIShow, UI_ID)',
    '  self:AddTriggerEvent(TriggerEvent.UIHide, self.OnUIHide, UI_ID)',
    '  self:AddTriggerEvent(TriggerEvent.UIButtonClick, self.OnClick)',
    'end',
    '',
    'return Script',
  ],
  slider: [
    '-- 滑动条：滚动面板 + 触摸开始/结束事件 + 0.03 秒轮询位置',
    '-- 不要用按钮点击事件去读滑块，拖动过程中根本不会触发',
    'local Script = {}',
    '',
    'local UI_ID = "7671924464543367630-111562"',
    'local SLIDER = UI_ID .. "_175" -- 滑动列表元件',
    'local VALUE_TEXT = UI_ID .. "_176"',
    'local SLIDER_W = 130 -- 滑动列表能移动的像素长度',
    'local MIN_VAL, MAX_VAL = 1, 64',
    '',
    'local press = {} -- press[player] = { active = false, task = nil, value = 1 }',
    '',
    'local function ValueOf(posX)',
    '  -- x 越大值越小：方向按实际界面调，先 clamp 成 0~1 再换算',
    '  local ratio = math.max(0, math.min(1, (SLIDER_W - posX) / SLIDER_W))',
    '  return math.floor(MIN_VAL + (MAX_VAL - MIN_VAL) * ratio + 0.5)',
    'end',
    '',
    'local function SetValue(player, value)',
    '  local p = press[player]',
    '  p.value = value',
    '  CustomUI:SetText(player, UI_ID, VALUE_TEXT, tostring(value))',
    '  if not p.active then',
    '    -- 拖动中不要回写滑块位置，否则手指会被拽回去',
    '    local ratio = (value - MIN_VAL) / (MAX_VAL - MIN_VAL)',
    '    CustomUI:TurnSliderToPos(player, UI_ID, SLIDER, (1 - ratio) * SLIDER_W, 0)',
    '  end',
    'end',
    '',
    'local function StopLoop(player)',
    '  local p = press[player]',
    '  p.active = false',
    '  if p.task then p.task:Cancel(); p.task = nil end',
    'end',
    '',
    'local function StartLoop(player, selfObj)',
    '  local p = press[player]',
    '  if p.task then return end',
    '  p.active = true',
    '  p.task = selfObj:DoPeriodicTask(function()',
    '    local pos = CustomUI:GetElementAttrValue(player, SLIDER, ElementAttr.ScrollPosition)',
    '    if not pos or not pos.x then return end',
    '    local value = ValueOf(pos.x)',
    '    if value ~= p.value then SetValue(player, value) end',
    '  end, 0.03, 0)',
    'end',
    '',
    'function Script:OnSliderBegin(event)',
    '  StartLoop(event.eventobjid, self)',
    'end',
    '',
    'function Script:OnSliderEnd(event)',
    '  local player = event.eventobjid',
    '  StopLoop(player)',
    '  local pos = CustomUI:GetElementAttrValue(player, SLIDER, ElementAttr.ScrollPosition)',
    '  if pos and pos.x then SetValue(player, ValueOf(pos.x)) end -- 松手按最终位置再定一次',
    'end',
    '',
    'function Script:OnUIShow(event)',
    '  local player = event.eventobjid',
    '  press[player] = { active = false, task = nil, value = MIN_VAL }',
    '  SetValue(player, MIN_VAL)',
    'end',
    '',
    'function Script:OnUIHide(event)',
    '  StopLoop(event.eventobjid)',
    '  press[event.eventobjid] = nil',
    'end',
    '',
    'function Script:OnStart()',
    '  self:AddTriggerEvent(TriggerEvent.UIShow, self.OnUIShow, UI_ID)',
    '  self:AddTriggerEvent(TriggerEvent.UIHide, self.OnUIHide, UI_ID)',
    '  self:AddTriggerEvent(TriggerEvent.UIScrollPaneTouchBegin, self.OnSliderBegin, SLIDER)',
    '  self:AddTriggerEvent(TriggerEvent.UIScrollPaneTouchEnd, self.OnSliderEnd, SLIDER)',
    'end',
    '',
    'return Script',
  ],
  holdRepeat: [
    '-- 长按连续触发：按下开循环，松手取消，走到边界自己停',
    'local Script = {}',
    '',
    'local press = {} -- press[player] = { dir = nil, task = nil }',
    '',
    'local function StopLoop(player)',
    '  local p = press[player]',
    '  p.dir = nil',
    '  if p.task then p.task:Cancel(); p.task = nil end',
    'end',
    '',
    '-- 业务步进：能继续返回 true，到边界返回 false',
    'local function Step(player, dir)',
    '  local page = press[player].page or 1',
    '  local nextPage = page + dir',
    '  if nextPage < 1 or nextPage > 10 then return false end',
    '  press[player].page = nextPage',
    '  return true',
    'end',
    '',
    'local function StartLoop(player, dir, selfObj)',
    '  local p = press[player]',
    '  if p.task then return end',
    '  p.dir = dir',
    '  p.task = selfObj:DoPeriodicTask(function()',
    '    if not Step(player, dir) then StopLoop(player) end',
    '  end, 0.1, 0)',
    'end',
    '',
    'function Script:OnPlusPress(event)',
    '  StartLoop(event.eventobjid, 1, self)',
    'end',
    '',
    'function Script:OnPlusRelease(event)',
    '  StopLoop(event.eventobjid)',
    'end',
    '',
    'function Script:OnStart()',
    '  self:AddTriggerEvent(TriggerEvent.UIButtonClick, self.OnPlusPress, UI_ID .. "_20")',
    '  self:AddTriggerEvent(TriggerEvent.UIButtonRelease, self.OnPlusRelease, UI_ID .. "_20")',
    'end',
    '',
    'return Script',
  ],
  crossComponent: [
    '-- 跨组件调用：只通过 GameObject:FindObject(对象ID):GetComponent(组件ID) 拿句柄',
    'local Script = {}',
    '',
    'local UI_ID = "7672093462916530638114458"        -- 本界面ID',
    'local TARGET_OBJ = "7671924464543367630"         -- 目标组件挂在哪个对象上',
    'local TARGET_COMP = "c7672099639079502286114958" -- 目标组件ID（c 开头）',
    '',
    '-- 不写成常量、不校验：对象和组件不存在就是场景摆错了',
    'local function Target()',
    '  return GameObject:FindObject(TARGET_OBJ):GetComponent(TARGET_COMP)',
    'end',
    '',
    'function Script:OnCloseClick(event)',
    '  Target():CloseUI(event.eventobjid, UI_ID)',
    'end',
    '',
    '-- 反过来，本组件对外暴露函数，别的组件 Target():OpenPanelAt(player, 2) 这样调',
    'function Script:OpenPanelAt(playerId, mode)',
    '  CustomUI:SetText(playerId, UI_ID, UI_ID .. "_1", tostring(mode))',
    'end',
    '',
    'function Script:OnStart()',
    '  self:AddTriggerEvent(TriggerEvent.UIButtonClick, self.OnCloseClick, UI_ID .. "_9")',
    'end',
    '',
    'return Script',
  ],
  playerConfig: [
    '-- 玩家配置：Data 里存 JSON 字符串，读的时候补默认值',
    'local Script = {}',
    '',
    'local VAR_CFG = "v7671973994106225102112172" -- 玩家变量ID（v 开头，玩家给，不要编）',
    '',
    'local DEFAULT = {',
    '  vibration = true,',
    '  animation = true,',
    '  close_ui  = false,',
    '}',
    '',
    'local function Save(player, data)',
    '  Data:SetValue(VAR_CFG, player, json.encode(data))',
    'end',
    '',
    'local function Load(player)',
    '  local data = json.decode(Data:GetValue(VAR_CFG, player))',
    '  local changed = false',
    '  for key, value in pairs(DEFAULT) do',
    '    if data[key] == nil then data[key] = value; changed = true end',
    '  end',
    '  if changed then Save(player, data) end',
    '  return data',
    'end',
    '',
    'function Script:OnPlayerEnter(event)',
    '  Load(event.eventobjid) -- 进图补齐默认字段',
    'end',
    '',
    'function Script:OnStart()',
    '  self:AddTriggerEvent(TriggerEvent.GameAnyPlayerEnterGame, self.OnPlayerEnter)',
    'end',
    '',
    'return Script',
  ],
};

const META = [
  { id: 'skeleton', name: '行为脚本骨架', lua: 'skeleton', desc: 'Script 表 + OnStart 注册 AddTriggerEvent + return，任何新脚本的起点', tags: ['skeleton'] },
  { id: 'ui-base', name: '界面组件骨架', lua: 'uiBase', desc: 'UI_ID 常量表、每玩家状态、UIShow/UIHide 生命周期、按钮事件注册', tags: ['ui', 'lifecycle'] },
  { id: 'ui-clone', name: '克隆元件列表', lua: 'uiClone', desc: 'CloneElement + #cloneN 子元件命名 + DeleteElement 清理（最容易写错的一条）', tags: ['ui', 'clone', 'list'] },
  { id: 'slider', name: '滑动条', lua: 'slider', desc: 'UIScrollPaneTouchBegin/End + 0.03 秒轮询位置 + TurnSliderToPos 回写', tags: ['ui', 'slider'] },
  { id: 'hold-repeat', name: '长按连续触发', lua: 'holdRepeat', desc: '按下开 DoPeriodicTask 循环，松手 Cancel，到边界自动停', tags: ['ui', 'timer'] },
  { id: 'cross-component', name: '跨组件调用', lua: 'crossComponent', desc: 'GameObject:FindObject + GetComponent 拿句柄并调用/关闭别人的界面', tags: ['component'] },
  { id: 'player-config', name: '玩家配置读写', lua: 'playerConfig', desc: 'Data:GetValue/SetValue + json 存玩家配置，进图补默认字段', tags: ['data', 'config'] },
];

function builtins() {
  return META.map((item) => ({
    id: item.id,
    name: item.name,
    desc: item.desc,
    tags: item.tags,
    code: LUA[item.lua].join('\n'),
    builtin: true,
    updated: '2026-10-25T00:00:00.000Z',
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
