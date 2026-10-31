-- name: 定时任务骨架
-- desc: DoPeriodicTask 起循环、显式传 self、到点或收指令时安全 Cancel
-- tags: periodic,timer,DoPeriodicTask
-- 定时任务骨架：起 / 停 / 计数 / 到边界自动停
local Script = {}

local task = nil
local ticks = 0
local INTERVAL = 1

function Script:StopTick()
  if task then
    -- 不同版本的句柄方法名不完全一样，两种都试一次
    pcall(function() task:Cancel() end)
    pcall(function() task:cancel() end)
    task = nil
  end
  print("[tick] stop after " .. tostring(ticks))
end

function Script:OnTick(objid)
  ticks = ticks + 1
  print("[tick] " .. tostring(ticks))
  if ticks >= 10 then
    self:StopTick()
  end
end

function Script:StartTick()
  if task then return end
  ticks = 0
  -- 显式传 self：回调里才拿得到脚本对象，否则 Cancel 不掉
  task = DoPeriodicTask(self.OnTick, INTERVAL)
  print("[tick] start every " .. tostring(INTERVAL) .. "s")
end

function Script:OnInput(p1, p2)
  local content
  if type(p1) == "string" then
    content = p1
  elseif type(p1) == "table" then
    content = p1.content
  end
  if type(content) ~= "string" then return end
  if string.find(content, "开始", 1, true) then
    self:StartTick()
  elseif string.find(content, "停止", 1, true) then
    self:StopTick()
  end
end

function Script:OnStart()
  self:AddTriggerEvent(TriggerEvent.PlayerNewInputContent, self.OnInput)
end

return Script
