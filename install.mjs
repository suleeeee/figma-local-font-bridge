import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const i = args.indexOf('--target-dir');
const skillsDir = path.resolve(i < 0 ? path.join(os.homedir(), '.agents', 'skills') : args[i + 1] || '');
const source = path.join(root, 'skills', 'figma-local-font-bridge');
const target = path.join(skillsDir, 'figma-local-font-bridge');
try {
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('需要 Node.js 20+。');
  if (i >= 0 && !args[i + 1]) throw new Error('--target-dir 后需要填写目录。');
  if (target === source || target.startsWith(source + path.sep)) throw new Error('安装目标不能位于发布包源目录内。');
  if (fs.existsSync(target)) {
    const oldSkill = fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8');
    const same = ['SKILL.md', 'agents/openai.yaml', 'scripts/client.mjs', 'scripts/server.mjs', 'scripts/daemon.mjs', 'scripts/bridge.mjs'].every(file => fs.existsSync(path.join(target, file)) && fs.readFileSync(path.join(target, file)).equals(fs.readFileSync(path.join(source, file))));
    if (same) { console.log(JSON.stringify({ ok: true, alreadyInstalled: true, path: target })); process.exit(0); }
    if (!args.includes('--update') || !oldSkill.includes('name: figma-local-font-bridge')) throw new Error('已有同名 Skill，未覆盖。如需更新此 Skill，请加 --update。');
    const backup = path.join(root, 'install-backups', String(Date.now()), 'figma-local-font-bridge');
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.cpSync(target, backup, { recursive: true });
    fs.rmSync(target, { recursive: true });
  }
  fs.mkdirSync(skillsDir, { recursive: true });
  fs.cpSync(source, target, { recursive: true, errorOnExist: true, force: false });
  console.log(JSON.stringify({ ok: true, path: target, message: '已安装；打开新聊天。若未出现，请重启 Codex。' }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
