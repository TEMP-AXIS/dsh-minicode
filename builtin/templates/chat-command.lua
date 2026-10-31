-- name: 聊天指令脚本骨架
-- desc: 监听玩家聊天输入，兼容两种事件参数形态，按关键词回话（时间 / 位置 / 帮助）
-- tags: chat,command,trigger
-- 聊天指令骨架：玩家说话 → 取内容 → 关键词分发 → 回话
local Script = {}

local HELP = "可用指令：时间 / 位置 / 帮助"

-- 回话走两个通道：聊天框给玩家看，print 进日志方便排查
local function say(text, objid)
  if Chat and Chat.SendSystemMsg then
    pcall(function() Chat:SendSystemMsg(text, objid) end)
  end
  print("[指令] " .. tostring(text))
end

-- 事件参数有两种形态：直接给字符串，或给一个 table
local function readInput(p1, p2)
  local content, objid
  if type(p1) == "string" then
    content, objid = p1, p2
  elseif type(p1) == "table" then
    content = p1.content or p1.contenttext or p1.text
    objid = p1.eventobjid or p1.objid
  end
  if type(content) ~= "string" then return nil, objid end
  return (string.gsub(content, "^%s*(.-)%s*$", "%1")), objid
end

function Script:OnInput(p1, p2)
  local q, objid = readInput(p1, p2)
  if not q or q == "" then return end

  if string.find(q, "帮助", 1, true) then
    say(HELP, objid)
  elseif string.find(q, "时间", 1, true) then
    local day = World:GetDay()
    local hour = World:GetHours()
    say("现在是第 " .. tostring(day) .. " 天 " .. tostring(hour) .. " 点", objid)
  elseif string.find(q, "位置", 1, true) then
    -- 冒号调用：点调用会把 objid 当 self，静默返回 nil
    local x, y, z = Actor:GetPosition(objid)
    say(string.format("你在 %.1f, %.1f, %.1f", x or 0, y or 0, z or 0), objid)
  else
    say("没听懂：" .. q, objid)
    say(HELP, objid)
  end
end

function Script:OnStart()
  self:AddTriggerEvent(TriggerEvent.PlayerNewInputContent, self.OnInput)
end

return Script
