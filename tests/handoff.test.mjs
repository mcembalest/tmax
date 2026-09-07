import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {exec,until,delay} from './herdr.mjs';
const require=createRequire(realpathSync((await exec('which',['pi'])).stdout.trim()));
const {createJiti}=require('jiti');
const {default:handoffs}=await createJiti(import.meta.url,{alias:{typebox:require.resolve('typebox')}}).import(resolve('internal/launcher/handoff.ts'));
function instance(session,branch=[],childPath,run=async args=>args[1]==='split'?JSON.stringify({result:{pane:{pane_id:'w1:p2'}}}):'{}'){
 const events=new Map(),tools=new Map(),messages=[],calls=[];
 let idle=true;
 const context={cwd:session.slice(0,session.lastIndexOf('/')),isIdle:()=>idle,ui:{notify:()=>{}},model:{provider:'test',id:'test'},sessionManager:{getSessionFile:()=>session,getBranch:()=>branch}};
 const pi={registerFlag:()=>{},getFlag:()=>childPath,on:(n,h)=>events.set(n,h),registerTool:t=>tools.set(t.name,t),appendEntry:(customType,data)=>branch.push({type:'custom',customType,data}),sendMessage:m=>{messages.push(m);branch.push({type:'custom_message',...m});}};
 handoffs(pi,async(args,signal)=>{calls.push(args);return run(args,signal);},['-e','/extension.ts','-e','/hooks.ts']);
 return {events,tools,context,messages,branch,calls,setIdle:value=>idle=value,
 start:()=>events.get('session_start')({reason:'startup'},context),stop:()=>events.get('session_shutdown')(),
 split:task=>tools.get('split_work').execute('test',{task},undefined,undefined,context)};
}
async function temporary(fn){const dir=await mkdtemp(join(tmpdir(),'tmax-handoff-'));try{await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}

test('assigned result waits for settled turn, returns after parent reload, and is not delivered twice',()=>temporary(async dir=>{
 const parent=instance(join(dir,'parent.jsonl'));await parent.start();
 try{
  const result=await parent.split('Read the project notes');const path=parent.branch[0].data.path;
  assert.equal(result.details.pane,'w1:p2');assert.equal(parent.messages.length,0);
  parent.stop();
  const child=instance(join(dir,'child.jsonl'),[],path);await child.start();
  await child.events.get('input')({text:'Read the project notes',source:'interactive'});
  child.stop(); // Extension reload in the middle of assigned work.
  const reloadedChild=instance(join(dir,'child.jsonl'),[],path);await reloadedChild.start();
  await reloadedChild.events.get('agent_end')({messages:[{role:'assistant',stopReason:'stop',content:[{type:'text',text:'The rollout is amber.'}]}]},reloadedChild.context);
  await assert.rejects(readFile(path+'.result'));
  await reloadedChild.events.get('agent_settled')();reloadedChild.stop();
  const resumed=instance(join(dir,'parent.jsonl'),parent.branch);await resumed.start();
  try{await until(async()=>assert.equal(resumed.messages.length,1));assert.match(resumed.messages[0].content,/rollout is amber/);}finally{resumed.stop();}
  const again=instance(join(dir,'parent.jsonl'),parent.branch);await again.start();
  try{await delay(1200);assert.equal(again.messages.length,0);}finally{again.stop();}
 }finally{parent.stop();}
}));

test('busy parent is not interrupted and canceled child is not labeled complete',()=>temporary(async dir=>{
 const parent=instance(join(dir,'parent.jsonl'));await parent.start();parent.setIdle(false);
 try{
  await parent.split('Inspect this');const path=parent.branch[0].data.path;
  const child=instance(join(dir,'child.jsonl'),[],path);await child.start();
  await child.events.get('input')({text:'Inspect this',source:'interactive'});
  await child.events.get('agent_end')({messages:[{role:'assistant',stopReason:'aborted',content:[]}]},child.context);
  await child.events.get('agent_settled')();child.stop();
  await delay(1200);assert.equal(parent.messages.length,0);
  parent.setIdle(true);await until(async()=>assert.equal(parent.messages.length,1));
  assert.match(parent.messages[0].content,/aborted/);
 }finally{parent.stop();}
}));

test('user takeover keeps helper panel and stops automatic assignment reporting',()=>temporary(async dir=>{
 const parent=instance(join(dir,'parent.jsonl'));await parent.split('Inspect this');const path=parent.branch[0].data.path;
 const child=instance(join(dir,'child.jsonl'),[],path);await child.start();
 await child.events.get('input')({text:'Inspect this',source:'interactive'});
 await child.events.get('input')({text:'Wait, work with me on something else',source:'interactive'});
 await child.events.get('agent_end')({messages:[{role:'assistant',stopReason:'stop',content:[{type:'text',text:'unrelated answer'}]}]},child.context);
 await child.events.get('agent_settled')();child.stop();
 const result=JSON.parse(await readFile(path+'.result','utf8'));assert.equal(result.status,'handed_over');assert.doesNotMatch(result.text,/unrelated answer/);
 assert.ok(!child.calls.some(args=>args.includes('close')));
}));

test('disappeared agent reports interrupted; transport failure does not fabricate completion',()=>temporary(async dir=>{
 for(const error of ['agent_not_found','server_not_running']){
  const parent=instance(join(dir,error+'.jsonl'),[],undefined,async args=>{
   if(args[1]==='split')return JSON.stringify({result:{pane:{pane_id:'w1:p2'}}});
   if(args[1]==='get')throw new Error(error);return '{}';
  });
  await parent.split('Inspect this');await parent.start();
  try{await delay(1300);assert.equal(parent.messages.length,error==='agent_not_found'?1:0);}finally{parent.stop();}
 }
}));
