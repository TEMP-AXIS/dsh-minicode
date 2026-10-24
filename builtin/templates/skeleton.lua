-- name: 行为脚本骨架
-- desc: Script 表 + OnStart 注册 AddTriggerEvent + return，任何新脚本的起点
-- tags: skeleton
-- 行为脚本骨架：新脚本从这里开始
local Script = {}

function Script:OnGameStart(event)
  -- 游戏开始：初始化变量、发欢迎语
  -- Chat:SendSystemMsg("欢迎", 0)
end

function Script:OnStart()
  self:AddTriggerEvent(TriggerEvent.GameStart, self.OnGameStart)
end

return Script
