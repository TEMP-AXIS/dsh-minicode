# 更新日志

## 0.5.0

**运行时彻底不联网。**

- ID 表改为**随包内置的全量表**：13 个源文件合并成 14 个 kind、**26493** 个名字
  （item 17838 / effect 2533 / block 950 / model 912 / creature 909 / skin 601 / buff 544 /
  picture 526 / sound 494 / particle 314 / spell 300 / skill 273 / act 241 / enchant 58），
  由 `node scripts/import-sjy.mjs` 在构建期生成 `data/official-ids.json` 并随插件发布。
- **删掉全部爬取入口**：设置页「索引」标签只剩一个 `刷新`，ID 标签不再有「同步官方 ID 表」按钮，
  `/api/crawl` 与 `/api/ids/sync-official` 路由、`lib/idsource.mjs` 里的网络同步逻辑、
  `autoIds` 配置项一并移除（配置只剩 `autoMemory / autoTemplates / autoUpdate` 三个开关）。
- 设置页 ID 标签现在只列**玩家自己填的**条目（内置表两万多个名字只显示条数），删除按钮只对玩家条目出现。
- 内置记忆 12 → **22** 条（新增单文件行为脚本、冒号调用、射线返回值、枚举真名、富文本标记、
  天气/生物群系枚举、无配方、聊天事件参数、定时任务 各一条；其中 5 条置顶）。
- 内置模板 7 → **10** 个（新增聊天指令骨架、引擎 API 自检骨架、定时任务骨架）。
- `lib/harvest.mjs` / `lib/crawl.mjs` 保留为**构建期工具**，运行时不再调用。

## 0.4.0

- 包名、设置页标题、数据目录改名为 **dsh-minicode**（原 dsh-ugc-wiki）；给 agent 的 12 个工具仍叫 `ugc_*`。

## 0.3.1

- 内置记忆与模板改为 `builtin/` 下一文件一条记录，便于逐个评审与 PR。

## 0.3.0

- 首次内置记忆（12 条）与代码模板（7 个），来自一套真实 UGC 工程与真机 API 实测。
