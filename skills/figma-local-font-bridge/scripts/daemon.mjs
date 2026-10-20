import fs from 'node:fs';
import path from 'node:path';
import { port, stateDir } from './client.mjs';
import { startBridgeServer } from './server.mjs';

const pidFile = path.join(stateDir, 'service.pid');
const server = startBridgeServer({ port });
server.once('listening', () => {
  fs.writeFileSync(pidFile, String(process.pid), { mode: 0o600 });
  console.error('Local Font Bridge skill service ready');
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
function cleanup() {
  try { if (fs.readFileSync(pidFile, 'utf8') === String(process.pid)) fs.unlinkSync(pidFile); } catch {}
}
process.on('exit', cleanup);
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { cleanup(); process.exit(0); });
