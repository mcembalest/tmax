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
const tools = new Map(), commands = new Map(), events = new Map();
const pi = {
  on: (name, handler) => events.set(name, handler),
  registerTool: t => tools.set(t.name, t),
  registerCommand: (n, c) => commands.set(n, c),
  exec: async (cmd, args) => {
    assert.equal(cmd, 'tmux');
    try { const r = await exec(cmd, ['-L', socket, ...args]); return { ...r, code: 0 }; }
    catch (e) { return { stdout: e.stdout, stderr: e.stderr, code: e.code }; }
  },
};
extension(pi);
const notices = [];
const ctx = { cwd: dir, isIdle: () => true, ui: { notify: (message, level) => notices.push({message,level}) }, sessionManager: { getSessionFile: () => undefined } };
const call = (name, args = {}, signal) => tools.get(name).execute('test', args, signal, undefined, ctx);
after(async () => { await tmux('kill-server').catch(() => {}); await rm(dir, {recursive:true,force:true}); });

for (const terminal of ['Apple_Terminal', 'ghostty']) {
  test(`${terminal}: visible command result and user shell`, async () => {
    process.env.TERM_PROGRAM = terminal;
    const r = await call('pane_run', {command:'printf "hello from job\\n"; exit 7'});
    assert.match(r.content[0].text, /hello from job/);
    assert.match(r.content[0].text, /exit 7/);
    const outputPane = r.content[0].text.match(/Pane (%\d+)/)[1];
    assert.equal(await tmux('display-message','-p','-t',outputPane,'#{pane_dead} #{pane_dead_status}'), '1 7');
    assert.match((await call('pane_read',{pane:outputPane})).content[0].text, /hello from job/);
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

async function resetPanes() {
  await tmux('resize-window','-t',anchor,'-x','240','-y','80');
  for(const id of (await tmux('list-panes','-t',anchor,'-F','#{pane_id}')).split('\n')) {
    if(id!==anchor)await tmux('kill-pane','-t',id);
  }
}

for(const terminal of ['Apple_Terminal','ghostty']) {
  test(`${terminal}: grid, layouts, resize, swap, title, focus, zoom and close`,async()=>{
    process.env.TERM_PROGRAM=terminal;
    await resetPanes();
    const result=await call('pane_grid',{count:4});
    const rows=(await tmux('list-panes','-t',anchor,'-F','#{pane_id} #{pane_left} #{pane_top} #{pane_width} #{pane_height}')).split('\n').map(s=>s.split(' '));
    assert.equal(rows.length,4);
    assert.equal(new Set(rows.map(r=>r[1])).size,2);
    assert.equal(new Set(rows.map(r=>r[2])).size,2);
    assert.ok(Math.max(...rows.map(r=>+r[3]))-Math.min(...rows.map(r=>+r[3]))<=1);
    assert.equal(await tmux('display-message','-p','-t',anchor,'#{pane_active}'),'1');
    const first=rows[1][0], second=rows[2][0];
    const original=(await tmux('list-panes','-t',anchor,'-F','#{pane_id}')).split('\n').sort();
    await call('pane_grid',{count:4}); // Repeating must not add panes.
    assert.deepEqual((await tmux('list-panes','-t',anchor,'-F','#{pane_id}')).split('\n').sort(),original);
    await assert.rejects(call('pane_grid',{count:3}),/Close unwanted panes/);
    await assert.rejects(call('pane_grid',{count:NaN}),/1–12/);
    await call('pane_title',{pane:first,title:'logs $(touch nope)'});
    assert.equal(await tmux('display-message','-p','-t',first,'#{pane_title}'),'logs $(touch nope)');
    await call('pane_swap',{first,second});
    assert.equal(await tmux('display-message','-p','-t',first,'#{pane_left} #{pane_top}'),rows[2].slice(1,3).join(' '));
    await call('pane_layout',{layout:'even-horizontal'});
    await call('pane_resize',{pane:first,width:70});
    assert.equal(await tmux('display-message','-p','-t',first,'#{pane_width}'),'70');
    await call('pane_focus',{pane:first});
    assert.equal(await tmux('display-message','-p','-t',first,'#{pane_active}'),'1');
    await call('pane_zoom',{pane:first,enabled:true});
    await call('pane_zoom',{pane:first,enabled:true});
    assert.equal(await tmux('display-message','-p','-t',first,'#{window_zoomed_flag}'),'1');
    await call('pane_zoom',{enabled:false});
    assert.equal(await tmux('display-message','-p','-t',first,'#{window_zoomed_flag}'),'0');
    await call('pane_focus');
    const prompt=await events.get('before_agent_start')({systemPrompt:'BASE'});
    assert.ok(prompt.systemPrompt.startsWith('BASE'));
    assert.match(prompt.systemPrompt,/pane_grid once/);
    assert.ok(prompt.systemPrompt.includes(first));
    assert.ok(!prompt.systemPrompt.includes('touch nope')); // Titles never become system instructions.
    await assert.rejects(call('pane_close',{pane:anchor}),/Cannot close this agent/);
    await assert.rejects(call('pane_focus',{pane:'%99999'}),/not in this window/);
    await call('pane_close',{pane:first});
    assert.equal((await tmux('list-panes','-t',anchor,'-F','#{pane_id}')).split('\n').length,3);
    assert.ok(result.content[0].text.includes('position='));
    await resetPanes();
  });
}

test('slash commands run directly and reject malformed input',async()=>{
  await resetPanes();
  await commands.get('grid').handler('2x2',ctx);
  assert.equal((await tmux('list-panes','-t',anchor,'-F','#{pane_id}')).split('\n').length,4);
  const id=(await tmux('list-panes','-t',anchor,'-F','#{pane_id}')).split('\n')[1];
  await commands.get('layout').handler('even-vertical',ctx);
  await commands.get('focus').handler(id,ctx);
  await commands.get('focus').handler('',ctx);
  for(const [name,args] of [['resize',`${id} nope 20`],['resize',id],['close-pane',''],['stop',''],['stop','nope'],['stop',`${id} extra`],['stop',anchor],['stop',id],['stop','%99999'],['swap',id],['grid','2x3'],['layout','garbage']]){
    await commands.get(name).handler(args,ctx);
    assert.equal(notices.at(-1).level,'error',`${name}: ${JSON.stringify(notices.at(-1))}`);
  }
  await resetPanes();
});

test('headless grid benchmark', {skip:!process.env.TMAX_BENCH},async()=>{
  const samples=[];
  for(let i=0;i<10;i++){
    await resetPanes();
    const start=performance.now();
    await call('pane_grid',{count:4});
    samples.push(performance.now()-start);
  }
  const sorted=[...samples].sort((a,b)=>a-b);
  const report={operation:'one pane to 2x2 grid',runs:samples.length,medianMs:(sorted[4]+sorted[5])/2,p90Ms:sorted[8],maxMs:sorted[9],samplesMs:samples};
  console.log('BENCHMARK '+JSON.stringify(report));
  if(process.env.TMAX_BENCH_OUTPUT)await writeFile(process.env.TMAX_BENCH_OUTPUT,JSON.stringify(report,null,2)+'\n');
  assert.ok(report.maxMs<2000,'Local pane actions exceeded the 2-second regression budget');
  await resetPanes();
});

for (const terminal of ['Apple_Terminal', 'ghostty']) {
  test(`${terminal}: populate, inspect, stop and replace a four-pane workspace`, async () => {
    process.env.TERM_PROGRAM = terminal;
    await resetPanes();
    await events.get('session_start')();
    assert.equal(await tmux('show-options','-wv','-t',anchor,'pane-border-status'),'top');
    assert.match(await tmux('show-options','-wv','-t',anchor,'pane-border-format'), /pane_title/);
    await call('pane_grid',{count:4});
    const geometry = () => tmux('list-panes','-t',anchor,'-F','#{pane_id} #{pane_left} #{pane_top} #{pane_width} #{pane_height}');
    const before = await geometry();
    const ids = before.split('\n').map(row=>row.split(' ')[0]).filter(id=>id!==anchor);
    await assert.rejects(call('pane_start',{pane:ids[0],command:'exit 0'}),/replace=true/);
    await assert.rejects(call('pane_start',{pane:anchor,command:'exit 0',replace:true}),/agent/);
    await assert.rejects(call('pane_start',{pane:'%99999',command:'exit 0'}),/not in this window/);
    await assert.rejects(call('pane_stop',{pane:ids[0]}),/managed display/);
    const samples=[];
    for (const [index,id] of ids.entries()) {
      const start=performance.now();
      const result=await call('pane_start',{pane:id,title:`display ${index}`,replace:true,command:`printf 'READY ${index} '; stty size; sleep 60 & echo $! > display-${index}.pid; n=0; while :; do n=$((n+1)); printf '\\nTICK %s' "$n"; sleep 0.05; done`});
      samples.push(performance.now()-start);
      assert.match(result.content[0].text,new RegExp(`READY ${index}`));
      assert.match(result.content[0].text,/dead=0/);
      const dimensions=await tmux('display-message','-p','-t',id,'#{pane_height} #{pane_width}');
      assert.ok(result.content[0].text.includes(`READY ${index} ${dimensions}`),'display should see its actual terminal dimensions');
      assert.equal(await tmux('display-message','-p','-t',id,'#{pane_input_off}'),'1');
      assert.equal(await tmux('display-message','-p','-t',id,'#{pane_title}'),`display ${index}`);
      assert.match((await call('pane_read',{pane:id})).content[0].text,/READY/);
    }
    const ticks = output => [...output.matchAll(/TICK (\d+)/g)].map(m=>Number(m[1])).at(-1);
    const initial=ticks((await call('pane_read',{pane:ids[0]})).content[0].text);
    await new Promise(r=>setTimeout(r,120));
    assert.ok(ticks((await call('pane_read',{pane:ids[0]})).content[0].text)>initial,'display must keep updating after tool returns');
    assert.equal(await geometry(),before);
    assert.equal(await tmux('display-message','-p','-t',anchor,'#{pane_active}'),'1');
    const pid=Number(await readFile(join(dir,'display-0.pid'),'utf8'));
    await commands.get('stop').handler(ids[0],ctx);
    assert.equal(notices.at(-1).level,'info');
    assert.match(notices.at(-1).message,/Stopped/);
    for(let i=0;i<50;i++) {
      try { const ps=await exec('ps',['-o','stat=','-p',String(pid)]); if(/^Z|^$/.test(ps.stdout.trim()))break; if(i===49)assert.fail(`display descendant ${pid} survived stop`); }
      catch(e){if(e.code===1)break;throw e;}
      await new Promise(r=>setTimeout(r,20));
    }
    await commands.get('stop').handler(ids[0],ctx); // Idempotent.
    assert.equal(notices.at(-1).level,'info');
    assert.match((await call('pane_read',{pane:ids[0]})).content[0].text,/READY 0/,'stopping must preserve visible output');
    const failed=await call('pane_start',{pane:ids[0],command:'printf START_FAILED; exit 7'});
    assert.match(failed.content[0].text,/dead=1 exit=7/);
    assert.match(failed.content[0].text,/START_FAILED/);
    const replacement=await call('pane_start',{pane:ids[0],interactive:true,command:'printf REPLACED; read value; printf "INPUT:%s" "$value"'});
    assert.match(replacement.content[0].text,/REPLACED/);
    await tmux('select-pane','-t',ids[0]);
    await tmux('send-keys','-t',ids[0],'hello','Enter');
    for(let i=0;i<50;i++) {
      const output=(await call('pane_read',{pane:ids[0]})).content[0].text;
      if(output.includes('INPUT:hello'))break;
      if(i===49)assert.fail(output);
      await new Promise(r=>setTimeout(r,20));
    }
    assert.equal(await geometry(),before);
    assert.match((await call('pane_list')).content[0].text,/role=display/);
    if(process.env.TMAX_BENCH)console.log('BENCHMARK '+JSON.stringify({operation:'start display in existing pane',terminal,samplesMs:samples,maxMs:Math.max(...samples)}));
    assert.ok(Math.max(...samples)<2000,'display startup should not wait for process completion');
    for(const id of ids)await call('pane_stop',{pane:id});
    await resetPanes();
  });
}

test('login guidance uses Pi UI only for an unconfigured, empty interactive session', async () => {
  for (const [mode, models, initial, expected] of [
    ['tui', [], '', '/login'],
    ['tui', [{}], '', ''],
    ['tui', [], 'draft prompt', 'draft prompt'],
    ['rpc', [], '', ''],
  ]) {
    let editor = initial;
    const messages = [];
    await events.get('session_start')({}, {
      mode, modelRegistry: {getAvailable: () => models},
      ui: {getEditorText: () => editor, setEditorText: value => editor = value, notify: message => messages.push(message)},
    });
    assert.equal(editor, expected);
    assert.equal(messages.length, expected === '/login' ? 1 : 0);
  }
});

for (const terminal of ['Apple_Terminal', 'ghostty']) {
  test(`${terminal}: stop output work, preserve results across reload, and clear owned panes`, async () => {
    process.env.TERM_PROGRAM = terminal;
    await resetPanes();
    let opened;
    const ready = new Promise(resolve => { opened = resolve; });
    const pending = tools.get('pane_run').execute('stop-test',
      {command:'printf KEEP_THIS; sleep 60'}, undefined,
      update => opened(update.content[0].text.match(/pane (%\d+)/)[1]), ctx);
    const id = await ready;
    await commands.get('stop').handler(id,ctx);
    assert.equal(notices.at(-1).level,'info');
    await pending;
    await call('pane_stop',{pane:id});
    assert.match((await call('pane_read',{pane:id})).content[0].text,/KEEP_THIS/);
    assert.equal(await tmux('display-message','-p','-t',id,'#{pane_dead}'),'1');
    // Reload must retain both kinds of output and rediscover ownership without JS state.
    const display = (await call('pane_shell')).content[0].text.match(/(%\d+)/)[1];
    await call('pane_start',{pane:display,command:'printf DISPLAY; sleep 60',replace:true});
    await events.get('session_shutdown')?.({},ctx);
    tools.clear(); commands.clear(); events.clear();
    extension(pi);
    await events.get('session_start')({},ctx);
    assert.match((await call('pane_read',{pane:id})).content[0].text,/KEEP_THIS/);
    assert.match((await call('pane_read',{pane:display})).content[0].text,/DISPLAY/);
    await commands.get('clear-output').handler('',ctx);
    await assert.rejects(call('pane_read',{pane:id}),/not in this window/);
    await call('pane_stop',{pane:display});
    await resetPanes();
  });
}

test('finite job timeout retains output and a dead pane', async () => {
  const result = await call('pane_run',{command:'printf BEFORE_TIMEOUT; sleep 60',timeoutSeconds:1});
  assert.match(result.content[0].text,/timed out/);
  assert.match(result.content[0].text,/BEFORE_TIMEOUT/);
  const id = result.content[0].text.match(/Pane (%\d+)/)[1];
  assert.equal(await tmux('display-message','-p','-t',id,'#{pane_dead}'),'1');
  await commands.get('clear-output').handler('',ctx);
});

test('closing a running output pane stops its job and completes the tool', async () => {
  let opened;
  const ready = new Promise(resolve => { opened = resolve; });
  const pending = tools.get('pane_run').execute('close-test',
    {command:'sleep 60'}, undefined,
    update => opened(update.content[0].text.match(/pane (%\d+)/)[1]), ctx);
  const id = await ready;
  const pid = await tmux('display-message','-p','-t',id,'#{pane_pid}');
  await call('pane_close',{pane:id});
  assert.match((await pending).content[0].text,/closed; job stopped/);
  try {
    const result = await exec('ps',['-o','stat=','-p',pid]);
    assert.match(result.stdout.trim(),/^Z|^$/);
  } catch (error) { if (error.code !== 1) throw error; }
});
