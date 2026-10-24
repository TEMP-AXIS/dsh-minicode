-- name: 界面组件骨架
-- desc: UI_ID 常量表、每玩家状态、UIShow/UIHide 生命周期、按钮事件注册
-- tags: ui, lifecycle
-- 界面组件骨架：常量 → 每玩家状态 → 刷新 → 事件 → 注册
local Script = {}

local UI_ID = "7671951514247397838-111062" -- 界面ID（玩家给，不要编）
local ELEM = {
  CLOSE_BTN = UI_ID .. "_1",
  TITLE     = UI_ID .. "_2",
}

local state = {} -- state[player] = {...}

local function Get(player)
  local s = state[player]
  if not s then
    s = { score = 0 }
    state[player] = s
  end
  return s
end

local function Refresh(player)
  CustomUI:SetText(player, UI_ID, ELEM.TITLE, "分数 " .. Get(player).score)
end

function Script:OnUIShow(event)
  state[event.eventobjid] = { score = 0 }
  Refresh(event.eventobjid)
end

function Script:OnUIHide(event)
  -- 只做界面业务的数据在界面隐藏时就销毁
  state[event.eventobjid] = nil
end

function Script:OnCloseClick(event)
  Player:HideUIView(event.eventobjid, UI_ID)
end

function Script:OnStart()
  self:AddTriggerEvent(TriggerEvent.UIShow, self.OnUIShow, UI_ID)
  self:AddTriggerEvent(TriggerEvent.UIHide, self.OnUIHide, UI_ID)
  self:AddTriggerEvent(TriggerEvent.UIButtonClick, self.OnCloseClick, ELEM.CLOSE_BTN)
end

return Script
