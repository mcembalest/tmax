// A real conversation about useful views. The small planning data is a labeled fixture.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fixture,exec} from '../tests/herdr.mjs';
import {rpc} from '../tests/rpc.mjs';
if(process.env.TMAX_LIVE!=='1')throw new Error('Set TMAX_LIVE=1 to use model quota.');
const f=await fixture(process.env.TMAX_TERMINAL||'Apple_Terminal');
f.paneEnv.TMAX_VIEWS_DIR=join(f.dir,'saved');
const sourceDir=await mkdtemp(join(tmpdir(),'tmax-views-source-')),sourceHashes={};
for(const name of (await readdir('internal/launcher')).filter(n=>n.endsWith('.ts'))){const bytes=await readFile(join('internal/launcher',name));sourceHashes[name]=createHash('sha256').update(bytes).digest('hex');await writeFile(join(sourceDir,name),bytes);}
const startPi=()=>rpc(f,{live:true,extension:join(sourceDir,'extension.ts')});
let p=startPi();const results=[];
const notes='# Earlier discussion · demo fixture\n\nWe wanted a relaxed afternoon nearby, with a £40 budget. Originally we aimed to finish by 16:00.\n';
const options='# Options · demo fixture\n\n| Place | Setting | Cost |\n| --- | --- | --- |\n| Garden | Outdoors | £0 |\n| Gallery | Indoors | £12 |\n| Café | Indoors | £8 |\n';
const records=async()=>{const roots=await readdir(join(f.dir,'saved')).catch(()=>[]);const out=[];for(const root of roots){const dir=join(f.dir,'saved',root,'views');for(const name of await readdir(dir))if(name.endsWith('.json'))out.push(JSON.parse(await readFile(join(dir,name),'utf8')));}return out;};
async function displayed(file,pattern){const view=(await records()).find(v=>v.file.endsWith('/'+file));assert.ok(view?.pane);assert.match(await f.raw('pane','read',view.pane),pattern);}
async function step(name,prompt,check){
 const start=Date.now(),offset=p.events.length;let effectAt,finished=false;
 await Promise.all([p.prompt(prompt).finally(()=>{finished=true;}),p.waitFor(async()=>{try{await check();effectAt=Date.now();return true;}catch(error){if(finished)throw error;return false;}},90000)]);
 await check(); // A transiently correct display must still be correct at turn end.
 const events=p.events.slice(offset),began=new Map(events.filter(e=>e.type==='tool_execution_start').map(e=>[e.toolCallId,e.at]));
 results.push({name,prompt,effectMs:effectAt-start,elapsedMs:Date.now()-start,tools:events.filter(e=>e.type==='tool_execution_end').map(e=>({name:e.toolName,error:e.isError,elapsedMs:e.at-began.get(e.toolCallId)})),views:await records()});
 console.log(JSON.stringify(results.at(-1)));
}
try{
 await writeFile(join(f.dir,'notes.md'),notes);await writeFile(join(f.dir,'options.md'),options);
 await writeFile(join(f.dir,'plan.md'),'# Afternoon · demo fixture\n\n- 12:00 Garden\n- 14:00 Café\n- 16:00 Home\n');
 await p.request('get_state');
 await step('1 → 2','Bring our earlier discussion in notes.md into view beside this conversation. Keep it there while we work.',async()=>{assert.equal((await f.api('pane','list')).panes.length,2);await displayed('notes.md',/relaxed afternoon/);});
 await step('2 → 4','Show the options and our afternoon plan alongside it, so I can see all three while we talk.',async()=>{assert.equal((await f.api('pane','list')).panes.length,4);await displayed('options.md',/Gallery/);await displayed('plan.md',/Garden/);});
 const ids=(await f.api('pane','list')).panes.map(x=>x.terminal_id);
 await step('shared change','Actually, let’s stay indoors and be finished by three. Revise what needs to change.',async()=>{
  const plan=await readFile(join(f.dir,'plan.md'),'utf8');assert.match(plan,/15:00|3\s*(?:pm|p\.m\.)/i);assert.doesNotMatch(plan,/12:00 Garden|16:00 Home/);
  await displayed('plan.md',/15:00|3\s*(?:pm|p\.m\.)/i);
  assert.equal(await readFile(join(f.dir,'notes.md'),'utf8'),notes,'A new decision must not rewrite the earlier conversation');
  assert.deepEqual((await f.api('pane','list')).panes.map(x=>x.terminal_id),ids);
 });
 await step('4 → 1','Bring us back to just this conversation. Keep those views available for later.',async()=>assert.equal((await f.api('pane','layout','--pane',f.pane)).layout.zoomed,true));
 assert.deepEqual((await f.api('pane','list')).panes.map(x=>x.terminal_id),ids);
 const prior=p.messages;await p.close();p=startPi();await p.request('get_state');
 await step('return after restart','Show me that afternoon plan again.',async()=>{assert.equal((await f.api('pane','layout','--pane',f.pane)).layout.zoomed,false);assert.deepEqual((await f.api('pane','list')).panes.map(x=>x.terminal_id),ids);});
 p.messages.unshift(...prior);
}catch(error){results.push({status:'fail',reason:String(error)});process.exitCode=1;}
finally{
 const report={date:new Date().toISOString(),sourceHashes,herdr:(await exec('herdr',['--version'])).stdout.trim(),pi:(await exec('pi',['--version'])).stdout.trim(),model:process.env.TMAX_TEST_MODEL||'gpt-5.6-luna',thinking:process.env.TMAX_TEST_THINKING||'medium',terminal:f.env.TERM_PROGRAM,kind:'real-model; labeled planning fixture',results,conversation:p.messages};
 await writeFile(process.argv[2]||'benchmarks/results/views-live.json',JSON.stringify(report,(key,value)=>key==='content'&&Array.isArray(value)?value.filter(p=>p.type!=='thinking'):['thinkingSignature','textSignature','responseId','diagnostics'].includes(key)?undefined:value)+'\n');
 await p.close();await f.close();await rm(sourceDir,{recursive:true,force:true});
}
