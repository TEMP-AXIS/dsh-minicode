# dsh-ugc-wiki

[![GitHub stars](https://img.shields.io/github/stars/TEMP-AXIS/dsh-minicode?style=flat-square&label=stars)](https://github.com/TEMP-AXIS/dsh-minicode/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/TEMP-AXIS/dsh-minicode?style=flat-square&label=issues)](https://github.com/TEMP-AXIS/dsh-minicode/issues)
[![version](https://img.shields.io/github/package-json/v/TEMP-AXIS/dsh-minicode?style=flat-square&label=version)](https://github.com/TEMP-AXIS/dsh-minicode/blob/main/package.json)
[![license](https://img.shields.io/github/license/TEMP-AXIS/dsh-minicode?style=flat-square)](https://github.com/TEMP-AXIS/dsh-minicode/blob/main/LICENSE)

迷你世界 UGC 开发文档（<https://dev-wiki.mini1.cn/ugc-wiki/>）的**离线索引 + 查询工具**，
给 DeepSeek Harness 的 agent 用：爬虫按需跑（在设置页点按钮），回答期只读一个 692 KiB 的 JSON，
单次查询通常只花几百 token，不需要联网、不需要 SQLite、没有原生依赖。

除了 12 个给 agent 的 `ugc_*` 工具，插件还在 DSH 设置页里加了一页 **UGC 百科**：
索引状态与手动抓取、易错点记忆、代码模板库、ID 登记表、自动维护开关。

记忆和模板都是**由 AI 自己维护**的：`ugc_guide` 里带着「收尾时自己记一条 / 自己存模板」的规则，
设置页的自动维护标签只负责开或关；另外随插件附了 12 条只读记忆和 7 个只读模板（照一套真实工程总结，见「内置记忆与模板」）。
ID 表另有一个官方来源（见「ID」一节）。

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
   （形如 `dsh-ugc-wiki@git+https://github.com/TEMP-AXIS/dsh-minicode.git#<sha>`）加到
   `~/.dsh/profiles/desktop/pnpm-workspace.yaml` 的 `allowBuilds` 下再装一次。
   本插件没有构建步骤（`lib/` 和 `data/` 直接就是源码 + 索引），一般不会触发。

### 没有 git？用源码压缩包

```bash
dsh plugin --profile desktop add https://github.com/TEMP-AXIS/dsh-minicode/archive/refs/heads/main.tar.gz
```

pnpm 能直接把 GitHub 的仓库压缩包当依赖装（本机实测了这个形式，无需 git、无构建脚本）。
缺点是压缩包会把 `_probe/` 一起带上（约 1 MB）；想干净就先 `git clone` 再 `link:`。

### 从本地副本安装（改代码时用这个）

```bash
git clone https://github.com/TEMP-AXIS/dsh-minicode.git
dsh plugin --profile desktop add link:C:/path/to/dsh-minicode
```

`link:` 是软链接，改完文件**重启 DSH** 就生效，不用重装。

### 装完

`package.json` 的 `dsh.profile.bundles` 里要有 `dsh-ugc-wiki`（上面两条命令都会自动加），
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

## 设置页：设置 → UGC 百科

五个标签页，全部走宿主端 `/ugc-wiki/api`（同一个插件注册的 HTTP 前缀）：

1. **索引** — 索引来源（插件内置 / 手动抓取）、文件路径、构建时间、wiki 更新、条目统计、数据目录；
   按钮：`立即抓取 wiki`（后台任务 + 进度条，可取消）、`从 wiki 提取内置 id`、`刷新`。
   **抓取只在点按钮时发生**，插件启动、agent 调用都不会联网。卡片底部是版本区：当前版本、
   `检查更新` 按钮（读 GitHub，显示 star / issue 数和最新提交）、以及仓库 / Star / Issue 三个链接。
2. **记忆** — 记录「常出错的地方」：主题 / 常见错误 / 正确写法 / 标签。
   命中相关查询时，`ugc_search` / `ugc_api` / `ugc_pack` 会在结果末尾自动附上这些纠错；
   置顶的条目还会进 `ugc_guide`。下方列出「查不到的问题」（零命中的搜索自动记录），可一键转成记忆。
   12 条**内置记忆**只读（见「内置记忆与模板」一节），自己记的条目可编辑、可删。
3. **模板** — 7 个内置模板（行为脚本骨架、界面组件骨架、克隆元件列表、滑动条、长按连续触发、
   跨组件调用、玩家配置读写）只读，可`另存为副本`；自定义模板可编辑、可删。
4. **ID 登记** — 见下节；顶部有`同步官方 ID 表`按钮（8 张表，同步中会显示进度）。
5. **自动维护** — 四个开关，默认全开：`自动记忆`（AI 收尾时自己记纠错）、
   `自动模板`（AI 自己把验证过的脚本存成模板）、`爬取后同步官方 ID 表`、`自动检查更新`。
   前三个关掉只是让 agent 不再主动写入，工具照常可用；最后一个只挡插件自己发起的 GitHub 查询。
   开关存在 `config.json`。

数据都在 `~/.dsh-ugc-wiki`（可用 `DSH_UGC_DATA_DIR` 改到别处，拒绝写到文件系统根目录）：

| 文件 | 内容 |
| --- | --- |
| `memory.json` | 易错点记忆（自己记的）+ 查不到的问题（上限 400 / 80；内置 12 条不写盘） |
| `templates.json` | 自定义模板（内置 7 个不写盘） |
| `ids.json` | 已登记 id（来源 `player` / `official` / `harvest`）+ 待填写请求 |
| `config.json` | 四个开关（`autoMemory` / `autoTemplates` / `autoIds` / `autoUpdate`） |
| `update.json` | 最近一次 GitHub 更新检查的缓存（版本、star、issue、最新提交，6 小时有效） |
| `index.json` | 设置页抓取产生的索引；存在时优先于插件内置的 `data/ugc-wiki.json` |

## 内置记忆与模板

这两张表是照着一套真实的迷你世界 UGC 工程（10 个组件、约 200 KB Lua）总结出来的，随插件发布、只读，
在 `ugc_memory` / `ugc_template` 里标 `[内置]`；不想要就改 `lib/memory.mjs` 的 `SEED` 或 `lib/templates.mjs` 的 `META`。

**12 条记忆**（前三条置顶，直接进 `ugc_guide`）：

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

**7 个模板**（`ugc_template list` 看全部，`get` 取源码）：

| id | 内容 |
| --- | --- |
| `skeleton` | `local Script = {}` + `OnStart` 里 `AddTriggerEvent` + `return Script` |
| `ui-base` | UI_ID 常量、每玩家状态、UIShow / UIHide 生命周期、按钮注册 |
| `ui-clone` | 克隆行列表：模板行隐藏 → CloneElement → `#cloneN` 子元件 ID → DeleteElement 清理 |
| `slider` | 滑动条：TouchBegin/End + 0.03 秒轮询 + 反向换算 + `TurnSliderToPos` 回写 |
| `hold-repeat` | 长按连续触发：按下开 `DoPeriodicTask`，松手 `:Cancel()`，到边界自动停 |
| `cross-component` | `FindObject(...):GetComponent(...)` 调别人、`comp:CloseUI` 关别人界面 |
| `player-config` | `Data:GetValue` / `SetValue` + json 存玩家配置，进图补默认字段 |

## ID：官方表 + 玩家补

**UGC wiki 本身没有 id 表**：全站 40 个页面里没有一列数字 id，正文里挖出的「XXID = 123」总共只有 3 条。

但**旧官网有**：<https://developers.mini1.cn/wiki/iddatas.html>（迷你世界 ID 查询）挂了 8 张真表，
在 `/wiki/data_files/` 下，格式是重复的「(ID, 名字)」列对（一行最多四组）：

| 表 | 类型 | 条数 |
| --- | --- | --- |
| `blockdef.html` | 方块 | 1142 |
| `itemdef.html` | 道具 | 1764 |
| `monster.html` | 生物 | 186 |
| `particles.html` | 特效 | 314 |
| `Sound.html` | 音效 | 494 |
| `buffdef.html` | 状态 | 117 |
| `triggeract.html` | 动作 | 20 |
| `DevUIResource.html` | 图片库 | 527 |

去重后 **4151 条**进 ID 登记表，来源标 `official`。这 8 张表还被打包成快照
`data/official-ids.json`（52 KB），插件第一次启动时如果登记表里没有官方条目，
就自动灌进去（实测 28 ms、零网络请求）——所以装好重启后 `ugc_ids lookup` 立刻能用。

1. `ugc_ids lookup` 先命中官方表（也可按数字反查名字，如 `lookup 1001`）；
2. 官方表里没有的（**变量ID、元件ID** 只存在于玩家自己的地图）才会问玩家：
   工具提示「不要编造 id」，并把需求写进 `ids.json` 的等待列表；
3. 玩家在 设置 → UGC 百科 → **ID 登记** 填写；`source=player` 的值**永远优先**于官方表，
   重新同步官方表不会覆盖它；
4. 同步时机：设置页`同步官方 ID 表`按钮随时可点；勾了`爬取后同步官方 ID 表`时，
   每次手动抓取 wiki 成功后还会顺带刷新这 8 张表。

设置页的`从 wiki 提取内置 id`按钮仍在：它把 wiki 语料里的 id 数字扫一遍，来源标 `harvest`。

## 数据

`data/ugc-wiki.json`（构建产物，随包发布）：

- 40 个页面（39 个内容页 + 1 个导航页），4.4 MB HTML → 约 235k token 的正文，压缩成 692 KiB 结构化 JSON
- 571 个 API 函数（1768 个参数）、242 个事件、96 组枚举（876 个取值）、15 篇散文页
- 记录形状（API）：`{kind,id,module,moduleCn,receiver,name,anchor,page,desc,sig,params[{name,type,desc}],returns,note,example}`
- 增量同步键：每页页脚的 `Last updated: <time datetime>` → `meta.wikiUpdated`
- `data/official-ids.json`：旧官网 8 张 id 表的快照（4151 条，52 KB），首次启动时灌进 ID 登记表

### 刷新索引

设置页点一下即可（结果写 `~/.dsh-ugc-wiki/index.json`）；也可以命令行重建随包数据：

```bash
node scripts/build.mjs              # 在线抓取 wiki 并重建 data/ugc-wiki.json
node scripts/build.mjs --offline    # 用 _probe/pages 里的缓存页面重建（离线、秒级）
```

爬虫只请求约 40 个静态 HTML 页面（VitePress 全静态渲染，无需无头浏览器）：
页面清单取自首页侧边栏，4 并发、3 次重试，解析失败只影响单页。

## 结构

```
index.js             cordis 插件：注册 12 个工具 + /ugc-wiki/api（无第三方依赖）
client.js            浏览器端：设置页五个标签（window.__ModuleLoader__）
lib/store.mjs        索引加载、IDF 加权检索、模块/页面解析
lib/format.mjs       文本渲染（签名行 / 完整卡片 / 压缩卡片 / 模块表）
lib/memory.mjs       易错点记忆 + 查不到的问题（含 12 条只读内置记忆）
lib/templates.mjs    模板库（7 个只读内置模板 + 自定义）
lib/ids.mjs          ID 登记表 + 待填写请求 + 官方表批量导入
lib/idsource.mjs     旧官网 8 张 id 表的下载与解析（developers.mini1.cn）
lib/config.mjs       自动维护开关（config.json）
lib/update.mjs       GitHub 仓库查询：版本比较、star / issue、检查更新缓存
lib/harvest.mjs      从语料里挖 id 数字（并统计各种 ID 的提及次数）
lib/crawl.mjs        抓取 40 页并组装索引（在线 / 离线）
lib/api.mjs          /ugc-wiki/api 路由与后台抓取任务
lib/web.mjs          JSON 收发小工具
lib/paths.mjs        数据目录（~/.dsh-ugc-wiki）
lib/jsonfile.mjs     原子读写 JSON
lib/html.mjs         无依赖 HTML 树构建器（解析期用）
scripts/build.mjs    命令行爬虫（调用 lib/crawl.mjs）
scripts/parse.mjs    单页解析（四种页面形状）
data/ugc-wiki.json   构建产物
data/official-ids.json  官方 id 表快照（首次启动灌进 ID 登记表）
```

## 排查

想让插件在启动时留一行痕迹（确认 bundle 真的挂载了），给宿主进程加环境变量：

```
DSH_UGC_DEBUG=<某个可写路径>   # apply() 结束后追加一行 "ugc-wiki applied: 12 tools, 571 apis, api /ugc-wiki/api"
```

不设这个变量时插件不写任何文件。

给 `webServer.register()` **不要**挂 `sub.effect(() => dispose())`：在
`ctx.inject(['webServer'], cb)` 的作用域里这个清理函数会立刻执行，路由被当场注销，
所有 `/ugc-wiki/api/*` 请求就会落回 SPA 的 404（本插件踩过这个坑，注释里写了原因）。

## 备注

- 文档版权归迷你世界官方所有，本插件只是本地检索索引，不修改内容。
- 解析器按 VitePress 的四种页面形状工作：API 函数页、枚举页、事件页、散文页；
  散文页里嵌的函数表会被抽取为额外的 API 记录（componentapi、globalfunc、obj…）。
- `apis/API.html` 只是导航页，构建时跳过。
- 更新检查只读公开的 GitHub API 与 `raw.githubusercontent.com`，不发任何本地信息；
  仓库还没公开时（API 返回 404）会显示「仓库还没有公开」，不影响任何工具。
