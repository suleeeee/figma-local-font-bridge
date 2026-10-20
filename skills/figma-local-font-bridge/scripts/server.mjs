import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { tokenPath } from './client.mjs';
export function persistentToken() {
  fs.mkdirSync(path.dirname(tokenPath), { recursive: true, mode: 0o700 });
  try { fs.writeFileSync(tokenPath, randomBytes(24).toString('hex'), { mode: 0o600, flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  fs.chmodSync(tokenPath, 0o600);
  return fs.readFileSync(tokenPath, 'utf8').trim();
}
export function startBridgeServer({ port = 4789, token = persistentToken(), credentialPath = path.join(path.dirname(tokenPath), 'plugin-credentials.json') } = {}) {
  const tasks = new Map();
  const approved = new Set(fs.existsSync(credentialPath) ? JSON.parse(fs.readFileSync(credentialPath, 'utf8')) : []);
  const pairing = new Map();
  const hash = value => createHash('sha256').update(value).digest('hex');
  const saveCredentials = () => { fs.mkdirSync(path.dirname(credentialPath), { recursive: true, mode: 0o700 }); fs.writeFileSync(credentialPath, JSON.stringify([...approved]), { mode: 0o600 }); };

  let session = null;
  let lastSeen = 0;
  function expire() {
    for (const [key, entry] of pairing) { if (Date.now() - entry.requestedAt > 300000) pairing.delete(key); }
    for (const [id, task] of tasks) {
      if (task.status !== 'done' && Date.now() >= task.deadline) {
        task.status = 'done'; task.completedAt = Date.now(); task.result = { ok: false, error: '任务超时或连接中断。未自动重放，避免重复修改文件。' };
      }
      if (task.status === 'done' && Date.now() - task.completedAt > 300000) tasks.delete(id);
    }
  }
  const timer = setInterval(expire, 1000); timer.unref();
  const server = http.createServer(async (req, res) => {
    const send = (status, data) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,authorization' });
      res.end(JSON.stringify(data));
    };
    try {
      if (req.method === 'OPTIONS') return send(204, {});
      const url = new URL(req.url, 'http://localhost');
      let body = {};
      if (req.method === 'POST') {
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 262144) { send(413, { error: '请求超过 256KB' }); req.resume(); return; } chunks.push(chunk); }
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return send(400, { error: '无效 JSON' }); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return send(400, { error: '无效请求' });
      }
      expire();
      if (req.method === 'POST' && url.pathname === '/plugin/register') {
        // Figma's UI runs in a sandboxed iframe with a null Origin. Ordinary web origins are refused.
        if (req.headers.origin !== 'null') return send(403, { error: '连接请求必须来自插件界面。' });
        if (typeof body.key !== 'string' || !/^[a-f0-9]{48}$/.test(body.key)) return send(400, { error: '无效插件凭证' });
        const keyHash = hash(body.key);
        if (approved.has(keyHash)) return send(200, { ok: true, approved: true });
        if (!pairing.has(keyHash)) {
          if (pairing.size >= 10) return send(429, { error: '连接请求过多，请稍后重试。' });
          pairing.set(keyHash, { id: randomUUID(), requestedAt: Date.now() });
        }
        return send(200, { ok: true, approved: false, requestId: pairing.get(keyHash).id });
      }
      const auth = Buffer.from(req.headers.authorization || '');
      const expected = Buffer.from(`Bearer ${token}`);
      const owner = auth.length === expected.length && timingSafeEqual(auth, expected);
      const supplied = (req.headers.authorization || '').replace(/^Bearer /, '');
      const plugin = /^[a-f0-9]{48}$/.test(supplied) && approved.has(hash(supplied));
      if (!owner && !plugin) return send(401, { error: '等待 AI 工具授权连接。' });
      if (!owner && !['/health', '/plugin/next', '/plugin/result'].includes(url.pathname)) return send(403, { error: '插件凭证不能提交任务或读取调用方结果。' });
      if (owner && req.method === 'POST' && url.pathname === '/connection/approve') {
        const entries = [...pairing.entries()].filter(([,entry]) => !body.requestId || entry.id === body.requestId);
        if (entries.length !== 1) return send(409, { error: '请先打开插件；存在多个请求时请明确 requestId。' });
        const [keyHash, entry] = entries[0]; approved.add(keyHash); saveCredentials(); pairing.delete(keyHash);
        return send(200, { ok: true, requestId: entry.id, message: '已授权此插件；以后自动连接。' });
      }
      if (req.method === 'GET' && url.pathname === '/health') return send(200, { ok: true, service: 'local-font-bridge', version: '1.1.4', connectionRequests: owner ? [...pairing.values()] : undefined, pluginConnected: Date.now() - lastSeen < 15000, pending: [...tasks.values()].filter(t => t.status !== 'done').length });
      if (req.method === 'POST' && url.pathname === '/task') {
        if (!['check-font', 'list-fonts', 'run-js'].includes(body.kind)) return send(400, { error: '不支持的任务类型' });
        if (body.kind === 'check-font' && (typeof body.family !== 'string' || !body.family.trim() || typeof body.style !== 'string' || !body.style.trim())) return send(400, { error: '请填写字体家族和字重' });
        if (body.kind === 'run-js' && (typeof body.code !== 'string' || !body.code.trim() || body.code.length > 100000)) return send(400, { error: '代码为空或超过 100KB' });
        if ([...tasks.values()].filter(t => t.status !== 'done').length >= 20) return send(429, { error: '任务队列已满' });
        const id = randomUUID(); const timeout = Math.max(1000, Math.min(300000, Number(body.timeoutMs) || 120000));
        tasks.set(id, { id, kind: body.kind, family: body.family, style: body.style, query: typeof body.query === 'string' ? body.query.slice(0, 200) : '', code: body.code, status: 'queued', deadline: Date.now() + timeout });
        return send(200, { ok: true, id });
      }
      if (req.method === 'POST' && url.pathname === '/plugin/next') {
        if (typeof body.session !== 'string' || !body.session || body.session.length > 100) return send(400, { error: '缺少插件会话' });
        if (session && session !== body.session && Date.now() - lastSeen < 15000) return send(409, { error: '另一个插件窗口已连接，请先断开它。' });
        session = body.session; lastSeen = Date.now();
        const active = [...tasks.values()].find(t => t.status === 'running');
        if (active) return send(200, { ok: true, task: active.session === session ? active : null });
        const task = [...tasks.values()].find(t => t.status === 'queued');
        if (task) { task.status = 'running'; task.session = session; }
        return send(200, { ok: true, task: task || null });
      }
      if (req.method === 'POST' && url.pathname === '/plugin/result') {
        const task = tasks.get(body.id);
        if (!task || task.session !== body.session) return send(409, { error: '任务不属于此会话' });
        if (task.status !== 'done') { task.status = 'done'; task.completedAt = Date.now(); task.result = { ok: body.ok === true, result: body.result, error: typeof body.error === 'string' ? body.error.slice(0, 4000) : undefined }; }
        return send(200, { ok: true });
      }
      if (req.method === 'POST' && url.pathname === '/cancel') {
        const task = tasks.get(body.id);
        if (task && task.status !== 'done') { task.status = 'done'; task.completedAt = Date.now(); task.result = { ok: false, error: '调用方已取消。已开始执行的代码无法回滚。' }; }
        return send(200, { ok: true });
      }
      if (req.method === 'GET' && url.pathname.startsWith('/result/')) {
        const task = tasks.get(url.pathname.slice(8));
        if (!task) return send(404, { error: '任务不存在或结果已过期' });
        return send(task.status === 'done' ? 200 : 202, { ready: task.status === 'done', result: task.result });
      }
      send(404, { error: '接口不存在' });
    } catch (error) { if (!res.headersSent) send(500, { error: String(error.message || error) }); }
  });
  server.on('close', () => clearInterval(timer));
  server.listen(port, 'localhost');
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const token = persistentToken();
  const server = startBridgeServer({ token });
  server.on('listening', () => console.error(`Local Font Bridge 已启动：localhost:4789\n在 AI 工具中授权插件连接；无需复制配对码。`));
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? '4789 端口已占用；如果桥接服务已运行，无需重复启动。' : error.message); process.exitCode = 1; });
}
