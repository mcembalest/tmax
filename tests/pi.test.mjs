import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { fixture,until,delay } from './herdr.mjs';

for(const context of process.env.TMAX_LIVE?['live']:['fresh','fork'])test(`Pi ${context}: real helper returns findings to a responsive parent`,{timeout:180000},async()=>{
 const f=await fixture();
 const args=['--mode','rpc','--session',resolve(f.dir,'parent.jsonl'),'--no-extensions','--no-context-files','--offline','-e',resolve('internal/launcher/extension.ts'),'-e',f.integration];
 if(!process.env.TMAX_LIVE)args.push('-e',resolve('tests/fixtures/provider.ts'),'--provider','tmax-test','--model','fixture');
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
   assert.ok(calls.length>0,JSON.stringify(messages)+errors);assert.ok(calls.every(c=>c.name==='workspace'),JSON.stringify(calls));
   assert.equal((await f.api('pane','list')).panes.length,4);
   const layout=(await f.api('pane','layout','--pane',f.pane)).layout;
   assert.equal(new Set(layout.panes.map(p=>p.rect.x)).size,2);
   assert.equal(new Set(layout.panes.map(p=>p.rect.y)).size,2);
   console.log('MODEL_BENCHMARK '+JSON.stringify({request:'2x2 grid',elapsedMs:performance.now()-start,toolCalls:calls.length}));
   await writeFile(resolve(f.dir,'rollout-plan.md'),'Ship to everyone on Monday.\n');
   await writeFile(resolve(f.dir,'checklist.md'),'Before shipping, the RIVERSTONE canary must pass.\n');
   const offset=messages.length, splitStart=performance.now();
   const started=new Promise(r=>finished=r);
   await request('prompt',{message:'Have another copy of you check rollout-plan.md against checklist.md and bring back any mismatch. Keep this conversation available while it works.'});
   await started;
   const splitCalls=messages.slice(offset).flatMap(m=>Array.isArray(m.content)?m.content.filter(c=>c.type==='toolCall'):[]);
   assert.equal(splitCalls.filter(c=>c.name==='split_work').length,1,JSON.stringify(splitCalls));
   const chatting=new Promise(r=>finished=r);
   await request('prompt',{message:'While that is happening, what is six times seven?'});await chatting;
   for(let i=0;i<900;i++){
    const relevant=messages.slice(offset);
    const returned=relevant.some(m=>m.role==='custom'&&m.customType==='tmax_results');
    if(returned&&relevant.some(m=>m.role==='assistant'&&JSON.stringify(m.content).includes('RIVERSTONE'))&&!(await request('get_state')).isStreaming)break;
    if(i===899)assert.fail('Helper result did not return: '+JSON.stringify(relevant));
    await delay(100);
   }
   assert.ok(messages.slice(offset).some(m=>m.role==='assistant'&&JSON.stringify(m.content).includes('42')));
   assert.equal(messages.slice(offset).filter(m=>m.role==='custom'&&m.customType==='tmax_results').length,1);
   console.log('MODEL_BENCHMARK '+JSON.stringify({request:'split, keep chatting, return findings',elapsedMs:performance.now()-splitStart}));
  }
  if(!process.env.TMAX_LIVE){
   const started=new Promise(r=>finished=r);
   await request('prompt',{message:`Please split this fixture check with ${context} context.`});await started;
   assert.ok(messages.some(m=>m.role==='toolResult'&&m.toolName==='split_work'&&!m.isError),JSON.stringify(messages)+errors);
   const chatting=new Promise(r=>finished=r);
   await request('prompt',{message:'What is six times seven?'});await chatting;
   await until(async()=>assert.ok(messages.some(m=>m.role==='assistant'&&JSON.stringify(m.content).includes('Received RIVERSTONE')),JSON.stringify(messages)+errors));
   assert.equal(messages.filter(m=>m.role==='custom'&&m.customType==='tmax_results').length,1);
   assert.equal((await f.api('pane','list')).panes.length,2);
  }
  const after=await request('get_state');assert.equal(before.sessionId,after.sessionId);
  assert.ok(!errors.includes('Failed to load extension'),errors);
 }catch(error){console.error('PANELS',await f.api('pane','list'));console.error('HELPER',await f.raw('pane','read','w1:p2').catch(String));throw error;}finally{child.kill('SIGTERM');await until(async()=>assert.ok(child.exitCode!==null||child.signalCode!==null));await f.close();}
});
