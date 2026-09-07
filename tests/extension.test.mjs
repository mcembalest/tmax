import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixture,exec,until } from './herdr.mjs';
const require=createRequire(realpathSync((await exec('which',['pi'])).stdout.trim()));
const {createJiti}=require('jiti');
const jiti=createJiti(import.meta.url,{alias:{typebox:require.resolve('typebox')}});
const {default:extension}=await jiti.import(resolve('internal/launcher/extension.ts'));
for(const terminal of ['Apple_Terminal','ghostty'])test(`${terminal}: real Herdr workspace controls survive extension reload`,async()=>{
 const f=await fixture(terminal);
 const prior={...process.env};Object.assign(process.env,f.paneEnv);
 const tools=new Map(),events=new Map(),commands=new Map();
 const pi={registerFlag:()=>{},getFlag:()=>undefined,on:(n,h)=>events.set(n,h),registerTool:t=>tools.set(t.name,t),registerCommand:(n,c)=>commands.set(n,c),
 exec:async(bin,args,options)=>{try{return {...await exec(bin,args,{env:f.paneEnv,signal:options?.signal}),code:0};}catch(e){return {stdout:e.stdout,stderr:e.stderr,code:e.code};}}};
 const call=(args,signal)=>tools.get('workspace').execute('test',{args},signal);
 try{
  extension(pi);
  const start=performance.now();
  const split=JSON.parse((await call(['pane','split','--current','--direction','right','--cwd',f.dir,'--no-focus'])).content[0].text).result.pane;
  assert.equal((await f.api('api','snapshot')).snapshot.focused_pane_id,f.pane);
  await call(['pane','run',split.pane_id,'printf TMAX_VISIBLE; sleep 60']);
  await until(async()=>assert.match(await f.raw('pane','read',split.pane_id),/TMAX_VISIBLE/));
  tools.clear();events.clear();commands.clear();extension(pi);
  assert.match((await call(['pane','read',split.pane_id])).content[0].text,/TMAX_VISIBLE/);
  await call(['pane','send-keys',split.pane_id,'ctrl+c']);
  assert.match((await call(['pane','read',split.pane_id])).content[0].text,/TMAX_VISIBLE/);
  await assert.rejects(call(['pane','wait-output',split.pane_id,'--match','never-output-123','--timeout','50']),/timeout/);
  assert.ok((await f.api('pane','get',split.pane_id)).pane);
  const waiting=new AbortController();
  const pending=call(['pane','wait-output',split.pane_id,'--match','never-output-456'],waiting.signal);
  setTimeout(()=>waiting.abort(),100);
  await assert.rejects(pending,/observation canceled/);
  assert.ok((await f.api('pane','get',split.pane_id)).pane);
  const controller=new AbortController();controller.abort();
  await assert.rejects(call(['pane','close',split.pane_id],controller.signal),/Canceled/);
  assert.ok((await f.api('pane','get',split.pane_id)).pane);
  await assert.rejects(call(['server','stop']),/Use pane/);
  await assert.rejects(call(['agent','wait','x','--timeout','60000']),/30000/);
  await call(['pane','close',split.pane_id]);
  await assert.rejects(f.api('pane','get',split.pane_id));
  if(process.env.TMAX_BENCH)console.log('LOCAL_BENCHMARK '+JSON.stringify({terminal,scenario:'split, run, read, reload, interrupt, close',elapsedMs:performance.now()-start}));
  await commands.get('close-workspace').handler('',{isIdle:()=>true});
  assert.equal((await f.api('workspace','list')).workspaces.length,0);
 }finally{process.env=prior;await f.close();}
});

test('login guidance never rewrites the editor after reload or resume',async()=>{
 const events=new Map();extension({registerFlag:()=>{},getFlag:()=>undefined,on:(n,h)=>events.set(n,h),registerTool:()=>{},registerCommand:()=>{}});
 for(const reason of ['startup','reload','resume']){
  let editor='';
  await events.get('session_start')({reason},{mode:'tui',modelRegistry:{getAvailable:()=>[]},ui:{getEditorText:()=>editor,setEditorText:value=>editor=value,notify:()=>{}}});
  assert.equal(editor,reason==='startup'?'/login':'');
 }
});
