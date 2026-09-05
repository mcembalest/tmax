import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fixture,until } from './herdr.mjs';

test('Pi loads both extensions and retains its conversation; optional natural-request benchmark',{timeout:120000},async()=>{
 const f=await fixture();
 const args=['--mode','rpc','--no-session','--no-extensions','--no-context-files','--offline','-e',resolve('internal/launcher/extension.ts'),'-e',f.integration];
 if(process.env.TMAX_LIVE)args.push('--provider','openai-codex','--model',process.env.TMAX_TEST_MODEL||'gpt-5.4-mini');
 const child=spawn('pi',args,{cwd:f.dir,env:f.paneEnv,stdio:['pipe','pipe','pipe']});
 let buffer='',errors='',next=0,finished;
 const pending=new Map(),messages=[];
 child.stderr.on('data',d=>errors+=d);
 child.stdout.on('data',d=>{buffer+=d;while(buffer.includes('\n')){
  const i=buffer.indexOf('\n'),line=buffer.slice(0,i);buffer=buffer.slice(i+1);
  let e;try{e=JSON.parse(line);}catch{continue;}
  if(e.type==='response'&&pending.has(e.id)){const p=pending.get(e.id);pending.delete(e.id);e.success?p.resolve(e.data):p.reject(new Error(JSON.stringify(e)));}
  if(e.type==='message_end')messages.push(e.message);
  if(e.type==='agent_end')finished?.();
 }});
 child.on('exit',code=>{for(const p of pending.values())p.reject(new Error(`Pi exited ${code}: ${errors}`));});
 const request=(type,extra={})=>new Promise((resolve,reject)=>{const id=String(++next);pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({id,type,...extra})+'\n');});
 try{
  const before=await request('get_state');
  assert.ok((await request('get_commands')).commands.some(c=>c.name==='close-workspace'));
  if(process.env.TMAX_LIVE){
   const done=new Promise(r=>finished=r),start=performance.now();
   await request('prompt',{message:'Please give me a 2 by 2 grid of panels, keeping this conversation in its current panel and the others ready for me to use.'});await done;
   const calls=messages.flatMap(m=>Array.isArray(m.content)?m.content.filter(c=>c.type==='toolCall'):[]);
   assert.ok(calls.length>0);assert.ok(calls.every(c=>c.name==='workspace'),JSON.stringify(calls));
   assert.equal((await f.api('pane','list')).panes.length,4);
   const layout=(await f.api('pane','layout','--pane',f.pane)).layout;
   assert.equal(new Set(layout.panes.map(p=>p.rect.x)).size,2);
   assert.equal(new Set(layout.panes.map(p=>p.rect.y)).size,2);
   console.log('MODEL_BENCHMARK '+JSON.stringify({request:'2x2 grid',elapsedMs:performance.now()-start,toolCalls:calls.length}));
  }
  const after=await request('get_state');assert.equal(before.sessionId,after.sessionId);
  assert.ok(!errors.includes('Failed to load extension'),errors);
 }finally{child.kill('SIGTERM');await until(async()=>assert.ok(child.exitCode!==null||child.signalCode!==null));await f.close();}
});
