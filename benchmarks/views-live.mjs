// A real conversation about useful views. The small planning data is a labeled fixture.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fixture,exec} from '../tests/herdr.mjs';
import {rpc} from '../tests/rpc.mjs';
if(process.env.TMAX_LIVE!=='1')throw new Error('Set TMAX_LIVE=1 to use model quota.');
const variant=process.env.TMAX_VIEWS_VARIANT||'original';
const scenario={
 original:{files:['notes.md','options.md','plan.md'],prompts:['Bring our earlier discussion in notes.md into view beside this conversation. Keep it there while we work.','Show the options and our afternoon plan alongside it, so I can see all three while we talk.','Actually, let’s stay indoors and be finished by three. Revise what needs to change.','Bring us back to just this conversation. Keep those views available for later.','Show me that afternoon plan again.']},
 paraphrase:{files:['a73.md','b29.md','c51.md'],prompts:['Put what we said last time, saved in a73.md, next to our chat so I can refer to it.','Let me also see the possible places in b29.md and the schedule we’re developing in c51.md.','Change of plans: no outdoor stops, and I need to be home at 3pm. Adjust the afternoon.','I just want to talk here for a bit. Leave everything else around for when we need it.','Can I see our revised schedule again?']},
}[variant];
if(!scenario)throw new Error('Unknown view benchmark variant: '+variant);
const [notesFile,optionsFile,planFile]=scenario.files;
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
 await writeFile(join(f.dir,notesFile),notes);await writeFile(join(f.dir,optionsFile),options);
 await writeFile(join(f.dir,planFile),'# Afternoon · demo fixture\n\n- 12:00 Garden\n- 14:00 Café\n- 16:00 Home\n');
 await p.request('get_state');
 await step('1 → 2',scenario.prompts[0],async()=>{assert.equal((await f.api('pane','list')).panes.length,2);await displayed(notesFile,/relaxed afternoon/);assert.equal((await records()).find(v=>v.file.endsWith('/'+notesFile))?.historical,true,'The earlier conversation must have edit protection');});
 await step('2 → 4',scenario.prompts[1],async()=>{assert.equal((await f.api('pane','list')).panes.length,4);await displayed(optionsFile,/Gallery/);await displayed(planFile,/Garden/);assert.equal((await records()).find(v=>v.file.endsWith('/'+planFile))?.historical,false,'The current plan must remain editable');});
 const ids=(await f.api('pane','list')).panes.map(x=>x.terminal_id);
 await step('shared change',scenario.prompts[2],async()=>{
  const plan=await readFile(join(f.dir,planFile),'utf8');assert.match(plan,/15:00|3\s*(?:pm|p\.m\.)/i);assert.doesNotMatch(plan,/12:00 Garden|16:00 Home/);
  await displayed(planFile,/15:00|3\s*(?:pm|p\.m\.)/i);
  assert.equal(await readFile(join(f.dir,notesFile),'utf8'),notes,'A new decision must not rewrite the earlier conversation');
  await displayed(notesFile,/16:00/);
  assert.deepEqual((await f.api('pane','list')).panes.map(x=>x.terminal_id),ids);
 });
 await step('4 → 1',scenario.prompts[3],async()=>assert.equal((await f.api('pane','layout','--pane',f.pane)).layout.zoomed,true));
 assert.deepEqual((await f.api('pane','list')).panes.map(x=>x.terminal_id),ids);
 const prior=p.messages;await p.close();p=startPi();await p.request('get_state');
 await step('return after restart',scenario.prompts[4],async()=>{assert.equal((await f.api('pane','layout','--pane',f.pane)).layout.zoomed,false);assert.deepEqual((await f.api('pane','list')).panes.map(x=>x.terminal_id),ids);await displayed(planFile,/15:00|3\s*(?:pm|p\.m\.)/i);assert.equal(await readFile(join(f.dir,notesFile),'utf8'),notes);});
 p.messages.unshift(...prior);
}catch(error){results.push({status:'fail',reason:String(error)});process.exitCode=1;}
finally{
 const report={date:new Date().toISOString(),sourceHashes,herdr:(await exec('herdr',['--version'])).stdout.trim(),pi:(await exec('pi',['--version'])).stdout.trim(),model:process.env.TMAX_TEST_MODEL||'gpt-5.6-luna',thinking:process.env.TMAX_TEST_THINKING||'medium',terminal:f.env.TERM_PROGRAM,kind:'real-model; labeled planning fixture',variant,results,conversation:p.messages};
 await writeFile(process.argv[2]||'benchmarks/results/views-live.json',JSON.stringify(report,(key,value)=>key==='content'&&Array.isArray(value)?value.filter(p=>p.type!=='thinking'):['thinkingSignature','textSignature','responseId','diagnostics'].includes(key)?undefined:value)+'\n');
 await p.close();await f.close();await rm(sourceDir,{recursive:true,force:true});
}
