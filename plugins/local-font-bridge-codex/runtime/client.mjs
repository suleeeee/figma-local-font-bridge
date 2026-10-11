import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const base = 'http://localhost:4789';
export const tokenPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.runtime', 'token');
export function getToken() {
  const token = process.env.FIGMA_BRIDGE_TOKEN || (fs.existsSync(tokenPath) ? fs.readFileSync(tokenPath, 'utf8').trim() : '');
  if (!token) throw new Error('请先启动本机服务：npm run server');
  return token;
}
export async function request(route, body, token = getToken()) {
  const res = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
export async function submit(payload, timeoutMs = 120000) {
  const { id } = await request('/task', { ...payload, timeoutMs });
  const started = Date.now();
  try {
    while (Date.now() - started < timeoutMs + 1000) {
      const data = await request(`/result/${id}`);
      if (data.ready) {
        if (!data.result.ok) throw new Error(data.result.error);
        return data.result.result;
      }
      await new Promise(resolve => setTimeout(resolve, 350));
    }
    throw new Error('等待插件超时；请确认插件已连接，且已处理代码审批。');
  } finally { await request('/cancel', { id }).catch(() => {}); }
}
