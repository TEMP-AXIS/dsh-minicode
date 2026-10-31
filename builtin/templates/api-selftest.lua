-- name: 引擎 API 自检骨架
-- desc: 玩家说「自检」时逐条试调用常用接口，把返回值与枚举表打进日志
-- tags: debug,selftest,api,enum
-- 自检骨架：先用它确认哪个接口真的存在、参数怎么传，再写业务脚本
local Script = {}

local function fmt(v)
  if v == nil then return "nil" end
  if type(v) == "table" then
    local parts = {}
    for k, val in pairs(v) do
      parts[#parts + 1] = tostring(k) .. "=" .. tostring(val)
    end
    return "{" .. table.concat(parts, ",") .. "}"
  end
  return tostring(v)
end

-- 一次拿到最多四个返回值，失败只打日志不中断
local function try(name, fn)
  local ok, a, b, c = pcall(fn)
  if ok then
    print("[OK] " .. name .. " = " .. fmt(a) .. " | " .. fmt(b) .. " | " .. fmt(c))
  else
    print("[NO] " .. name .. " : " .. tostring(a))
  end
end

-- 枚举都是全局表，直接 pairs 出来，别照着 wiki 猜数字
local function dumpEnum(name)
  local t = rawget(_G, name)
  if type(t) ~= "table" then
    print("[NO] enum " .. name)
    return
  end
  local parts = {}
  for k, v in pairs(t) do
    parts[#parts + 1] = tostring(k) .. "=" .. tostring(v)
  end
  print("[ENUM] " .. name .. " (" .. tostring(#parts) .. ") " .. table.concat(parts, " "))
end

function Script:Run(objid)
  print("=== 自检开始 ===")
  try("GetHours", function() return World:GetHours() end)
  try("GetDay", function() return World:GetDay() end)
  try("GetPosition", function() return Actor:GetPosition(objid) end)
  -- GetRayOriginPos 返回三个数，GetAimDir 返回 table
  try("RayOrigin", function() return Player:GetRayOriginPos(objid) end)
  try("AimDir", function() return Player:GetAimDir(objid) end)
  try("CurToolID", function() return Player:GetCurToolID(objid) end)
  try("GetCraftMaterialAndNum", function() return Player:GetCraftMaterialAndNum(objid) end)

  dumpEnum("GroupWeatherType")
  dumpEnum("TerrainType")
  dumpEnum("RayDetectType")
  dumpEnum("GridAttr")
  dumpEnum("ObjType")
  print("=== 自检结束 ===")
end

function Script:OnInput(p1, p2)
  local content, objid
  if type(p1) == "string" then
    content, objid = p1, p2
  elseif type(p1) == "table" then
    content, objid = p1.content, p1.eventobjid
  end
  if type(content) ~= "string" then return end
  if string.find(content, "自检", 1, true) then
    self:Run(objid)
  end
end

function Script:OnStart()
  self:AddTriggerEvent(TriggerEvent.PlayerNewInputContent, self.OnInput)
end

return Script
