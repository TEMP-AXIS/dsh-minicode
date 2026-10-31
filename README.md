# dsh-minicode

[![GitHub stars](https://img.shields.io/github/stars/TEMP-AXIS/dsh-minicode?style=flat-square&label=stars)](https://github.com/TEMP-AXIS/dsh-minicode/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/TEMP-AXIS/dsh-minicode?style=flat-square&label=issues)](https://github.com/TEMP-AXIS/dsh-minicode/issues)
[![version](https://img.shields.io/github/package-json/v/TEMP-AXIS/dsh-minicode?style=flat-square&label=version)](https://github.com/TEMP-AXIS/dsh-minicode/blob/main/package.json)
[![license](https://img.shields.io/github/license/TEMP-AXIS/dsh-minicode?style=flat-square)](https://github.com/TEMP-AXIS/dsh-minicode/blob/main/LICENSE)

MiniWorld (迷你世界) UGC 开发文档（<https://dev-wiki.mini1.cn/ugc-wiki/>）的**离线索引 + 查询工具**，
给 DeepSeek Harness 的 agent 用：索引和 ID 表都**随插件一起发布**，运行时只读本地 JSON，
单次查询通常只花几百 token，不联网、不抓取任何站点、不需要 SQLite、没有原生依赖。

除了 12 个给 agent 的 `ugc_*` 工具，插件还在 DSH 设置页里加了一页 **MiniCode**：
索引状态、易错点记忆、代码模板库、ID 登记表、自动维护开关。

记忆和模板都是**由 AI 自己维护**的：`ugc_guide` 里带着「收尾时自己记一条 / 自己存模板」的规则，
设置页的自动维护标签只负责开或关；另外随插件附了 22 条只读记忆和 10 个只读模板（照一套真实工程与一批真机 API 实测总结，见「内置记忆与模板」）。
ID 表随插件内置 14 类、约 2.65 万个名字（见「ID」一节）。

> 0.4.0 起插件名是 **dsh-minicode**（原来叫 dsh-ugc-wiki）：包名、设置页标题、数据目录都跟着改了，
> 只有给 agent 的 12 个工具仍叫 `ugc_*` —— 那是它们真正在做的事（查 UGC 百科），改名会让提示词和已有菜谱全部失效。

> 0.5.0 起**运行时不再联网抓任何站点**：ID 表改为随包内置的全量表（14 类 / 26493 个名字，含方块 950、
> 道具 17838），设置页的「同步官方 ID 表」和索引爬取按钮都已删除；内置记忆 12 → 22 条、模板 7 → 10 个。

## 开源地址

- 仓库：<https://github.com/TEMP-AXIS/dsh-minicode>
- 点个 **Star**：<https://github.com/TEMP-AXIS/dsh-minicode/stargazers>
- 提 **Issue** / 反馈 bug：<https://github.com/TEMP-AXIS/dsh-minicode/issues>
- 克隆：`git clone https://github.com/TEMP-AXIS/dsh-minicode.git`

插件会自己查有没有新版本：DSH 启动时读一次 GitHub 仓库（结果缓存 6 小时），发现新版就在
`ugc_status` 末尾写一行 `update: <仓库地址>`，设置页「索引」标签底部也会显示当前版本 / 最新版本 /
star / issue 数和三个链接。想手动查就点那里的`检查更新`按钮；不想让它联网就去「自动维护」把
`自动检查更新`关掉（默认开）。

## 安装

### 从 GitHub 源码安装（推荐）

```bash
dsh plugin --profile desktop add github:TEMP-AXIS/dsh-minicode
```

这条走 pnpm 的 git 依赖解析，需要：

1. 本机装了 **Git**，并且 `git` 在 PATH 上 —— pnpm 用 `git ls-remote` 解析 `github:` 依赖；
   从 Electron 里起 DSH 时 PATH 可能和终端不一样，装之前先 `git --version` 确认一下。
2. pnpm 默认禁止 git 依赖执行构建脚本；如果装的时候提示，把它打印的那个精确包名
   （形如 `dsh-minicode@git+https://github.com/TEMP-AXIS/dsh-minicode.git#<sha>`）加到
   `~/.dsh/profiles/desktop/pnpm-workspace.yaml` 的 `allowBuilds` 下再装一次。
   本插件没有构建步骤（`lib/` 和 `data/` 直接就是源码 + 索引），一般不会触发。

### 没有 git？用源码压缩包

```bash
dsh plugin --profile desktop add https://github.com/TEMP-AXIS/dsh-minicode/archive/refs/heads/main.tar.gz
```

pnpm 能直接把 GitHub 的仓库压缩包当依赖装（本机实测了这个形式，无需 git、无构建脚本）。
缺点是压缩包会把 `_probe/` 一起带上（约 1 MB）；想干净就先 `git clone` 再 `link:`。

### 用发布的资源包安装（离线、无需 git）

`dist/` 里有两个等价制品，选一个：

| 文件 | 用途 |
|---|---|
| `dsh-minicode-0.5.0.tgz` | pnpm 能直接当依赖装（推荐） |
| `dsh-minicode-0.5.0.zip` | 解压即用的源码目录，看代码或 `link:` 都行 |

```bash
dsh plugin --profile desktop add file:C:/path/to/dsh-minicode-0.5.0.tgz
# 或者解压 zip 后
dsh plugin --profile desktop add link:C:/path/to/dsh-minicode-0.5.0
```

包内含 index.js / client.js / lib/ / builtin/ / data/（索引 + 全量 ID 表）/ scripts/ / README /
CHANGELOG / cordis.patch.yml / icon.svg，共 64 个文件、约 440 KB，不含 `_probe/` 与调试脚本。

### 从本地副本安装（改代码时用这个）

```bash
git clone https://github.com/TEMP-AXIS/dsh-minicode.git
dsh plugin --profile desktop add link:C:/path/to/dsh-minicode
```

`link:` 是软链接，改完文件**重启 DSH** 就生效，不用重装。

### 装完

`package.json` 的 `dsh.profile.bundles` 里要有 `dsh-minicode`（上面两条命令都会自动加），
**重启 DSH** 后 12 个 `ugc_*` 工具和设置页才会出现。

## 工具（12 个）

| 工具 | 作用 | 典型成本 |
| --- | --- | --- |
| `ugc_search` | 按名字/中文描述搜函数与事件，一行一条 | ~70 token/条 |
| `ugc_api` | 单个函数的完整卡片：签名、参数类型、返回值、说明、Lua 示例 | ~250 token |
| `ugc_module` | 整模块函数表（actor 75 个函数 ≈ 4.4 KB） | ~1.2k token |
| `ugc_event` | 事件名、触发时机、回调参数 | ~100–250 token |
| `ugc_enum` | 96 组常量枚举（WorldType、AbsoluteCampType…） | ~150 token/组 |
| `ugc_doc` | 教程/概念/组件函数/更新日志等 15 篇散文页，可按小节读 | 200–4000 字符 |
| `ugc_pack` | 给一段任务描述自动拼一份 API 上下文包（带字符预算） | 预算内 |
| `ugc_status` | 索引来源与构建时间、wiki 修订时间、条目数、记忆/模板/ID 统计、版本与更新提示 | ~950 字符 |
| `ugc_guide` | 迷你世界 Lua 脚本骨架、查阅顺序、置顶的易错点 | ~1.6 KB |
| `ugc_memory` | 易错点记忆：`add` / `list` / `search` / `delete` / `pin` / `clear-misses` | 小 |
| `ugc_template` | 代码模板库：`list` / `get` / `save` / `delete` | 模板大小 |
| `ugc_ids` | ID 登记表：`lookup` / `set` / `list` / `request` / `pending` | 小 |

推荐流程：`ugc_guide` 一次 → `ugc_search` 找名字 → `ugc_api` 看卡片 → 写代码；
多 API 任务直接用 `ugc_pack`；写模板/骨架先 `ugc_template list`；凡是要填 id，先 `ugc_ids lookup`。

## 设置页：设置 → MiniCode

五个标签页，全部走宿主端 `/dsh-minicode/api`（同一个插件注册的 HTTP 前缀）：

1. **索引** — 索引来源（插件内置 / 自备 index.json）、文件路径、构建时间、wiki 更新、条目统计、数据目录；
   只有 `刷新` 一个按钮。**插件不抓取任何站点**：索引随包发布，想换就自己把 index.json 放进数据目录。
   卡片底部是版本区：当前版本、
   `检查更新` 按钮（读 GitHub，显示 star / issue 数和最新提交）、以及仓库 / Star / Issue 三个链接。
2. **记忆** — 记录「常出错的地方」：主题 / 常见错误 / 正确写法 / 标签。
   命中相关查询时，`ugc_search` / `ugc_api` / `ugc_pack` 会在结果末尾自动附上这些纠错；
   置顶的条目还会进 `ugc_guide`。**这一页只读**：条目要么随插件发布（22 条内置），
   要么由 AI 在任务中自己记（`ugc_memory action=add`）；页面上不能手动新增，
   人工补条目走 `builtin/memory/*.json` 的 PR（见 [CONTRIBUTING.md](CONTRIBUTING.md)）。
   下方列出「查不到的问题」（零命中的搜索自动记录），可以忽略或清空。
3. **模板** — 10 个内置模板（行为脚本骨架、界面组件骨架、克隆元件列表、滑动条、长按连续触发、
   跨组件调用、玩家配置读写、聊天指令、API 自检、定时任务）+ AI 自己存的模板，**只能查看**（点「查看」展开源码）。
   同样不能手动新增：人工加模板改 `builtin/templates/*.lua` 提 PR。
4. **ID 登记** — 见下节；顶部显示内置 ID 表的条数与玩家自填条数，没有联网按钮。
5. **自动维护** — 三个开关，默认全开：`自动记忆`（AI 收尾时自己记纠错）、
   `自动模板`（AI 自己把验证过的脚本存成模板）、`自动检查更新`。
   前两个关掉只是让 agent 不再主动写入，工具照常可用；最后一个只挡插件自己发起的 GitHub 查询。
   开关存在 `config.json`。

数据都在 `~/.dsh-minicode`（可用 `DSH_MINICODE_DATA_DIR` 改到别处，拒绝写到文件系统根目录；
0.4.0 之前的 `~/.dsh-ugc-wiki` 会在首次启动时自动改名迁过去）：

| 文件 | 内容 |
| --- | --- |
| `memory.json` | AI 记下的记忆 + 查不到的问题（上限 400 / 80；内置 22 条不写盘） |
| `templates.json` | AI 存下的模板（内置 10 个不写盘） |
| `ids.json` | 玩家自填的 id（来源 `player`）+ 待填写请求 |
| `config.json` | 三个开关（`autoMemory` / `autoTemplates` / `autoUpdate`） |
| `update.json` | 最近一次 GitHub 更新检查的缓存（版本、star、issue、最新提交，6 小时有效） |
| `index.json` | 自己放的索引（可选）；存在时优先于插件内置的 `data/ugc-wiki.json` |

## 内置记忆与模板

这两张表是照着一套真实的迷你世界 UGC 工程（10 个组件、约 200 KB Lua）总结出来的，随插件发布、只读，
在 `ugc_memory` / `ugc_template` 里标 `[内置]`。**一个条目一个文件**：`builtin/memory/<id>.json`、`builtin/templates/<id>.lua`，
加一条就是加一个文件、提一个 PR —— 格式和自查命令见 [CONTRIBUTING.md](CONTRIBUTING.md)。

**22 条记忆**（其中 5 条置顶，直接进 `ugc_guide`）：

| 记忆 | 坑 |
| --- | --- |
| 克隆元件 | 不 `HideElement` 就 `CloneElement`，再拿模板 ID 去 `SetText`；克隆不带文本/颜色 |
| 克隆清理 | 关界面只清 state，克隆元件留在界面上；每次 UIShow 重新克隆，元件越堆越多 |
| 克隆点击 | 用模板 ID 判断点了哪一行（应该走 `event.uielement` → cloneMap） |
| 克隆性能 | 一次克隆几十行卡住主线程（应该每 6 行 `threadpool:wait(0.01)`） |
| 滑动条取值 | 用点击事件读位置，或没注册 `UIScrollPaneTouchBegin` / `TouchEnd` |
| 滑动条轮询 | 只在 TouchEnd 读一次，拖动过程中数值不动 |
| 滑动条回写 | 数值一变就 `TurnSliderToPos`，手指被拽回去、数值来回跳 |
| 滑动条方向 | 滚动面板的 x 是反的（`ratio = (W - x) / W`） |
| 引擎接口 | `AddTriggerEvent` / `DoPeriodicTask` / `GetElementAttrValue` 在 wiki 里查不到，但组件脚本里就有 |
| 变量 id | 界面型变量 id 只能玩家给，不许编 |
| 玩家状态 | 用全局变量存每玩家状态，UI 隐藏时不清理 |
| 代码风格 | 满屏防御性判断、一次性常量写成顶层 local、函数切得过碎 |
| 脚本形态 | 写成 `return M` 模块再 dofile / require 组装；引擎里一个文件就是一个行为脚本，没有模块系统 |
| 冒号调用 | `Actor.GetPosition(objid)` 点调用：objid 被当 self，返回 nil,nil,nil 且不报错 |
| 射线取点 | `GetRayOriginPos` 返回三个数（不是 table），`GetAimDir` 才是 table |
| 枚举真名 | `ItemId` 实际叫 `GridAttr`、`ActorType` 叫 `ObjType`；枚举是全局表，可 pairs |
| 富文本标记 | 描述里的 `@item_102#`、`#c0aba1d`、`#r` 要洗掉，正文不会出现 # |
| 天气枚举 | 用 0 起的 `GroupWeatherType`（12 值），别用带历史别名的 `WeatherType` |
| 地形枚举 | `TerrainType` 是 Flat=0 / Normal=1；`BiomeType` 有 106 项、同样 0 起 |
| 无配方 | `GetCraftMaterialAndNum` 返回 nil 属正常（自然方块），不要编材料 |
| 聊天事件参数 | `PlayerNewInputContent` 的参数可能是字符串，也可能是 table，两种都要兼容 |
| 定时任务 | `DoPeriodicTask` 要显式传 self，否则回调里拿不到脚本对象、Cancel 不掉 |

**10 个模板**（`ugc_template list` 看全部，`get` 取源码）：

| id | 内容 |
| --- | --- |
| `skeleton` | `local Script = {}` + `OnStart` 里 `AddTriggerEvent` + `return Script` |
| `ui-base` | UI_ID 常量、每玩家状态、UIShow / UIHide 生命周期、按钮注册 |
| `ui-clone` | 克隆行列表：模板行隐藏 → CloneElement → `#cloneN` 子元件 ID → DeleteElement 清理 |
| `slider` | 滑动条：TouchBegin/End + 0.03 秒轮询 + 反向换算 + `TurnSliderToPos` 回写 |
| `hold-repeat` | 长按连续触发：按下开 `DoPeriodicTask`，松手 `:Cancel()`，到边界自动停 |
| `cross-component` | `FindObject(...):GetComponent(...)` 调别人、`comp:CloseUI` 关别人界面 |
| `player-config` | `Data:GetValue` / `SetValue` + json 存玩家配置，进图补默认字段 |
| `chat-command` | 聊天指令：参数两种形态兼容 + 关键词分发（时间 / 位置 / 帮助）+ 双通道回话 |
| `api-selftest` | API 自检：pcall 逐条试调用打 `[OK]/[NO]`、pairs 打枚举表 `[ENUM]`，说「自检」触发 |
| `periodic-task` | 定时任务：`DoPeriodicTask` 显式传 self、句柄存起来、计到 10 次自动 Cancel |

## ID：随包内置的全量表 + 玩家补

**UGC wiki 本身没有 id 表**：全站 40 个页面里没有一列数字 id，正文里挖出的「XXID = 123」总共只有 3 条。
所以 id 表是**随插件发布的数据**，运行时不联网、不去抓任何站点。

`data/official-ids.json`（655 KB）在打包时由 `scripts/import-sjy.mjs` 从社区整理的全量 id 表生成，
**不做区间过滤**：预留段、占位行、颜色变体都原样保留，查得到总比查不到好。13 个源文件合并成 **14 个 kind / 26493 个名字**：

| kind | 名字数 | 说明 |
| --- | --- | --- |
| item | 17838 | 道具（含方块类道具） |
| effect | 2533 | 特效 |
| block | 950 | 方块（沿用官方方块表） |
| model | 912 | 模型 |
| creature | 909 | 生物 |
| skin | 601 | 皮肤 |
| buff | 544 | 状态 |
| picture | 526 | 图片库 |
| sound | 494 | 音效 |
| particle | 314 | 粒子 |
| spell | 300 | 法术（强化 236 + 生成 64） |
| skill | 273 | 坐骑技能 |
| act | 241 | 动作 |
| enchant | 58 | 附魔 |

插件首次启动时把整张表灌进 ID 登记表（实测毫秒级、零网络请求）——所以装好重启后 `ugc_ids lookup` 立刻能用。

1. `ugc_ids lookup` 先命中内置表（也可按数字反查名字，如 `lookup 1001`）；
2. 内置表里没有的（**变量ID、元件ID** 只存在于玩家自己的地图）才会问玩家：
   工具提示「不要编造 id」，并把需求写进 `ids.json` 的等待列表；
3. 玩家在 设置 → MiniCode → **ID 登记** 填写；`source=player` 的值**永远优先**于内置表，
   换新版本插件也不会覆盖它；
4. 想更新整张表：重新跑 `node scripts/import-sjy.mjs` 再发版，插件端不提供联网同步入口。

## 数据

`data/ugc-wiki.json`（构建产物，随包发布）：

- 40 个页面（39 个内容页 + 1 个导航页），4.4 MB HTML → 约 235k token 的正文，压缩成 692 KiB 结构化 JSON
- 571 个 API 函数（1768 个参数）、242 个事件、96 组枚举（876 个取值）、15 篇散文页
- 记录形状（API）：`{kind,id,module,moduleCn,receiver,name,anchor,page,desc,sig,params[{name,type,desc}],returns,note,example}`
- 增量同步键：每页页脚的 `Last updated: <time datetime>` → `meta.wikiUpdated`
- `data/official-ids.json`：全量 id 表快照（14 个 kind、26493 条、655 KB），首次启动时灌进 ID 登记表

### 刷新索引（维护者操作）

索引随包发布，**插件运行时不会去抓 wiki**。要重建随包数据，由维护者在本机跑：

```bash
node scripts/build.mjs              # 抓一次 wiki 并重建 data/ugc-wiki.json
node scripts/build.mjs --offline    # 用 _probe/pages 里的缓存页面重建（离线、秒级）
node scripts/import-sjy.mjs         # 重建 data/official-ids.json（全量 id 表）
```

构建脚本只请求约 40 个静态 HTML 页面（VitePress 全静态渲染，无需无头浏览器）：
页面清单取自首页侧边栏，4 并发、3 次重试，解析失败只影响单页。产物随包发布，终端用户看不到这些请求。

## 结构

```
index.js             cordis 插件：注册 12 个工具 + /dsh-minicode/api（无第三方依赖）
client.js            浏览器端：设置页五个标签（window.__ModuleLoader__）
lib/store.mjs        索引加载、IDF 加权检索、模块/页面解析
lib/format.mjs       文本渲染（签名行 / 完整卡片 / 压缩卡片 / 模块表）
lib/memory.mjs       易错点记忆 + 查不到的问题（内置记忆从 builtin/ 读）
lib/templates.mjs    模板库（内置模板从 builtin/ 读 + AI 自存的）
lib/builtin.mjs      内置记忆 / 模板的加载器（一个文件一条，启动时读一次）
lib/ids.mjs          ID 登记表 + 待填写请求 + 官方表批量导入
lib/idsource.mjs     内置 id 表的加载与灌库（不联网）
lib/config.mjs       自动维护开关（config.json）
lib/update.mjs       GitHub 仓库查询：版本比较、star / issue、检查更新缓存
lib/harvest.mjs      从语料里挖 id 数字（构建期工具，运行时不调用）
lib/crawl.mjs        抓取 40 页并组装索引（构建期工具，插件运行时不调用）
lib/api.mjs          /dsh-minicode/api 路由（只读本地数据，无抓取任务）
lib/web.mjs          JSON 收发小工具
lib/paths.mjs        数据目录（~/.dsh-minicode，含旧目录迁移）
lib/jsonfile.mjs     原子读写 JSON
lib/html.mjs         无依赖 HTML 树构建器（解析期用）
scripts/build.mjs    命令行爬虫（调用 lib/crawl.mjs，维护者用）
scripts/import-sjy.mjs     全量 id 表 → data/official-ids.json（维护者用）
scripts/parse.mjs    单页解析（四种页面形状）
scripts/check-contrib.mjs  校验 builtin/ 里的记忆和模板（PR 前跑，npm test 也跑）
builtin/memory/*.json      22 条内置记忆，一个文件一条
builtin/templates/*.lua    10 个内置模板，一个文件一个脚本
CONTRIBUTING.md      怎么加一条记忆 / 一个模板（一个文件一个 PR）
data/ugc-wiki.json   构建产物
data/official-ids.json  全量 id 表快照（首次启动灌进 ID 登记表）
```

## 排查

想让插件在启动时留一行痕迹（确认 bundle 真的挂载了），给宿主进程加环境变量：

```
DSH_MINICODE_DEBUG=<某个可写路径>   # apply() 结束后追加一行 "dsh-minicode applied: 12 tools, 571 apis, api /dsh-minicode/api"
```

不设这个变量时插件不写任何文件。

给 `webServer.register()` **不要**挂 `sub.effect(() => dispose())`：在
`ctx.inject(['webServer'], cb)` 的作用域里这个清理函数会立刻执行，路由被当场注销，
所有 `/dsh-minicode/api/*` 请求就会落回 SPA 的 404（本插件踩过这个坑，注释里写了原因）。

## 备注

- 文档版权归迷你世界官方所有，本插件只是本地检索索引，不修改内容。
- 解析器按 VitePress 的四种页面形状工作：API 函数页、枚举页、事件页、散文页；
  散文页里嵌的函数表会被抽取为额外的 API 记录（componentapi、globalfunc、obj…）。
- `apis/API.html` 只是导航页，构建时跳过。
- 更新检查只读公开的 GitHub API 与 `raw.githubusercontent.com`，不发任何本地信息；
  仓库还没公开时（API 返回 404）会显示「仓库还没有公开」，不影响任何工具。
