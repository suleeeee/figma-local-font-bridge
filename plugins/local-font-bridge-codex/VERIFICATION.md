# 本机测试记录 — 2026-10-11

- Codex CLI 将 suli-local-test 本地源注册成功。
- local-font-bridge-codex@suli-local-test 安装成功，插件列表确认 installed=true、enabled=true。
- 通过 SDK 启动已安装目录中的 mcp.json 入口，首次自动安装依赖成功，真实 MCP 握手及全部5个工具发现成功。
- 本机服务真实响应版本1.1.3；初始 pluginConnected=false，connectionRequests为空。
- 用户确认打开桌面插件后，30秒内未收到注册请求；本轮未完成真实字体加载、代码执行或自动回退。
- 11项随机端口HTTP/模拟Figma测试通过。未把模拟加载作为真实桌面通过证据。
- 本地源安装与SDK启动不是新Codex聊天内自动调用的证据；该项仍待验证。

已移除界面“普通 Figma MCP 不会自动连接此插件”句子。实际能力边界仍记录在开发说明中。

## 公开发布限制

官方文档 https://developers.openai.com/plugins/build/plugins 明确要求公开提交使用远程HTTPS MCP；无法部署的本地MCP需联系OpenAI申请支持。本桥接需要访问每位用户的本机Figma，直接迁移云端不能替代本机通信，因此不能以普通公开提交流程承诺上架。

## 初始化排查

用户确认从当前源目录导入；界面显示初始化未响应。修正严格 parent 消息来源判断，增加主程序/界面 session 握手、初始化重试与错误提示。15项服务及UI模拟测试通过；真实桌面连接仍待再次导入验证。

用户实测确认错误为缺少插件 ID，Figma 禁止 clientStorage。已加入无 ID 开发模式：临时内存凭据、不写 clientStorage；重开需重新授权。正式 ID 模式继续持久化。16项服务及UI模拟测试通过，真实字体加载继续等待验证。

重复打开后仍出现原 clientStorage 错误，与当前磁盘修复不符，疑似加载缓存。另建 desktop-bridge-test 全新测试目录与入口，主程序完全无 clientStorage 调用，等待用户导入并验证；缓存原因尚未直接证实。

## 真实桌面测试通过

使用新目录 desktop-bridge-test，避免 clientStorage 的无插件ID错误；与已安装 Codex MCP 真实通信。Figma 桌面插件返回9536个字体样式（工具单次返回上限2000），Amethysta Regular及HYDiShengYingXiongTi J实际loadOk=true；BridgeMissingFontFixture Regular返回loadOk=false。用户批准只读JavaScript后，返回当前页面Page 1与空selection。没有修改设计。首次只读请求因SDK默认超时失败；延长客户端超时后重试成功。

确认通信、字体查询与加载、审批后结果回传可用。尚未证明自动技能触发、真实设计修改、正式ID下记住授权或跨设备使用。当前无ID开发模式关闭插件后需重新授权；正式社区插件需Figma分配ID。

## 真实字体失败回退与文字修改通过

云端 use_figma 实际加载 HYDiShengYingXiongTi J 失败，字体不存在；本机桥接相同字体 loadOk=true。在测试文件独立框架30:701中新建原生文字30:702，将“桥接字体测试：修改前”改为“桥接字体测试：修改后”。字体一致、分段字号32/28及灰色填充一致、hasMissingFont=false，文字仍为TEXT。宽304高50。云端独立读取再次确认文字及样式保存；桌面PNG导出已人工查看，无裁切异常。

此轮按已读取技能完成回退，不等于新聊天自然触发。已授权创建独立聊天01a12ba0-16ee-70e3-86b4-c0310261f2fb，使用普通编辑要求继续验证自然触发。正式Figma插件ID尚缺；当前无原生Figma菜单控制能力，该项待用户通过开发菜单创建。

## Independent Codex auto-fallback test: PASSED

Thread: 01a12ba0-16ee-70e3-86b4-c0310261f2fb. User requested an ordinary edit of node 30:702 without mentioning the bridge. Actual tool sequence: figma.use_figma read; figma.use_figma font load/edit failed; installed figma-font-fallback skill loaded; installed local MCP figma_bridge_status, figma_check_font and figma_run_js called directly. The user approved the edit in Figma.

Independent cloud read confirmed the requested final text, native TEXT type, HYDiShengYingXiongTi J, original range sizes 32/28, original RGB fills .25/.5 and dimensions 304x50. Existing design was untouched outside the designated test node.

This verifies natural fallback in the current Codex environment, not every host or error condition. Formal Figma plugin ID persistence/reopen authorization remains pending. The independent chat reused an already running local service; it does not establish host cold-start behavior.
