// A file viewer using Pi's renderer; no model, agent loop, or network client.
import { createRequire } from 'node:module';
import { watchFile, unwatchFile } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const [record, piEntry, themeName] = process.argv.slice(2);
const require = createRequire(piEntry);
const { Markdown, ProcessTerminal, TuiAltScreen, ScrollView, matchesKey, stripTerminalSequences } = await import(pathToFileURL(require.resolve('@earendil-works/pi-tui')).href);
let root = dirname(piEntry), entry;
while (root !== dirname(root)) {
  const pkg = await readFile(join(root, 'package.json'), 'utf8').then(JSON.parse).catch(() => undefined);
  if (pkg?.name === '@earendil-works/pi-coding-agent') { entry = join(root, pkg.main); break; }
  root = dirname(root);
}
if (!entry) throw new Error('Cannot locate the installed Pi renderer.');
const { getMarkdownTheme, initTheme } = await import(pathToFileURL(entry).href);
initTheme(themeName);
const document = new Markdown('', 1, 1, getMarkdownTheme());
const terminal = new ProcessTerminal(), tui = new TuiAltScreen(terminal);
let file, closed = false, reading = false, pending = false;
async function refresh() {
  if (reading) { pending = true; return; }
  reading = true;
  try {
    const view = JSON.parse(await readFile(record, 'utf8'));
    if (view.file !== file) {
      if (file) unwatchFile(file);
      file = view.file; watchFile(file, { interval: 100 }, () => void refresh());
    }
    const content = await readFile(file, 'utf8');
    document.setText(stripTerminalSequences(content));
  } catch (error) {
    document.setText('Source unavailable. Waiting for it to return.\n\n' + file);
  } finally {
    reading = false;
    if (!closed) tui.requestRender();
    if (pending && !closed) { pending = false; void refresh(); }
  }
}
function stop() {
  if (closed) return;
  closed = true; if (file) unwatchFile(file); unwatchFile(record); tui.stop(); process.exit(0);
}
tui.setLayoutRoot(new ScrollView(document, { follow: 'none', primary: true }));
tui.addInputListener(data => {
  if (matchesKey(data, 'ctrl+c') || data === 'q') { stop(); return { consume: true }; }
});
process.on('SIGTERM', stop); process.on('SIGINT', stop);
watchFile(record, { interval: 100 }, () => void refresh());
await refresh(); tui.start();
const { token } = JSON.parse(await readFile(record, 'utf8'));
await writeFile(record + '.ready', JSON.stringify({ token, pid: process.pid }), { mode: 0o600 });
