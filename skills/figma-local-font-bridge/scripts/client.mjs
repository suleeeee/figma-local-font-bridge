import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const stateDir = process.env.LFB_STATE_DIR || path.join(os.homedir(), '.local', 'state', 'local-font-bridge');
export const port = Number(process.env.LFB_PORT || 4789);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('无效 LFB_PORT');
export const base = `http://localhost:${port}`;
export const tokenPath = path.join(stateDir, 'token');
export function getToken() {
  if (!fs.existsSync(tokenPath)) throw Object.assign(new Error('桥接尚未启动，请运行 bridge.mjs start。'), { code: 'NOT_STARTED' });
  return fs.readFileSync(tokenPath, 'utf8').trim();
}
export async function request(route, body, token = getToken()) {
  const res = await fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(4000),
  });
  let data;
  try { data = await res.json(); }
  catch { throw Object.assign(new Error('端口响应不是兼容的桥接 JSON 服务。'), { code: 'INCOMPATIBLE_SERVICE' }); }
  if (!res.ok) throw Object.assign(new Error(res.status === 401 ? '已有另一份桥接服务；请优先使用其 MCP，或关闭旧集成后再启动此 Skill。' : data.error || `HTTP ${res.status}`), { code: res.status === 401 ? 'OWNER_MISMATCH' : 'HTTP_ERROR', status: res.status });
  if (route === '/health' && (data.service !== 'local-font-bridge' || !Array.isArray(data.connectionRequests))) throw Object.assign(new Error('端口响应不属于兼容的桥接服务。'), { code: 'INCOMPATIBLE_SERVICE' });
  return data;
}
export async function submit(payload, timeoutMs = 20000) {
  const health = await request('/health');
  if (!health.pluginConnected) throw Object.assign(new Error('请在 Figma Desktop 打开并连接 Local Font Bridge。'), { code: 'PLUGIN_NOT_CONNECTED' });
  const { id } = await request('/task', { ...payload, timeoutMs });
  try {
    const deadline = Date.now() + timeoutMs + 1000;
    while (Date.now() < deadline) {
      const data = await request(`/result/${id}`);
      if (data.ready) {
        if (!data.result.ok) throw new Error(data.result.error || '插件任务失败');
        return data.result.result;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('任务超时；请检查插件连接，勿盲目重试修改。');
  } finally { await request('/cancel', { id }).catch(() => {}); }
}
