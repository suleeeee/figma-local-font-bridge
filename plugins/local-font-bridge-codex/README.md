# Figma_Local Font Bridge — Codex 集成

发布者：suli。免费。

Figma 插件：https://www.figma.com/community/plugin/1691148316136154777
（社区提交已被拒绝，复审咨询帖已提交、待论坛审核；当前请使用包内开发插件。此链接不代表插件已公开可安装。）

## 安装

需要 Node.js/npm（建议 Node.js 22 LTS 或更新 LTS）及 Figma Desktop。首次启动需要联网安装依赖。

解压完整 marketplace 包后，在终端运行，路径替换为实际解压目录：

```sh
codex plugin marketplace add /实际路径/Figma-Local-Font-Bridge-Marketplace --json
codex plugin add local-font-bridge-codex@suli-font-bridge --json
```

安装后打开新的 Codex 聊天，以加载 MCP 和回退技能。在 Figma Desktop 打开社区插件并保持打开，首次连接需授权。开发测试可导入 figma-plugin/manifest.json。

当普通 Figma MCP 实际报告原字体无法加载时，集成指导 Codex 检查桌面字体，并通过桥接继续修改；执行设计代码前需要在 Figma 批准。关闭窗口即停止该窗口的连接，快速重开时会等待旧连接释放并自动重试。

字体文件不传输。查询与批准执行的结果返回 AI 工具，可能包含文档数据；AI 的后续处理适用其自身政策。

## 验证范围

已验证：工具发现、桌面字体加载、真实文字修改、独立 Codex 聊天自动回退、正式 ID 凭据保存、快速重开恢复。
尚未验证：服务完全停止后的宿主冷启动、全新电脑安装。

此包用于 marketplace 分发，不代表已上架 OpenAI 官方公共目录。
