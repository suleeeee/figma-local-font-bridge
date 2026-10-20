# Local Font Bridge — Skill 分发版

作者：suli · 免费 · 1.0.1

一次安装，照常让本地 AI 修改 Figma 设计；当 Figma MCP 实际无法加载原字体时，Skill 指导 AI 自动启动桥接、检查本机原字体并继续尚未完成的编辑，不用每次输入“调用 Local Font Bridge”。无需配置单独的 Local Font Bridge MCP，不需要从 Codex 公共插件目录安装。

## 安装一次

需要 Figma Desktop、Node.js 20+，以及能读取 Skill、执行本机命令并连接 localhost 的 AI 工具。Codex 安装方法：从 [GitHub 下载 ZIP](https://github.com/suleeeee/figma-local-font-bridge/archive/refs/heads/main.zip) 并解压，将目录交给 Codex，说“安装这个目录里的 Local Font Bridge Skill”；也可以在解压目录执行：

```sh
node install.mjs
```

默认安装到 `~/.agents/skills/figma-local-font-bridge`。不会修改 MCP 配置，不会 npm install。打开新聊天，若未发现 Skill 则重启 Codex。已有完全相同版本时重复安装不产生副作用；更新使用 `node install.mjs --update`，原版备份放在本发布目录的 install-backups 下。

其他支持 Agent Skills 的本地客户端：将 `skills/figma-local-font-bridge` 放到该客户端的技能目录，且允许其执行本机 Node 命令。尚未逐一验证其他客户端，不能保证它们自动采用 Skill。

## 每次使用

1. 在 Figma Desktop 的目标文件里打开 Local Font Bridge，保持插件窗口打开。
2. 在 AI 工具里正常描述设计需求，例如“将选中的标题改成夏日计划，保留字体与样式”。
3. 字体失败时 AI 按 Skill 自动尝试桥接。首次连接要授权；默认在插件内批准代码；可勾选「自动执行 AI 代码」，记住选择后不再逐次审批。此授权允许已连接 AI 读写你打开本插件的文件，关闭开关即可恢复手动审批。之后无需重复输入桥接口令。

如果没有可安装的 Community 版本，可在 Figma 的开发插件菜单导入本包 `figma-plugin/manifest.json`。此包保留原插件 ID `1691148316136154777`；非原开发者如遇 ID 所有权限制，需要按 Figma 提示创建自己的开发插件 ID。不要把本包当成已获 Figma Community 或 Codex 官方目录批准的版本。

## 边界与数据

Skill 的自动匹配取决于 AI 客户端，不是全局错误拦截。云端执行环境不能连接用户电脑的 localhost。字体必须已在 Figma Desktop 中可加载；仅安装 Skill 不会安装字体。Figma 插件与本机桥接服务仍然承担实际执行，服务由 AI 的 Skill 脚本按需启动。通用授权执行 JavaScript、查询字体、验证加载、重新连接等原功能保留。

字体文件不经桥接传输。字体元数据、批准的代码和执行结果可能包含文档内容，会返回调用 AI 工具。凭据默认保存在 `~/.local/state/local-font-bridge`，不会打入发布包；任务结果只在服务内存中短暂保存。服务仅监听 localhost，不设开机自启；凭据跨会话保存。

已有 Local Font Bridge MCP 时，Skill 优先复用其工具。两份集成不要同时抢占 4789；不会接管旧服务或读取其凭据。如需从旧 MCP 迁移，可先关闭旧集成服务，新服务首次连接重新授权即可。

Codex 的 Skill 自动匹配和本地目录规则见 [OpenAI 官方文档](https://learn.chatgpt.com/docs/build-skills)。

## 已有 MCP 集成

旧版仍保留在 `plugins/local-font-bridge-codex`，已安装用户可以继续使用；它的工具可供本 Skill 优先复用。旧版安装命令：

```sh
codex plugin marketplace add suleeeee/figma-local-font-bridge --json
codex plugin add local-font-bridge-codex@suli-font-bridge --json
```

新用户优先使用上面的独立 Skill 安装，不需要这两条命令。Figma Community 申请仍与 Skill 分发分开处理，本仓库公开不代表社区审核通过。
