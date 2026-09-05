// Real Pi protocol check; optional live model check uses the same long-lived process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
const exec = promisify(execFile);

test('Pi loads extension and keeps one session across requests', {timeout:120000}, async () => {
  const socket=`tmax-pi-test-${process.pid}`;
  const tmux=async(...a)=>(await exec('tmux',['-L',socket,...a])).stdout.trim();
  const pane=await tmux('-f','/dev/null','new-session','-d','-P','-F','#{pane_id}','-x','240','-y','80');
  const connection=await tmux('display-message','-p','-t',pane,'#{socket_path},#{pid},0');
  const args=['--mode','rpc','--no-session','--no-extensions','--no-context-files','--offline','-e',resolve('internal/launcher/extension.ts')];
  if(process.env.TMAX_LIVE)args.push('--provider','openai-codex','--model',process.env.TMAX_TEST_MODEL || 'gpt-5.4-mini','--thinking','medium');
  const child=spawn('pi',args,{env:{...process.env,TMUX:connection,TMUX_PANE:pane},stdio:['pipe','pipe','pipe']});
  let buffer='', errors='', next=0;
  const pending=new Map();
  let finished;
  const messages=[];
  child.stderr.on('data',d=>errors+=d);
  child.stdout.on('data',d=>{
    buffer+=d;
    while(buffer.includes('\n')){
      const at=buffer.indexOf('\n'), line=buffer.slice(0,at);buffer=buffer.slice(at+1);
      let event;try{event=JSON.parse(line);}catch{continue;}
      if(event.type==='response' && pending.has(event.id)){
        const p=pending.get(event.id);pending.delete(event.id);
        event.success?p.resolve(event.data):p.reject(new Error(JSON.stringify(event)));
      }
      if(event.type==='message_end')messages.push(event.message);
      if(event.type==='agent_end')finished?.();
    }
  });
  const request=(type,extra={})=>new Promise((resolve,reject)=>{
    const id=String(++next);pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({id,type,...extra})+'\n');
  });
  child.on('exit',code=>{for(const p of pending.values())p.reject(new Error(`Pi exited ${code}: ${errors}`));});
  try{
    const before=await request('get_state');
    const commands=await request('get_commands');
    assert.ok(commands.commands.some(c=>c.name==='shell'));
    assert.ok(commands.commands.some(c=>c.name==='grid'));
    assert.ok(commands.commands.some(c=>c.name==='stop'));
    if(process.env.TMAX_LIVE){
      if(process.env.TMAX_BENCH){
        const done=new Promise(r=>finished=r),start=performance.now();
        await request('prompt',{message:'make 3 new panels please so that i am looking at a 2x2 grid'});
        await done;
        const elapsed=performance.now()-start;
        const calls=messages.flatMap(m=>Array.isArray(m.content)?m.content.filter(c=>c.type==='toolCall'):[]);
        assert.deepEqual(calls.map(c=>c.name),['pane_grid'],'Grid must take one direct tool call, no source investigation');
        assert.equal(calls[0].arguments.count,4);
        assert.equal((await tmux('list-panes','-t',pane,'-F','#{pane_id}')).split('\n').length,4);
        console.log('LIVE_BENCHMARK '+JSON.stringify({model:process.env.TMAX_TEST_MODEL || 'gpt-5.4-mini',thinking:'medium',request:'2x2 grid',toolCalls:calls.length,elapsedMs:elapsed}));
        const offset=messages.length, displayDone=new Promise(r=>finished=r), displayStart=performance.now();
        await request('prompt',{message:'In each of the three existing non-agent panes, replace the shell with a read-only live display running exactly: printf TMAX_DISPLAY_OK; sleep 60. Keep the current four-pane layout. Start them and verify their initial output, without waiting for them to finish.'});
        await displayDone;
        const displayCalls=messages.slice(offset).flatMap(m=>Array.isArray(m.content)?m.content.filter(c=>c.type==='toolCall'):[]);
        assert.equal(displayCalls.filter(c=>c.name==='pane_start').length,3);
        assert.ok(displayCalls.every(c=>['pane_start','pane_read','pane_list'].includes(c.name)),JSON.stringify(displayCalls));
        const ids=(await tmux('list-panes','-t',pane,'-F','#{pane_id}')).split('\n');
        assert.equal(ids.length,4);
        for(const id of ids.filter(id=>id!==pane))assert.match(await tmux('capture-pane','-p','-t',id),/TMAX_DISPLAY_OK/);
        console.log('LIVE_BENCHMARK '+JSON.stringify({request:'three existing-pane displays',toolCalls:displayCalls.length,elapsedMs:performance.now()-displayStart}));
      }
      for(const message of ['Use pane_run to execute exactly printf TMAX_JOB_OK. Then report its output and exit code. Do not use bash or other tools.', 'What exact text did that previous command print? Do not run anything again.']){
        const done=new Promise(r=>finished=r);
        await request('prompt',{message});await done;
      }
      assert.ok(messages.some(m=>m.role==='toolResult' && m.toolName==='pane_run' && JSON.stringify(m).includes('TMAX_JOB_OK')));
      assert.ok(JSON.stringify(messages.at(-1)).includes('TMAX_JOB_OK'));
    }
    const after=await request('get_state');
    assert.equal(before.sessionId,after.sessionId);
    assert.ok(!errors.includes('Failed to load extension'),errors);
  }finally{
    child.kill('SIGTERM');
    await tmux('kill-server').catch(()=>{});
  }
});
