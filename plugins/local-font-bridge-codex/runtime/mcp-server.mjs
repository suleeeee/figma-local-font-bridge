import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { persistentToken, startBridgeServer } from './server.mjs';
import { request, submit } from './client.mjs';
const token = persistentToken();
try { await request('/health', undefined, token); }
catch {
  const server = startBridgeServer({ token });
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
}
console.error('Local Font Bridge 已就绪；打开 Figma 插件，首次调用 figma_connect_plugin 授权连接。');
const mcp = new McpServer({ name: 'local-font-bridge', version: '1.1.4' }, { instructions: '当 Figma 设计修改因字体无法加载而失败时，自动检查本机桥接状态并用 figma_check_font 验证原字体。仅在 loadOk 为 true 时通过 figma_run_js 执行尚未完成的修改，加载原字体并保留文字样式。不要自动替换字体或把文字转为轮廓；不要重复已成功的修改。首次连接必须取得用户授权，代码默认需插件内批准；用户自行开启自动执行后按该授权执行。插件关闭时提示打开，不要假装已连接。' });
const wrap = async fn => { try { return { content: [{ type: 'text', text: JSON.stringify(await fn(), null, 2) }] }; } catch (error) { return { isError: true, content: [{ type: 'text', text: String(error.message || error) }] }; } };
mcp.tool('figma_connect_plugin', '首次授权用户打开的 Figma 插件。授权后会自动重连，无需配对码。先用 figma_bridge_status 查看请求；多个请求必须指定 requestId。仅在用户要求连接插件时调用。', { requestId: z.string().optional() }, args => wrap(() => request('/connection/approve', args)));
mcp.tool('figma_bridge_status', 'Figma 设计修改因字体加载失败时自动调用，检查本机插件连接与待授权请求。不能启动 Figma 插件。', {}, () => wrap(() => request('/health')));
mcp.tool('figma_list_fonts', { query: z.string().default('') }, args => wrap(() => submit({ kind: 'list-fonts', ...args })));
mcp.tool('figma_check_font', 'Figma MCP 无法加载字体时，自动验证本机 Figma 插件能否加载相同 family/style。只有 loadOk 为 true 才能通过桥接继续修改。', { family: z.string(), style: z.string() }, args => wrap(() => submit({ kind: 'check-font', ...args })));
mcp.tool('figma_run_js', '经插件授权执行设计修改；未开启自动执行时需逐次审批。字体回退时先加载原字体，只执行尚未完成的操作，保留文字内容、样式和可编辑性。不会让其他 Figma MCP 自动获得本机字体。', { code: z.string(), timeoutMs: z.number().int().min(1000).max(300000).default(120000) }, ({ code, timeoutMs }) => wrap(() => submit({ kind: 'run-js', code }, timeoutMs)));
await mcp.connect(new StdioServerTransport());
