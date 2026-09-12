// Durable documents with disposable displays. Herdr owns all pane processes.
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { Text } from '@earendil-works/pi-tui';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile, rename, realpath, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type View = { id: string; title: string; file: string; pane?: string; terminal?: string; socket?: string; renderer?: string; token?: string; starting?: boolean };
const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, 'utf8'));
const text = <T extends object>(value: T, message: string) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }], details: { ...value, message } });
const renderResult = (result: any) => new Text(result.details?.message || result.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n'), 0, 0);
const visible = ({ id, title, file, pane }: View) => ({ id, title, file, pane });
const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
async function save(path: string, content: string) {
  const temporary = path + '.' + randomUUID();
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, path);
}

export default function views(pi: ExtensionAPI, run: (args: string[], signal?: AbortSignal) => Promise<string>) {
  const renderer = fileURLToPath(new URL('./view.ts', import.meta.url));
  const api = async (args: string[], signal?: AbortSignal) => JSON.parse((await run(args, signal)).trim() || '{}').result;
  async function directory(cwd: string) {
    const base = process.env.TMAX_VIEWS_DIR || (process.platform === 'darwin' ? join(homedir(), 'Library', 'Application Support', 'tmax') : join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'tmax'));
    return join(base, createHash('sha256').update(await realpath(cwd)).digest('hex').slice(0, 24), 'views');
  }
  async function list(cwd: string): Promise<View[]> {
    const dir = await directory(cwd);
    const names = await readdir(dir).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    return Promise.all(names.filter(name => /^[a-f0-9-]+\.json$/.test(name)).map(name => read<View>(join(dir, name))));
  }
  async function lookup(id: string, cwd: string) {
    const view = (await list(cwd)).find(view => view.id === id);
    if (!view) throw new Error('View not found; inspect the saved views first.');
    return view;
  }
  async function current(view: View, cwd: string, signal?: AbortSignal) {
    if (!view.pane || view.socket !== process.env.HERDR_SOCKET_PATH) return;
    try {
      const pane = (await api(['pane', 'get', view.pane], signal)).pane;
      if (pane.terminal_id === view.terminal) {
        const info = (await api(['pane', 'process-info', '--pane', view.pane], signal)).process_info;
        const record = join(await directory(cwd), view.id + '.json');
        const viewer = info.foreground_processes.some((p: any) => p.argv?.[1] === view.renderer && p.argv?.[2] === record);
        return { pane, viewer };
      }
    } catch (error) { if (!/pane_not_found|unknown_pane/.test(String(error))) throw error; }
  }
  // Pi may request several views in one turn. Serialize layout changes locally,
  // without turning a normal parallel tool call into another model round trip.
  let pending = Promise.resolve();
  function change<T>(signal: AbortSignal | undefined, action: () => Promise<T>): Promise<T> {
    const next = pending.then(() => {
      if (signal?.aborted) throw new Error('Canceled before changing views.');
      return action();
    });
    pending = next.then(() => {}, () => {});
    return next;
  }
  pi.registerTool({
    name: 'show_view', label: 'Show',
    description: 'Show a useful document beside this conversation. Supply a title and either content (saved privately) or a file path (followed live). Reuse the returned id to update or reopen it; edits to the returned file update the display. Adding a view preserves existing terminals and focus. Saved content outlives the display and conversation. This is a document view, not another agent. For live data or progress, use existing tools to update its file; it does not fetch or execute content.',
    parameters: Type.Object({ id: Type.Optional(Type.String()), title: Type.Optional(Type.String()), content: Type.Optional(Type.String()), path: Type.Optional(Type.String()) }),
    renderCall: args => new Text('Show ' + (args.title || 'view'), 0, 0), renderResult,
    async execute(_id, args, signal, _update, ctx) {
      return change(signal, async () => {
        if (args.path !== undefined && args.content !== undefined) throw new Error('Supply content or a file path, not both.');
        const dir = await directory(ctx.cwd); await mkdir(dir, { recursive: true, mode: 0o700 });
        const id = args.id || randomUUID();
        const view = args.id ? await lookup(args.id, ctx.cwd) : { id, title: args.title || '', file: join(dir, id + '.md') } as View;
        if (args.title !== undefined) view.title = args.title.trim();
        if (!view.title) throw new Error('Give the view a short title.');
        if (args.path !== undefined) view.file = await realpath(resolve(ctx.cwd, args.path));
        if (args.content !== undefined) {
          // Updating content always writes our own document, never an external source file.
          view.file = join(dir, id + '.md'); await save(view.file, args.content);
        }
        await readFile(view.file, 'utf8');
        const layout = (await api(['pane', 'layout', '--current'], signal)).layout;
        const existing = await current(view, ctx.cwd, signal);
        if (existing && !existing.viewer && view.starting) throw new Error('View startup is unconfirmed. Inspect its pane before retrying; no second display was started.');
        if (!existing?.viewer) {
          // Split the largest available rectangle to spread 1 → 2 → 4 naturally.
          const target = [...layout.panes].sort((a: any, b: any) => b.rect.width * b.rect.height - a.rect.width * a.rect.height)[0];
          const direction = target.rect.width >= target.rect.height * 2 ? 'right' : 'down';
          const pane = (await api(['pane', 'split', target.pane_id, '--direction', direction, '--cwd', ctx.cwd, '--no-focus'], signal)).pane;
          view.pane = pane.pane_id; view.terminal = pane.terminal_id; view.socket = process.env.HERDR_SOCKET_PATH;
          view.renderer = renderer; view.token = randomUUID(); view.starting = true;
          await save(join(dir, id + '.json'), JSON.stringify(view));
          const command = [process.execPath, renderer, join(dir, id + '.json'), await realpath(process.argv[1]), ctx.ui?.theme?.name || ''].map(quote).join(' ');
          await api(['pane', 'run', view.pane!, command], signal);
        } else if (existing.pane.tab_id !== layout.tab_id) {
          await api(['pane', 'move', view.pane!, '--tab', layout.tab_id, '--split', 'right', '--no-focus'], signal);
        }
        await api(['pane', 'rename', view.pane!, view.title], signal);
        await save(join(dir, id + '.json'), JSON.stringify(view));
        const deadline = Date.now() + 3000;
        while ((await read<{token:string}>(join(dir, id + '.json.ready')).catch(() => undefined))?.token !== view.token) {
          if (signal?.aborted || Date.now() > deadline) throw new Error('View startup is unconfirmed; its pane and content were retained for inspection.');
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        view.starting = false; await save(join(dir, id + '.json'), JSON.stringify(view));
        if (layout.zoomed) await api(['pane', 'zoom', '--current', '--off'], signal);
        return text(visible(view), view.title + ' is visible and follows its source.');
      });
    },
  });
  pi.registerTool({
    name: 'dismiss_view', label: 'Dismiss',
    description: 'Close a view display, keeping its content available for reopening. Set discard=true only when its saved content should be forgotten too; external source files are never deleted. Gathering is preferable when the user wants one conversation while keeping views live. A pane repurposed for other work is protected.',
    parameters: Type.Object({ id: Type.String(), discard: Type.Optional(Type.Boolean()) }),
    renderCall: () => new Text('Dismiss view', 0, 0), renderResult,
    async execute(_id, {id,discard}, signal, _update, ctx) {
      return change(signal, async () => {
        const view = await lookup(id, ctx.cwd);
        const existing = await current(view, ctx.cwd, signal);
        if (existing && !existing.viewer) throw new Error('This pane is no longer running its view. Other work was left intact.');
        if (existing) await api(['pane', 'close', view.pane!], signal);
        delete view.pane; delete view.terminal; delete view.socket;
        const dir = await directory(ctx.cwd);
        if (discard) {
          for (const suffix of ['.json', '.md', '.json.ready']) await rm(join(dir, id + suffix), { force: true });
          return text({ id, discarded: true }, view.title + ' was discarded. External source files are unchanged.');
        }
        await save(join(dir, id + '.json'), JSON.stringify(view));
        return text(visible(view), view.title + ' is closed and available to reopen.');
      });
    },
  });
  pi.registerTool({
    name: 'gather_views', label: 'Gather',
    description: 'Return attention to this conversation by showing it alone. All other views, terminals, and running work remain intact. spread=true reveals the existing layout again.',
    parameters: Type.Object({ spread: Type.Optional(Type.Boolean()) }),
    renderCall: args => new Text(args.spread ? 'Show surrounding views' : 'Gather here', 0, 0), renderResult,
    async execute(_id, {spread}, signal) { return change(signal, async () => text(await api(['pane', 'zoom', '--current', spread ? '--off' : '--on'], signal), spread ? 'The surrounding views are visible again.' : 'Back to this conversation. Other views remain available.')); },
  });
  pi.registerCommand('gather', { description: 'Return to this conversation; keep other views running', handler: async () => { await change(undefined, () => api(['pane', 'zoom', '--current', '--on'])); } });
  pi.registerCommand('spread', { description: 'Show the views around this conversation again', handler: async () => { await change(undefined, () => api(['pane', 'zoom', '--current', '--off'])); } });
  return { list: async (cwd: string) => (await list(cwd)).map(visible) };
}
