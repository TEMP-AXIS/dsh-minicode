-- name: 玩家配置读写
-- desc: Data:GetValue/SetValue + json 存玩家配置，进图补默认字段
-- tags: data, config
-- 玩家配置：Data 里存 JSON 字符串，读的时候补默认值
local Script = {}

local VAR_CFG = "v7671973994106225102112172" -- 玩家变量ID（v 开头，玩家给，不要编）

local DEFAULT = {
  vibration = true,
  animation = true,
  close_ui  = false,
}

local function Save(player, data)
  Data:SetValue(VAR_CFG, player, json.encode(data))
end

local function Load(player)
  local data = json.decode(Data:GetValue(VAR_CFG, player))
  local changed = false
  for key, value in pairs(DEFAULT) do
    if data[key] == nil then data[key] = value; changed = true end
  end
  if changed then Save(player, data) end
  return data
end

function Script:OnPlayerEnter(event)
  Load(event.eventobjid) -- 进图补齐默认字段
end

function Script:OnStart()
  self:AddTriggerEvent(TriggerEvent.GameAnyPlayerEnterGame, self.OnPlayerEnter)
end

return Script
