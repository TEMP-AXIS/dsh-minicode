# 贡献一条记忆或一个模板

内置记忆和模板都是**一个文件一条**，随便挑一个现有的复制、改名、改内容，提 PR 就行。
不写代码、不改 `lib/`、不碰 `data/`，只加一个文件。

```
builtin/memory/<id>.json      一条「容易错的地方」
builtin/templates/<id>.lua    一个可以直接抄的脚本
```

`<id>` = 文件名，只用小写字母、数字、短横线（`slider-read`、`clone-cleanup`）。

## 记忆（builtin/memory/<id>.json）

```json
{
  "topic": "滑动条取值（滚动面板）",
  "wrong": "用 UIButtonClick 或文本事件去读滑块位置，拖动过程中数值根本不动",
  "right": "TriggerEvent.UIScrollPaneTouchBegin / UIScrollPaneTouchEnd 注册时第三个参数写滑动元件ID；位置用 CustomUI:GetElementAttrValue(player, 滑动元件ID, ElementAttr.ScrollPosition) 取",
  "tags": ["ui", "slider", "滑动"],
  "pinned": true
}
```

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `topic` | 是 | 一句话说清是什么坑，≤ 60 字 |
| `wrong` | 否 | 常见的错误写法（写出来，搜「错误的关键词」才命中） |
| `right` | 是 | 正确写法，≤ 400 字；一条讲一件事，别把三个坑塞一起 |
| `tags` | 否 | 最多 8 个，中文英文都行，检索时按标签加分 |
| `pinned` | 否 | `true` 会常驻 `ugc_guide`，只给最要命的几条（现在只有 3 条） |

写「坑」而不是「教程」：能被 `ugc_search` 命中的是 `topic` / `tags` / `wrong` / `right` 里的词，
所以把玩家会用的说法（`滑动条`、`克隆`、`GetItemId`）写进去。

## 模板（builtin/templates/<id>.lua）

文件开头三行是元信息，空一行之后就是纯 Lua，可以直接粘进游戏：

```lua
-- name: 滑动条
-- desc: UIScrollPaneTouchBegin/End + 0.03 秒轮询位置 + TurnSliderToPos 回写
-- tags: ui, slider

local Script = {}

-- ...

return Script
```

- `name`（必需）：模板库里的标题
- `desc`（必需）：一句话说明，会显示在列表里
- `tags`（可选）：逗号分隔
- 正文必须是完整脚本：`local Script = {}` 开头、`return Script` 结尾
- 220 行以内，空格缩进，别留调试代码和 `print`
- 界面 / 变量 / 组件 id 用占位常量（`local UI_ID = "填你的界面ID"`），不要写别人工程里的真 id

## 提交前跑一下

```bash
node scripts/check-contrib.mjs   # 只查内置记忆和模板，几毫秒
npm test                         # 顺带确认 12 个工具都还能用
```

检查会拦下：文件名不合法、字段缺失或多余、`right` 超长、模板缺 `return Script`、用 tab 缩进、
以及「文件在磁盘上但加载不到」（说明格式写坏了会被静默跳过）。

## PR 约定

- 一个 PR 加一条记忆或一个模板，标题写 `记忆: <topic>` / `模板: <name>`
- 内容用中文，代码注释也用中文
- 只新增文件；要改现有的，说清为什么现在这条是错的
- 不要放服务器地址、账号、玩家个人信息

合并后下次发版就带上了；装的是 `github:TEMP-AXIS/dsh-minicode` 的话，重新装一次即可拿到。
