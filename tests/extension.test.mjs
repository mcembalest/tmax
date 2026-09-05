import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const exec = promisify(execFile);
const piPath = (await exec('which', ['pi'])).stdout.trim();
const require = createRequire(realpathSync(piPath));
const { createJiti } = require('jiti');
const jiti = createJiti(import.meta.url, { alias: { typebox: require.resolve('typebox') } });
const { default: extension } = await jiti.import(resolve('extension.ts'));
const socket = `tmax-test-${process.pid}`;
const dir = await mkdtemp(join(tmpdir(), 'tmax test '));
const tmux = async (...args) => (await exec('tmux', ['-L', socket, ...args])).stdout.trim();
const anchor = await tmux('-f', '/dev/null', 'new-session', '-d', '-P', '-F', '#{pane_id}', '-x', '240', '-y', '80', '-c', dir);
process.env.TMUX_PANE = anchor;
const tools = new Map(), commands = new Map();
extension({
  on: () => {},
  registerTool: t => tools.set(t.name, t),
  registerCommand: (n, c) => commands.set(n, c),
  exec: async (cmd, args) => {
    assert.equal(cmd, 'tmux');
    try { const r = await exec(cmd, ['-L', socket, ...args]); return { ...r, code: 0 }; }
    catch (e) { return { stdout: e.stdout, stderr: e.stderr, code: e.code }; }
  },
});
const ctx = { cwd: dir, isIdle: () => true, sessionManager: { getSessionFile: () => undefined } };
const call = (name, args = {}, signal) => tools.get(name).execute('test', args, signal, undefined, ctx);
after(async () => { await tmux('kill-server').catch(() => {}); await rm(dir, {recursive:true,force:true}); });

for (const terminal of ['Apple_Terminal', 'ghostty']) {
  test(`${terminal}: visible command result and user shell`, async () => {
    process.env.TERM_PROGRAM = terminal;
    const r = await call('pane_run', {command:'printf "hello from job\\n"; exit 7'});
    assert.match(r.content[0].text, /hello from job/);
    assert.match(r.content[0].text, /exit 7/);
    const outputPane = r.content[0].text.match(/Pane (%\d+)/)[1];
    assert.equal(await tmux('display-message','-p','-t',outputPane,'#{pane_input_off}'), '1');
    assert.equal(await tmux('display-message','-p','-t',anchor,'#{pane_active}'), '1');
    const shell = (await call('pane_shell')).content[0].text.match(/(%\d+)/)[1];
    assert.equal(await tmux('display-message','-p','-t',shell,'#{pane_input_off}'), '0');
    await tmux('select-pane','-t',shell);
    assert.equal(await tmux('display-message','-p','-t',shell,'#{pane_active}'), '1');
    await tmux('send-keys','-t',shell,'printf clicked > clicked.txt','Enter');
    for(let i=0;i<50;i++) { try { assert.equal(await readFile(join(dir,'clicked.txt'),'utf8'),'clicked'); break; } catch(e) { if(i===49)throw e; await new Promise(r=>setTimeout(r,20)); } }
    await tmux('select-pane','-t',anchor);
    await tmux('kill-pane','-t',shell);
    await commands.get('clear-output').handler('',ctx);
  });
}

test('cancellation kills command descendants', async () => {
  const controller = new AbortController();
  const pending = call('pane_run',{command:'sleep 60 & echo $! > child.pid; wait'},controller.signal);
  let pid;
  for(let i=0;i<100;i++) { try{pid=Number(await readFile(join(dir,'child.pid'),'utf8'));break;}catch{await new Promise(r=>setTimeout(r,20));} }
  assert.ok(pid);
  controller.abort();
  assert.match((await pending).content[0].text,/canceled/);
  // A killed child may briefly be a zombie awaiting reaping; it must not be running.
  try { const ps=await exec('ps',['-o','stat=','-p',String(pid)]); assert.match(ps.stdout.trim(),/^Z|^$/); } catch(e) { if(e.code!==1)throw e; }
  await commands.get('clear-output').handler('',ctx);
});

test('pane read is scoped, ephemeral fork rejected', async () => {
  await assert.rejects(call('pane_read',{pane:'%99999'}), /not in this window/);
  await assert.rejects(call('pane_fork',{task:'test'}), /saved Pi session/);
});

test('fork passes saved session, task and model without shell interpretation', async () => {
  const binary=join(dir,"fake tmax's launcher");
  await writeFile(binary,'#!/bin/sh\nprintf "%s\\n" "$@" > fork.args\nsleep 60\n',{mode:0o700});
  process.env.TMAX_BINARY=binary;
  const forkCtx={...ctx, model:{provider:'provider',id:'model'}, sessionManager:{getSessionFile:()=>join(dir,'saved session.jsonl')}};
  const task="Review only; literal $(touch should-not-exist) and 'quotes'";
  const result=await tools.get('pane_fork').execute('fork',{task},undefined,undefined,forkCtx);
  const pane=result.content[0].text.match(/pane (%\d+)/)[1];
  let args;
  for(let i=0;i<50;i++){try{args=await readFile(join(dir,'fork.args'),'utf8');break;}catch{await new Promise(r=>setTimeout(r,20));}}
  assert.equal(args,['_pi','--fork',join(dir,'saved session.jsonl'),'--provider','provider','--model','model','--',task,''].join('\n'));
  await assert.rejects(readFile(join(dir,'should-not-exist')));
  await tmux('kill-pane','-t',pane);
});
