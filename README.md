# Local Font Bridge — Skill 分发版

一次安装，照常让本地 AI 修改 Figma 设计；当 Figma MCP 实际无法加载原字体时，Skill 指导 AI 自动启动桥接、检查本机原字体并继续尚未完成的编辑，不用每次输入“调用 Local Font Bridge”。无需配置单独的 Local Font Bridge MCP，不需要从 Codex 公共插件目录安装。

## 安装一次

需要 Figma Desktop、Node.js 20+，以及能读取 Skill、执行本机命令并连接 localhost 的 AI 工具。

只发送 GitHub 页面链接不会自动安装。请把下面整句话发给 Codex：

> 请使用 `$skill-installer` 安装这个 Skill：https://github.com/suleeeee/figma-local-font-bridge/tree/main/skills/figma-local-font-bridge

Codex 会下载并安装 Skill，安装完成后的下一轮对话即可使用。如果当前环境不能调用 Skill Installer，也可以[下载 ZIP](https://github.com/suleeeee/figma-local-font-bridge/archive/refs/heads/main.zip)，解压后在目录中执行：

```sh
node install.mjs
```

脚本默认安装到 `~/.agents/skills/figma-local-font-bridge`。不会修改 MCP 配置，不会 npm install。若安装后未发现 Skill，请重启 Codex。已有完全相同版本时重复安装不产生副作用；更新使用 `node install.mjs --update`，原版备份放在本发布目录的 install-backups 下。

其他支持 Agent Skills 的本地客户端：将 `skills/figma-local-font-bridge` 放到该客户端的技能目录，且允许其执行本机 Node 命令。尚未逐一验证其他客户端，不能保证它们自动采用 Skill。

## 每次使用

1. 在 Figma Desktop 的目标文件里打开 Local Font Bridge，保持插件窗口打开。
2. 在 AI 工具里正常描述设计需求，例如“将选中的标题改成夏日计划，保留字体与样式”。
3. 字体失败时 AI 按 Skill 自动尝试桥接。首次连接要授权；授权后，插件自动执行受限的字体与文字任务，无需逐次点击批准。插件不接受任意 JavaScript，也不修改非文字节点；关闭插件可停止接收后续任务。之后无需重复输入桥接口令。

如果没有可安装的 Community 版本，可在 Figma 的开发插件菜单导入本包 `figma-plugin/manifest.json`。此包保留原插件 ID `1691148316136154777`；非原开发者如遇 ID 所有权限制，需要按 Figma 提示创建自己的开发插件 ID。不要把本包当成已获 Figma Community 或 Codex 官方目录批准的版本。

## 边界与数据

Skill 的自动匹配取决于 AI 客户端，不是全局错误拦截。云端执行环境不能连接用户电脑的 localhost。字体必须已在 Figma Desktop 中可加载；仅安装 Skill 不会安装字体。Figma 插件与本机桥接服务仍然承担实际执行，服务由 AI 的 Skill 脚本按需启动。支持查询和验证字体、读取指定文字、替换明确的文字范围、应用已验证字体，以及创建可编辑文字。

字体文件不经桥接传输。字体元数据、受限操作参数和执行结果可能包含文档内容，会返回调用 AI 工具。凭据默认保存在 `~/.local/state/local-font-bridge`，不会打入发布包；任务结果只在服务内存中短暂保存。服务仅监听 localhost，不设开机自启；凭据跨会话保存。

已有 Local Font Bridge MCP 时，Skill 优先复用其工具。两份集成不要同时抢占 4789；不会接管旧服务或读取其凭据。如需从旧 MCP 迁移，可先关闭旧集成服务，新服务首次连接重新授权即可。

Codex 的 Skill 自动匹配和本地目录规则见 [OpenAI 官方文档](https://learn.chatgpt.com/docs/build-skills)。

首次连接授权后，插件会保存本机连接凭据；以后重新打开插件或重启桥接服务时会自动重连，无需重复授权或逐次批准。只有清除本机连接状态、更换桥接集成或凭据失效时，才需要重新授权。
