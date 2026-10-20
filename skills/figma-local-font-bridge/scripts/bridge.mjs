import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { request, submit, getToken, stateDir } from './client.mjs';
import { persistentToken } from './server.mjs';

const [command, ...args] = process.argv.slice(2);
const output = value => console.log(JSON.stringify(value, null, 2));
function option(name) { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; }
function requireId(id) {
  if (!id || !/^[a-zA-Z0-9-]{1,100}$/.test(id)) throw new Error('缺少或无效的任务/连接 ID');
  return id;
}
async function start() {
  // Probe before spawning; never take over a port or another integration's credentials.
  try { return { ...(await request('/health', undefined, fs.existsSync(path.join(stateDir, 'token')) ? getToken() : '')), reused: true }; }
  catch (error) { if (error.cause?.code !== 'ECONNREFUSED') throw error; }
  persistentToken();
  const log = fs.openSync(path.join(stateDir, 'service.log'), 'a', 0o600);
  let child;
  let launchError;
  try {
    child = spawn(process.execPath, [fileURLToPath(new URL('./daemon.mjs', import.meta.url))], { detached: true, stdio: ['ignore', log, log], windowsHide: true });
    child.on('error', error => { launchError = error; });
    child.unref();
  } finally { fs.closeSync(log); }
  for (let i = 0; i < 20; i++) {
    if (launchError) throw launchError;
    await new Promise(resolve => setTimeout(resolve, 150));
    try { return { ...(await request('/health')), reused: false }; }
    catch (error) { if (error.status || error.code === 'INCOMPATIBLE_SERVICE') throw error; }
  }
  throw new Error('桥接启动失败，请检查本机 service.log；不要重复启动其他服务。');
}
try {
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('需要 Node.js 20 或更新版本。');
  switch (command) {
    case 'start': output(await start()); break;
    case 'status': output(await request('/health')); break;
    case 'connect': {
      if (!args.includes('--authorize')) throw new Error('首次连接需要用户授权；确认后使用 --request-id <ID> --authorize。');
      output(await request('/connection/approve', { requestId: requireId(option('--request-id')) })); break;
    }
    case 'check-font': {
      if (!args[0] || !args[1]) throw new Error('用法：check-font "family" "style"');
      output(await submit({ kind: 'check-font', family: args[0], style: args[1] })); break;
    }
    case 'list-fonts': output(await submit({ kind: 'list-fonts', query: args[0] || '' })); break;
    case 'submit-js': {
      const file = option('--file');
      if (!file) throw new Error('用法：submit-js --file /absolute/task.js [--timeout-ms 180000]');
      const timeoutMs = Number(option('--timeout-ms') || 180000);
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) throw new Error('timeout-ms 必须为 1000–300000。');
      const health = await request('/health');
      if (!health.pluginConnected) throw Object.assign(new Error('插件未连接；请打开目标文件中的插件。'), { code: 'PLUGIN_NOT_CONNECTED' });
      const result = await request('/task', { kind: 'run-js', code: fs.readFileSync(path.resolve(file), 'utf8'), timeoutMs });
      output({ ...result, state: 'queued', message: '已提交，将由已授权的插件自动执行。用 result 读取本任务，不要重复提交。' }); break;
    }
    case 'result': output(await request(`/result/${requireId(args[0])}`)); break;
    case 'cancel': output(await request('/cancel', { id: requireId(args[0]) })); break;
    default: throw new Error('命令：start | status | connect | check-font | list-fonts | submit-js | result | cancel');
  }
} catch (error) { output({ ok: false, code: error.code || 'BRIDGE_ERROR', error: error.message }); process.exitCode = 1; }
