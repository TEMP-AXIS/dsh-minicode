-- name: 克隆元件列表
-- desc: CloneElement + #cloneN 子元件命名 + DeleteElement 清理（最容易写错的一条）
-- tags: ui, clone, list
-- 克隆元件做列表：模板行先隐藏，CloneElement 返回的新ID带 #cloneN 后缀，
-- 行内的子元件ID = 子元件后缀 + 同一个 #cloneN 后缀。
local Script = {}

local UI_ID = "7671924464543367630-111562"
local ROW_TEMPLATE = UI_ID .. "_10" -- 编辑器里摆好的模板行，运行时隐藏
local ROW_TEXT = "_11"              -- 模板行里"文本"子元件的后缀

local state = {} -- state[player] = { ids = {}, data = {} }

local function SuffixOf(cloneId)
  return cloneId:match("#clone%d+$")
end

local function EnsureRows(player, count)
  local s = state[player]
  for i = #s.ids + 1, count do
    local clone = CustomUI:CloneElement(player, UI_ID, ROW_TEMPLATE)
    s.ids[i] = clone
    if i % 6 == 0 then threadpool:wait(0.01) end -- 克隆多了要分帧，否则卡帧
  end
end

local function FillRows(player, list)
  local s = state[player]
  EnsureRows(player, #list)
  for i, item in ipairs(list) do
    local rowId = s.ids[i]
    local textId = UI_ID .. ROW_TEXT .. SuffixOf(rowId)
    CustomUI:SetText(player, UI_ID, textId, item.name)
    CustomUI:SetPosition(player, UI_ID, rowId, 0, (i - 1) * 60)
    CustomUI:ShowElement(player, UI_ID, rowId)
    s.data[rowId] = item -- 点击时用 event.uielement 反查
  end
  for i = #list + 1, #s.ids do
    CustomUI:HideElement(player, UI_ID, s.ids[i])
    s.data[s.ids[i]] = nil
  end
end

function Script:OnUIShow(event)
  local player = event.eventobjid
  state[player] = { ids = {}, data = {} }
  CustomUI:HideElement(player, UI_ID, ROW_TEMPLATE)
  FillRows(player, { { name = "第一行" }, { name = "第二行" } })
end

function Script:OnUIHide(event)
  local player = event.eventobjid
  local s = state[player]
  if not s then return end
  -- 克隆出来的元件必须自己删，否则下次打开又克隆一批
  for _, rowId in ipairs(s.ids) do
    CustomUI:DeleteElement(player, UI_ID, rowId)
  end
  state[player] = nil
end

function Script:OnClick(event)
  local player = event.eventobjid
  local item = state[player].data[event.uielement]
  if not item then return end
  Player:NotifyGameInfo2Self(player, "点了 " .. item.name)
end

function Script:OnStart()
  self:AddTriggerEvent(TriggerEvent.UIShow, self.OnUIShow, UI_ID)
  self:AddTriggerEvent(TriggerEvent.UIHide, self.OnUIHide, UI_ID)
  self:AddTriggerEvent(TriggerEvent.UIButtonClick, self.OnClick)
end

return Script
