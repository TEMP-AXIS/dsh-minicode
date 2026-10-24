-- name: 跨组件调用
-- desc: GameObject:FindObject + GetComponent 拿句柄并调用/关闭别人的界面
-- tags: component
-- 跨组件调用：只通过 GameObject:FindObject(对象ID):GetComponent(组件ID) 拿句柄
local Script = {}

local UI_ID = "7672093462916530638114458"        -- 本界面ID
local TARGET_OBJ = "7671924464543367630"         -- 目标组件挂在哪个对象上
local TARGET_COMP = "c7672099639079502286114958" -- 目标组件ID（c 开头）

-- 不写成常量、不校验：对象和组件不存在就是场景摆错了
local function Target()
  return GameObject:FindObject(TARGET_OBJ):GetComponent(TARGET_COMP)
end

function Script:OnCloseClick(event)
  Target():CloseUI(event.eventobjid, UI_ID)
end

-- 反过来，本组件对外暴露函数，别的组件 Target():OpenPanelAt(player, 2) 这样调
function Script:OpenPanelAt(playerId, mode)
  CustomUI:SetText(playerId, UI_ID, UI_ID .. "_1", tostring(mode))
end

function Script:OnStart()
  self:AddTriggerEvent(TriggerEvent.UIButtonClick, self.OnCloseClick, UI_ID .. "_9")
end

return Script
