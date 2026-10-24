-- name: 滑动条
-- desc: UIScrollPaneTouchBegin/End + 0.03 秒轮询位置 + TurnSliderToPos 回写
-- tags: ui, slider
-- 滑动条：滚动面板 + 触摸开始/结束事件 + 0.03 秒轮询位置
-- 不要用按钮点击事件去读滑块，拖动过程中根本不会触发
local Script = {}

local UI_ID = "7671924464543367630-111562"
local SLIDER = UI_ID .. "_175" -- 滑动列表元件
local VALUE_TEXT = UI_ID .. "_176"
local SLIDER_W = 130 -- 滑动列表能移动的像素长度
local MIN_VAL, MAX_VAL = 1, 64

local press = {} -- press[player] = { active = false, task = nil, value = 1 }

local function ValueOf(posX)
  -- x 越大值越小：方向按实际界面调，先 clamp 成 0~1 再换算
  local ratio = math.max(0, math.min(1, (SLIDER_W - posX) / SLIDER_W))
  return math.floor(MIN_VAL + (MAX_VAL - MIN_VAL) * ratio + 0.5)
end

local function SetValue(player, value)
  local p = press[player]
  p.value = value
  CustomUI:SetText(player, UI_ID, VALUE_TEXT, tostring(value))
  if not p.active then
    -- 拖动中不要回写滑块位置，否则手指会被拽回去
    local ratio = (value - MIN_VAL) / (MAX_VAL - MIN_VAL)
    CustomUI:TurnSliderToPos(player, UI_ID, SLIDER, (1 - ratio) * SLIDER_W, 0)
  end
end

local function StopLoop(player)
  local p = press[player]
  p.active = false
  if p.task then p.task:Cancel(); p.task = nil end
end

local function StartLoop(player, selfObj)
  local p = press[player]
  if p.task then return end
  p.active = true
  p.task = selfObj:DoPeriodicTask(function()
    local pos = CustomUI:GetElementAttrValue(player, SLIDER, ElementAttr.ScrollPosition)
    if not pos or not pos.x then return end
    local value = ValueOf(pos.x)
    if value ~= p.value then SetValue(player, value) end
  end, 0.03, 0)
end

function Script:OnSliderBegin(event)
  StartLoop(event.eventobjid, self)
end

function Script:OnSliderEnd(event)
  local player = event.eventobjid
  StopLoop(player)
  local pos = CustomUI:GetElementAttrValue(player, SLIDER, ElementAttr.ScrollPosition)
  if pos and pos.x then SetValue(player, ValueOf(pos.x)) end -- 松手按最终位置再定一次
end

function Script:OnUIShow(event)
  local player = event.eventobjid
  press[player] = { active = false, task = nil, value = MIN_VAL }
  SetValue(player, MIN_VAL)
end

function Script:OnUIHide(event)
  StopLoop(event.eventobjid)
  press[event.eventobjid] = nil
end

function Script:OnStart()
  self:AddTriggerEvent(TriggerEvent.UIShow, self.OnUIShow, UI_ID)
  self:AddTriggerEvent(TriggerEvent.UIHide, self.OnUIHide, UI_ID)
  self:AddTriggerEvent(TriggerEvent.UIScrollPaneTouchBegin, self.OnSliderBegin, SLIDER)
  self:AddTriggerEvent(TriggerEvent.UIScrollPaneTouchEnd, self.OnSliderEnd, SLIDER)
end

return Script
