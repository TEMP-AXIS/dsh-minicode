-- name: 长按连续触发
-- desc: 按下开 DoPeriodicTask 循环，松手 Cancel，到边界自动停
-- tags: ui, timer
-- 长按连续触发：按下开循环，松手取消，走到边界自己停
local Script = {}

local press = {} -- press[player] = { dir = nil, task = nil }

local function StopLoop(player)
  local p = press[player]
  p.dir = nil
  if p.task then p.task:Cancel(); p.task = nil end
end

-- 业务步进：能继续返回 true，到边界返回 false
local function Step(player, dir)
  local page = press[player].page or 1
  local nextPage = page + dir
  if nextPage < 1 or nextPage > 10 then return false end
  press[player].page = nextPage
  return true
end

local function StartLoop(player, dir, selfObj)
  local p = press[player]
  if p.task then return end
  p.dir = dir
  p.task = selfObj:DoPeriodicTask(function()
    if not Step(player, dir) then StopLoop(player) end
  end, 0.1, 0)
end

function Script:OnPlusPress(event)
  StartLoop(event.eventobjid, 1, self)
end

function Script:OnPlusRelease(event)
  StopLoop(event.eventobjid)
end

function Script:OnStart()
  self:AddTriggerEvent(TriggerEvent.UIButtonClick, self.OnPlusPress, UI_ID .. "_20")
  self:AddTriggerEvent(TriggerEvent.UIButtonRelease, self.OnPlusRelease, UI_ID .. "_20")
end

return Script
