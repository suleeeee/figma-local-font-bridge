import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const dir=path.dirname(fileURLToPath(import.meta.url));
if(!fs.existsSync(path.join(dir,'node_modules/@modelcontextprotocol/sdk/package.json'))) {
 console.error('首次启动：正在安装字体桥接依赖…');
 const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['ci','--ignore-scripts','--no-audit','--no-fund'],{cwd:dir,stdio:['ignore',2,2],shell:process.platform==='win32'});
 if(result.error || result.status!==0) {console.error('依赖安装失败，请检查网络和 Node.js/npm 环境。');process.exit(1);}
}
await import('./mcp-server.mjs');
