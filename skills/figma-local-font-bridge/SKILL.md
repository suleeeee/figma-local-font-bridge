---
name: figma-local-font-bridge
description: 在本地 AI 工具修改 Figma 设计、生成可编辑文字时，处理 Figma MCP 的缺失字体、font unavailable 或 loadFontAsync 失败；自动启动并连接 Local Font Bridge，用本机原字体继续尚未完成的修改。也用于用户明确要求连接此桥接。无需每次输入桥接口令。
---

# Figma 本机字体桥接

普通 Figma 操作先用官方 Figma 工具；实际字体加载失败后主动采用本流程，用户无需再说“启动桥接”。网络、权限和节点错误不触发字体回退。用户明确要求连接时也可启动。这里的自动选择是模型工作规则，不是宿主级错误拦截器。

## 连接

优先使用当前已有的 `figma_bridge_status`、`figma_connect_plugin`、`figma_check_font`、`figma_run_js`，避免启动第二个服务。没有这些 MCP 工具时，使用本 Skill 的脚本，不要求另装 Local Font Bridge MCP：

```sh
node "<本 SKILL.md 所在目录>/scripts/bridge.mjs" start
node "<本 SKILL.md 所在目录>/scripts/bridge.mjs" status
```

将示例路径替换为本技能的实际绝对路径。脚本需要同一电脑上的 Node.js 20+ 和 Figma Desktop；不安装 npm 依赖，不自动打开 Figma 插件。只在本地执行环境运行，不能从云端连接用户电脑的 localhost。

- 未打开插件：请用户在目标文件里打开 Local Font Bridge 并保持打开；不要让用户运行终端服务或重复输入口令。
- 首次待授权：显示当前请求，取得对当前插件连接的明确授权，然后用对应工具或命令授权。普通设计修改请求不等于首次连接授权；用户已明确要求连接当前插件时无需重复询问。多个请求必须确认目标 requestId。
- 后续已授权连接自动恢复，不重复询问。状态为未连接时，不声称已连上。
- `OWNER_MISMATCH`：已有另一份服务占用端口。优先使用它对应的现有 MCP；不可读取、替换其他集成的凭据或擅自结束进程。无对应工具时解释需要先关闭旧桥接集成，之后重新执行 start。不要换端口假装能与固定端口插件通信。

```sh
node "<技能目录>/scripts/bridge.mjs" connect --request-id "<已确认的请求ID>" --authorize
```

## 字体与修改

1. 记录失败字体的精确 family/style、文件和目标节点。检查前次操作是否部分完成，只补做尚未完成的修改。
2. 调用 `figma_check_font` 或下面的 check-font，确认原字体 `loadOk: true`。字体被列出不代表能加载；失败就停止依赖该字体的修改，不擅自替换字体、安装字体或转轮廓。
3. 读取原文字及 `getStyledTextSegments(['fontName','fontSize','fills'])`，确认文件、节点和范围样式。通过桥接执行时先加载每个原始范围字体，只修改用户要求的节点与属性，保留可编辑 TEXT 和原布局。
4. 使用 `figma_run_js` 或下面的 submit-js 提交代码。代码必须由用户在 Figma 插件里逐次批准；Skill 不能代替用户点击批准。代码文件用文件工具写入，避免内联 shell 转义。
5. CLI 提交即返回任务 ID。稍后读取 result；`ready: false` 仅代表未完成，不要重复提交。拒绝、超时、断线或结果不明时，先核对实际节点状态，不能自动重放修改。必要时 cancel 取消尚未执行的任务，已经执行的代码不会回滚。
6. 完成后核对文字、精确字体、范围样式、可编辑性及必要布局。将真实 Figma 验证与模拟协议测试分开汇报。

```sh
node "<技能目录>/scripts/bridge.mjs" check-font "<family>" "<style>"
node "<技能目录>/scripts/bridge.mjs" list-fonts "<可选搜索词>"
node "<技能目录>/scripts/bridge.mjs" submit-js --file "/绝对路径/task.js" --timeout-ms 180000
node "<技能目录>/scripts/bridge.mjs" result "<任务ID>"
node "<技能目录>/scripts/bridge.mjs" cancel "<任务ID>"
```

任务结果在本机服务内存中短暂保存，完成后约五分钟过期。字体文件不会由桥接传输；字体元数据、批准执行的代码及返回结果可能包含文档数据，并进入调用 AI 工具的上下文。AI 工具自身的数据政策适用。本桥接不能补齐未安装字体，也不会改变官方 MCP 的字体环境。
