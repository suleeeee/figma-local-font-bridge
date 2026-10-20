figma.showUI(__html__, { width: 440, height: 220, themeColors: true });
let bridgeSession = "", storageAvailable = true, autoExecuteEnabled = false;
function post(message) { figma.ui.postMessage({ ...message, bridgeSession }); }
const fontLoads = new Map();
async function loadFont(font) {
  const key = JSON.stringify(font);
  if (!fontLoads.has(key)) fontLoads.set(key, figma.loadFontAsync(font).catch(error => { fontLoads.delete(key); throw error; }));
  return fontLoads.get(key);
}
figma.ui.onmessage = async message => {
  if (message.type === 'resize') { figma.ui.resize(440, message.expanded === true ? 470 : 220); return; }
  if (message.type === 'get-settings') {
    bridgeSession = typeof message.bridgeSession === 'string' ? message.bridgeSession : '';

    if (!figma.pluginId) { storageAvailable = false; post({type:'settings',token:'',temporary:true,autoExecute:false}); return; }
    try { const token = await figma.clientStorage.getAsync('bridge-plugin-key-v2');
      autoExecuteEnabled = (await figma.clientStorage.getAsync('bridge-auto-execute-v1')) === true;
      post({ type: 'settings', token: token || '', autoExecute: autoExecuteEnabled });
    } catch (error) {
      const detail = String(error.message || error);
      if (/without a plugin ID/i.test(detail)) { storageAvailable = false; post({ type: 'settings', token: '', temporary: true, autoExecute: false }); }
      else post({ type: 'settings-error', error: detail });
    }
    return;
  }
  if (message.type === 'set-execution-mode') {
    autoExecuteEnabled = message.enabled === true;
    let temporary = !storageAvailable;
    if (storageAvailable) {
      try { await figma.clientStorage.setAsync('bridge-auto-execute-v1', autoExecuteEnabled); }
      catch { temporary = true; }
    }
    post({type:'execution-mode',enabled:autoExecuteEnabled,temporary});
    return;
  }
  if (message.type === 'save-settings') {
    if (!storageAvailable) return;
    try { await figma.clientStorage.setAsync('bridge-plugin-key-v2', message.token); }
    catch (error) { post({ type: 'settings-error', error: String(error.message || error) }); }
    return;
  }
  if (message.type !== 'execute') return;
  const task = message.task;
  try {
    if (Date.now() >= task.deadline) throw new Error('任务已过期，请重新发起。');
    let result;
    if (task.kind === 'list-fonts' || task.kind === 'check-font') {
      const fonts = (await figma.listAvailableFontsAsync()).map(item => item.fontName);
      if (task.kind === 'list-fonts') result = { totalFonts: fonts.length, fonts: fonts.filter(f => `${f.family} ${f.style}`.toLowerCase().includes((task.query || '').toLowerCase())).slice(0, 2000) };
      else {
        const matches = fonts.filter(f => f.family.toLowerCase() === task.family.toLowerCase());
        const exact = matches.find(f => f.style.toLowerCase() === task.style.toLowerCase());
        let loadOk = false, loadError = null;
        try { await loadFont(exact || { family: task.family, style: task.style }); loadOk = true; } catch (error) { loadError = String(error.message || error); }
        result = { requested: { family: task.family, style: task.style }, matched: exact || null, matches, totalFonts: fonts.length, loadOk, loadError };
      }
    } else if (task.kind === 'run-js' && message.approved === true) {
      if (message.approvalMode === 'trusted' && !autoExecuteEnabled) throw new Error('自动执行未获授权，请手动批准。');
      result = await new Function('figma', `return (async () => {\n${task.code}\n})();`)(figma);
    } else throw new Error('不支持的任务或代码未获批准');
    // Detect unsupported return values before the iframe message boundary.
    result = result === undefined ? null : JSON.parse(JSON.stringify(result));
    post({ type: 'result', id: task.id, ok: true, result });
  } catch (error) { post({ type: 'result', id: task.id, ok: false, error: String(error.message || error).slice(0, 4000) }); }
};
