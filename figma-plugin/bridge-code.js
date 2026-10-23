figma.showUI(__html__, { width: 440, height: 220, themeColors: true });

let bridgeSession = "", storageAvailable = true;
const bridgeRuntime = Object.freeze({ version: "1.1.0", executionMode: "restricted-text-operations" });
const fontLoads = new Map();

function post(message) { figma.ui.postMessage({ ...message, bridgeSession }); }
function finiteNumber(value, fallback) { return Number.isFinite(value) ? value : fallback; }
function assertText(value, name, max = 10000) {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${name} 无效或超过 ${max} 字符`);
  return value;
}
function assertNodeId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9:_;-]{1,128}$/.test(value)) throw new Error('节点 ID 无效');
  return value;
}
function fontNameFrom(task) {
  const family = assertText(task.family, '字体家族', 200).trim();
  const style = assertText(task.style, '字体样式', 200).trim();
  if (!family || !style) throw new Error('字体家族或样式为空');
  return { family, style };
}
async function loadFont(font) {
  const key = JSON.stringify(font);
  if (!fontLoads.has(key)) {
    fontLoads.set(key, figma.loadFontAsync(font).catch(error => { fontLoads.delete(key); throw error; }));
  }
  return fontLoads.get(key);
}
async function getTextNode(nodeId) {
  const node = await figma.getNodeByIdAsync(assertNodeId(nodeId));
  if (!node || node.type !== 'TEXT') throw new Error(`未找到文字节点：${nodeId}`);
  return node;
}
function fontsUsedBy(node) {
  if (!node.characters.length) return node.fontName === figma.mixed ? [] : [node.fontName];
  if (node.fontName !== figma.mixed) return [node.fontName];
  return typeof node.getRangeAllFontNames === 'function' ? node.getRangeAllFontNames(0, node.characters.length) : [];
}
async function loadNodeFonts(node) {
  const unique = new Map(fontsUsedBy(node).map(font => [JSON.stringify(font), font]));
  for (const font of unique.values()) await loadFont(font);
}
function safeSegments(node) {
  if (!node.characters.length || typeof node.getStyledTextSegments !== 'function') return [];
  return node.getStyledTextSegments(['fontName', 'fontSize', 'fills']).map(segment => ({
    start: segment.start,
    end: segment.end,
    characters: segment.characters,
    fontName: segment.fontName,
    fontSize: segment.fontSize,
    fills: segment.fills
  }));
}
function textSnapshot(node) {
  return {
    id: node.id,
    name: node.name,
    characters: node.characters,
    hasMissingFont: node.hasMissingFont === true,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    segments: safeSegments(node)
  };
}
function selectionTextNodes() {
  const found = [], seen = new Set();
  const add = node => {
    if (!node || seen.has(node.id)) return;
    seen.add(node.id);
    if (node.type === 'TEXT') found.push(node);
    if ('findAll' in node && typeof node.findAll === 'function') {
      for (const child of node.findAll(item => item.type === 'TEXT')) add(child);
    }
  };
  for (const node of figma.currentPage.selection) add(node);
  return found.slice(0, 100);
}
function solidPaintFromHex(value) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) throw new Error('颜色必须是 #RRGGBB');
  return { type: 'SOLID', color: { r: parseInt(value.slice(1, 3), 16) / 255, g: parseInt(value.slice(3, 5), 16) / 255, b: parseInt(value.slice(5, 7), 16) / 255 } };
}

async function inspectText(task) {
  const ids = Array.isArray(task.nodeIds) ? task.nodeIds.slice(0, 100) : [];
  const nodes = ids.length ? await Promise.all(ids.map(getTextNode)) : selectionTextNodes();
  return { count: nodes.length, nodes: nodes.map(textSnapshot) };
}

async function replaceText(task) {
  const node = await getTextNode(task.nodeId);
  const before = node.characters;
  if (typeof task.expectedText === 'string' && task.expectedText !== before) throw new Error('节点文字已变化，未执行替换');
  const start = Number(task.start), end = Number(task.end);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > before.length) throw new Error('替换范围无效');
  const replacement = assertText(task.text, '替换文字', 10000);
  await loadNodeFonts(node);

  if (start === 0 && end === before.length) {
    node.characters = replacement;
  } else {
    if (end > start) node.deleteCharacters(start, end);
    if (replacement) node.insertCharacters(start, replacement, start > 0 ? 'BEFORE' : 'AFTER');
  }

  if (task.family !== undefined || task.style !== undefined) {
    const font = fontNameFrom(task);
    await loadFont(font);
    if (replacement.length) node.setRangeFontName(start, start + replacement.length, font);
  }
  return { operation: 'replace-text', before, after: node.characters, node: textSnapshot(node) };
}

async function applyFont(task) {
  const node = await getTextNode(task.nodeId);
  const font = fontNameFrom(task);
  const start = task.start === undefined ? 0 : Number(task.start);
  const end = task.end === undefined ? node.characters.length : Number(task.end);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > node.characters.length) throw new Error('字体应用范围无效');
  await loadFont(font);
  if (end > start) node.setRangeFontName(start, end, font);
  return { operation: 'apply-font', font, range: { start, end }, node: textSnapshot(node) };
}

async function createText(task) {
  const text = assertText(task.text, '文字内容', 10000);
  const font = fontNameFrom(task);
  await loadFont(font);
  const node = figma.createText();
  node.fontName = font;
  node.characters = text;
  if (task.name !== undefined) node.name = assertText(task.name, '图层名称', 200);
  if (task.fontSize !== undefined) {
    const size = Number(task.fontSize);
    if (!Number.isFinite(size) || size < 1 || size > 1000) throw new Error('字号必须为 1–1000');
    node.fontSize = size;
  }
  const paint = solidPaintFromHex(task.fillHex);
  if (paint) node.fills = [paint];
  node.x = finiteNumber(Number(task.x), 0);
  node.y = finiteNumber(Number(task.y), 0);
  if (task.parentId) {
    const parent = await figma.getNodeByIdAsync(assertNodeId(task.parentId));
    if (!parent || !('appendChild' in parent) || typeof parent.appendChild !== 'function' || parent.type === 'INSTANCE') throw new Error('目标父节点不能接收文字图层');
    parent.appendChild(node);
  }
  return { operation: 'create-text', node: textSnapshot(node) };
}

figma.ui.onmessage = async message => {
  if (message.type === 'resize') { figma.ui.resize(440, message.expanded === true ? 470 : 220); return; }
  if (message.type === 'get-settings') {
    bridgeSession = typeof message.bridgeSession === 'string' ? message.bridgeSession : '';
    if (!figma.pluginId) { storageAvailable = false; post({ type: 'settings', token: '', temporary: true }); return; }
    try {
      const policy = await figma.clientStorage.getAsync('bridge-execution-policy-v1');
      const token = policy === 'restricted-text-operations' ? await figma.clientStorage.getAsync('bridge-plugin-key-v2') : '';
      post({ type: 'settings', token: token || '' });
    } catch (error) {
      const detail = String(error.message || error);
      if (/without a plugin ID/i.test(detail)) { storageAvailable = false; post({ type: 'settings', token: '', temporary: true }); }
      else post({ type: 'settings-error', error: detail });
    }
    return;
  }
  if (message.type === 'save-settings') {
    if (!storageAvailable) return;
    try {
      await figma.clientStorage.setAsync('bridge-plugin-key-v2', message.token);
      await figma.clientStorage.setAsync('bridge-execution-policy-v1', 'restricted-text-operations');
    } catch (error) { post({ type: 'settings-error', error: String(error.message || error) }); }
    return;
  }
  if (message.type !== 'execute') return;
  const task = message.task;
  try {
    if (!task || Date.now() >= task.deadline) throw new Error('任务已过期，请重新发起。');
    let result;
    if (task.kind === 'list-fonts' || task.kind === 'check-font') {
      const fonts = (await figma.listAvailableFontsAsync()).map(item => item.fontName);
      if (task.kind === 'list-fonts') {
        result = { totalFonts: fonts.length, fonts: fonts.filter(font => `${font.family} ${font.style}`.toLowerCase().includes((task.query || '').toLowerCase())).slice(0, 2000) };
      } else {
        const requested = fontNameFrom(task);
        const matches = fonts.filter(font => font.family.toLowerCase() === requested.family.toLowerCase());
        const exact = matches.find(font => font.style.toLowerCase() === requested.style.toLowerCase());
        let loadOk = false, loadError = null;
        try { await loadFont(exact || requested); loadOk = true; } catch (error) { loadError = String(error.message || error); }
        result = { requested, matched: exact || null, matches, totalFonts: fonts.length, loadOk, loadError };
      }
    } else if (task.kind === 'inspect-text') result = await inspectText(task);
    else if (task.kind === 'replace-text') result = await replaceText(task);
    else if (task.kind === 'apply-font') result = await applyFont(task);
    else if (task.kind === 'create-text') result = await createText(task);
    else throw new Error('不支持的任务类型');
    result = result === undefined ? null : JSON.parse(JSON.stringify(result));
    post({ type: 'result', id: task.id, ok: true, result, runtime: bridgeRuntime });
  } catch (error) {
    post({ type: 'result', id: task && task.id, ok: false, error: String(error.message || error).slice(0, 4000), runtime: bridgeRuntime });
  }
};
