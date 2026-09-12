// Durable documents with disposable displays. Herdr owns all pane processes.
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { Text } from '@earendil-works/pi-tui';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile, rename, realpath, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

type View = { id: string; title: string; file: string; historical?: boolean; pane?: string; terminal?: string; socket?: string; renderer?: string; token?: string; starting?: boolean };
const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, 'utf8'));
const text = <T extends object>(value: T, message: string) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }], details: { ...value, message } });
const renderResult = (result: any) => new Text(result.details?.message || result.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n'), 0, 0);
const visible = ({ id, title, file, historical, pane }: View) => ({ id, title, file, historical, pane });
// Match Pi's file-tool spelling rules, then resolve aliases even for missing files.
async function canonical(path: string): Promise<string> {
  try { return await realpath(path); }
  catch (error: any) { if (error.code !== 'ENOENT') throw error; return join(await canonical(dirname(path)), basename(path)); }
}
async function toolPath(path: string, cwd: string) {
  path = path.replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ').replace(/^@/, '');
  if (path === '~' || path.startsWith('~/')) path = join(homedir(), path.slice(2));
  if (path.startsWith('file://')) path = fileURLToPath(path);
  return canonical(resolve(cwd, path));
}
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
    return Promise.all(names.filter(name => /^[a-f0-9-]+\.json$/.test(name)).map(async name => {
      const view = await read<View>(join(dir, name));
      // Existing files alone do not imply history; recall can mark older views.
      view.historical ??= false;
      return view;
    }));
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
  async function historyFor(file: string, cwd: string) {
    const target = await canonical(file), info = await stat(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
    for (const view of (await list(cwd)).filter(v => v.historical)) {
      if (await canonical(view.file) === target) return view;
      const source = await stat(view.file).catch(error => { if (error.code !== 'ENOENT') throw error; });
      if (info && source && info.dev === source.dev && info.ino === source.ino) return view;
    }
  }
  pi.on('tool_call', async (event, ctx) => {
    if (event.toolName !== 'edit' && event.toolName !== 'write') return;
    return change(undefined, async () => {
      const view = await historyFor(await toolPath(event.input.path as string, ctx.cwd), ctx.cwd);
      if (view) return { block: true, reason: `"${view.title}" is recorded history. Its source was left unchanged. Apply the new decision to a working document instead; do not bypass this protection with another tool.` };
    });
  });
  for (const historical of [false, true]) pi.registerTool({
    name: historical ? 'recall_view' : 'show_view', label: historical ? 'Recall' : 'Show',
    promptSnippet: historical ? 'Display and preserve past conversations or historical records.' : 'Display and update current documents, plans, drafts or live data.',
    promptGuidelines: historical ? ['Use recall_view for past conversations and historical records. Use show_view for current documents that may change.'] : undefined,
    description: (historical
      ? 'Recall a past conversation or historical record beside this conversation. Its source is protected from Pi edit/write and this view cannot be rewritten. New decisions belong in current documents shown with show_view. '
      : 'Show or update a current document beside this conversation. For a past conversation or historical record, use recall_view. Current plans, drafts, options and live data remain editable, including when sourced from existing files. ')
      + 'Supply a title and either content (saved privately) or a file path (followed live). Reuse the returned id to update an editable view or reopen any view. Adding a view preserves terminals and focus. Saved content outlives the display and conversation. This is a document view, not another agent; it does not fetch or execute content.',
    parameters: Type.Object({ id: Type.Optional(Type.String()), title: Type.Optional(Type.String()), content: Type.Optional(Type.String()), path: Type.Optional(Type.String()) }),
    renderCall: args => new Text((historical ? 'Recall ' : 'Show ') + (args.title || 'view'), 0, 0), renderResult,
    async execute(_id, args, signal, _update, ctx) {
      return change(signal, async () => {
        if (args.path !== undefined && args.content !== undefined) throw new Error('Supply content or a file path, not both.');
        const dir = await directory(ctx.cwd); await mkdir(dir, { recursive: true, mode: 0o700 });
        const id = args.id || randomUUID();
        const view = args.id ? await lookup(args.id, ctx.cwd) : { id, title: args.title || '', file: join(dir, id + '.md'), historical } as View;
        if (historical) view.historical = true;
        const path = args.path === undefined ? undefined : await toolPath(args.path, ctx.cwd);
        if (args.id && view.historical && (args.content !== undefined || path !== undefined && path !== view.file)) throw new Error('A historical view cannot be rewritten. Keep it intact and update a current document instead.');
        if (args.title !== undefined) view.title = args.title.trim();
        if (!view.title) throw new Error('Give the view a short title.');
        if (path !== undefined) view.file = path;
        const protectedSource = !view.historical && await historyFor(args.content !== undefined ? join(dir, id + '.md') : view.file, ctx.cwd);
        if (protectedSource) throw new Error('This file preserves recorded history. Use a separate working document.');
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
