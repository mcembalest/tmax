import {createHash} from 'node:crypto';
// Opt-in real-model sessions. No prompt routes or fixture model in this runner.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fixture,delay,exec} from '../tests/herdr.mjs';
import {rpc} from '../tests/rpc.mjs';
import {requests} from './requests.mjs';
if(process.env.TMAX_LIVE!=='1')throw new Error('Set TMAX_LIVE=1 to use the configured model/provider quota');
const variant=Number(process.env.TMAX_VARIANT||0),terminal=process.env.TMAX_TERMINAL||'Apple_Terminal';
assert.ok([0,1,2].includes(variant));
const selected=requests.filter(c=>!process.env.TMAX_CASES||process.env.TMAX_CASES.split(',').includes(c.id));
const results=[];let authError;
for(const c of selected){
 if(authError){results.push({id:c.id,intent:c.intent,status:'blocked',reason:authError});continue;}
 const f=await fixture(terminal);let p=rpc(f,{live:true}),target,observe,heldMs=0;const previousEvents=[],previousMessages=[];
 const marker='CHECK_'+randomUUID().slice(0,8),marker2='CHECK_'+randomUUID().slice(0,8),label='LABEL_'+randomUUID().slice(0,8);
 const panes=async()=>(await f.api('pane','list')).panes;
 const layout=async()=>(await f.api('pane','layout','--pane',f.pane)).layout;
 const split=async(id,d='right')=>(await f.api('pane','split',id,'--direction',d,'--cwd',f.dir,'--no-focus')).pane.pane_id;
 const makeGrid=async()=>{const r=await split(f.pane);await split(f.pane,'down');await split(r,'down');};
 const grid=async()=>{const l=await layout();return l.panes.length===4&&new Set(l.panes.map(x=>x.rect.x)).size===2&&new Set(l.panes.map(x=>x.rect.y)).size===2;};
 const received=()=>p.messages.filter(m=>m.role==='custom'&&m.customType==='tmax_results');
 const text=()=>p.messages.filter(m=>m.role==='assistant').flatMap(m=>m.content.filter(t=>t.type==='text').map(t=>t.text)).join('\n');
 const children=async()=>(await panes()).filter(x=>x.pane_id!==f.pane&&x.agent==='pi');
 const gate=async()=>{await writeFile(join(f.dir,'gated-check'),`#!/bin/sh\nprintf '%s\\n' $$ > gated.pid\nprintf 'GATED_STARTED\\n'\nwhile [ ! -f release ]; do sleep 0.1; done\nprintf '${marker}\\n'\n`,{mode:0o700});};
 const release=()=>writeFile(join(f.dir,'release'),'ready');
 const wait=async check=>p.waitFor(check,60000);
 let start,offset=0,effectAt,baseline;
 try{
  await p.request('get_state');
  await writeFile(join(f.dir,'plan.md'),'Release on Monday.\n');await writeFile(join(f.dir,'checklist.md'),`Must pass ${marker} before releasing.\n`);
  await writeFile(join(f.dir,'plan2.md'),'Release on Tuesday.\n');await writeFile(join(f.dir,'checklist2.md'),`Must pass ${marker2} before releasing.\n`);
  if(['A06','A07','A08','A09','A10','S09'].includes(c.id)){target=await split(f.pane);await f.api('pane','rename',target,c.id==='A06'||c.id==='S09'?'scratch':c.id==='A07'||c.id==='A08'?'notes':'clock');}
  if(['A09','A10','A04'].includes(c.id)){
   target??=await split(f.pane);await f.api('pane','rename',target,'clock');
   await writeFile(join(f.dir,'clock'),"#!/bin/sh\nprintf '%s\\n' $$ > clock.pid\ni=0; while :; do i=$((i+1)); printf 'TICK_%s\\n' \"$i\"; sleep 0.1; done\n",{mode:0o700});
   await f.raw('pane','run',target,'./clock');await wait(async()=>stat(join(f.dir,'clock.pid')).then(()=>true,()=>false));
   if(c.id==='A04')await split(target,'down');
  }
  if(c.id==='A05')await makeGrid();
  if(c.id==='A08')await f.api('pane','zoom',target,'--on');
  if(c.id==='S02')await p.prompt(`For this conversation, our agreed label is ${label}. Remember it; no action needed yet.`);
  if(['S04','S05','S06','S08'].includes(c.id))await gate();
  if(c.id==='S07'){
   await p.prompt(requests.find(x=>x.id==='S01').prompts[variant]);await wait(()=>received().length>0&&text().includes(marker));
   await wait(async()=>!(await p.request('get_state')).isStreaming);target=(await children())[0]?.pane_id;assert.ok(target);
  }
  if(c.id==='S10'){await writeFile(join(f.dir,'opinion-a.md'),`${marker}: recommend release.\n`);await writeFile(join(f.dir,'opinion-b.md'),`${marker2}: recommend hold.\n`);}
  baseline=await panes();const beforeResults=received().length;
  const alive=async file=>{const pid=Number(await readFile(join(f.dir,file),'utf8'));try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}};
  const effect=async()=>{
   switch(c.id){
    case 'A01':case 'A02':{const l=await layout();if(l.panes.length!==2)return false;const a=l.panes.find(x=>x.pane_id===f.pane).rect,b=l.panes.find(x=>x.pane_id!==f.pane).rect;return c.id==='A01'?b.x>a.x&&b.y===a.y:b.y>a.y&&b.x===a.x;}
    case 'A03':case 'A04':case 'A05':return grid();
    case 'A06':return JSON.stringify(await f.api('pane','get',target)).includes('notes');
    case 'A07':return (await layout()).zoomed;
    case 'A08':return !(await layout()).zoomed;
    case 'A09':return !(await alive('clock.pid'))&&(await panes()).some(x=>x.pane_id===target);
    case 'A10':return !(await panes()).some(x=>x.pane_id===target)&&!(await alive('clock.pid'));
    case 'S09':return JSON.stringify(await f.api('pane','get',target)).includes(['copy work','team swarm','roles and workers'][variant]);
    default:return (await children()).length>0;
   }
  };
  start=Date.now();offset=p.events.length;
  let observing=true;observe=(async()=>{while(observing){try{if(await effect()){effectAt=Date.now();return;}}catch{}await delay(25);}})();
  try{
   const first=p.prompt(c.prompts[variant]);first.catch(()=>{});
   if(['S04','S05','S06','S08'].includes(c.id)){
    await wait(async()=>stat(join(f.dir,'gated.pid')).then(()=>true,()=>false));await first;
    const holdStart=Date.now();
    if(c.id==='S04'){await p.prompt(['While that runs, open a shell below this conversation.','Add a terminal underneath us while the review continues.','Keep that running and give me a shell at the bottom.'][variant]);assert.ok((await panes()).length>=3);}
    if(c.id==='S05'){previousEvents.push(...p.events.slice(offset));previousMessages.push(...p.messages);offset=0;await p.close();p=rpc(f,{live:true});await p.request('get_state');}
    if(c.id==='S06')await f.api('pane','close',(await children())[0].pane_id);
    if(c.id==='S08')await f.raw('agent','prompt',(await children())[0].pane_id,'Pause that assignment. I am using this panel now; just acknowledge.');
    await release();heldMs=Date.now()-holdStart;
   }else await first;
   if(c.id.startsWith('S')&&c.id!=='S09'){
    await wait(()=>received().length>beforeResults);
    await wait(async()=>!(await p.request('get_state')).isStreaming);
    if(['S03','S10'].includes(c.id))await wait(()=>text().includes(marker)&&text().includes(marker2)&&(received().flatMap(m=>m.details?.ids||[]).length>=2));
    else if(c.id==='S02')assert.ok(text().includes(label),'context did not return');
    else if(c.id==='S06')assert.match(received().at(-1).content,/interrupted/);
    else if(c.id==='S08')assert.match(received().at(-1).content,/handed_over/);
    else {const expected=c.id==='S07'?marker2:marker;await wait(()=>text().includes(expected)&&received().some(m=>m.content.includes(expected)));}
    if(c.id==='S07')assert.equal((await children()).length,1,'follow-up created another agent');
    if(['S03','S10'].includes(c.id))assert.equal((await children()).length,2);
   }else {assert.ok(await effect(),'requested workspace effect missing');assert.equal((await children()).length,0,'unrequested delegation');}
   if(c.id==='A04')assert.ok(await alive('clock.pid'),'existing display was stopped');
   if(['A05','S09'].includes(c.id))assert.equal((await panes()).length,baseline.length,'unexpected panels');
   if(!['A07','A08'].includes(c.id))assert.equal((await layout()).focused_pane_id,f.pane,'focus moved unexpectedly');
   const after=await panes();for(const original of baseline.filter(x=>!(c.id==='A10'&&x.pane_id===target)))assert.equal(after.find(x=>x.pane_id===original.pane_id)?.terminal_id,original.terminal_id,'existing terminal replaced');
  }finally{observing=false;await observe;}
  const events=[...previousEvents,...p.events.slice(offset)],toolStarts=new Map(),toolDurations=[];
  for(const e of events){if(e.type==='tool_execution_start')toolStarts.set(e.toolCallId,e);if(e.type==='tool_execution_end'){const b=toolStarts.get(e.toolCallId);if(b)toolDurations.push({name:b.toolName,elapsedMs:e.at-b.at,error:e.isError});}}
  results.push({id:c.id,intent:c.intent,status:'pass',prompt:c.prompts[variant],effectMs:c.id==='S07'?undefined:effectAt&&effectAt-start,totalMs:Date.now()-start,heldMs,toolDurations,assistantMessages:events.filter(e=>e.type==='message_end'&&e.message.role==='assistant').length,conversation:[...previousMessages,...p.messages]});
 }catch(e){const blocked=/authentication|token is expired|unauthorized/i.test(e.message);if(blocked)authError=e.message;results.push({id:c.id,intent:c.intent,status:blocked?'blocked':'fail',reason:e.message,prompt:c.prompts[variant],elapsedMs:start?Date.now()-start:undefined,conversation:[...previousMessages,...p.messages]});}
 finally{await p.close();await f.close();}
 console.log(JSON.stringify({id:c.id,...Object.fromEntries(Object.entries(results.at(-1)).filter(([k])=>!['conversation','prompt','toolDurations'].includes(k)))}));
}
const report={sourceHashes:Object.fromEntries(await Promise.all(['internal/launcher/extension.ts','internal/launcher/handoff.ts'].map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')]))),node:process.version,platform:process.platform,arch:process.arch,date:new Date().toISOString(),revision:(await exec('git',['rev-parse','HEAD'])).stdout.trim(),provider:process.env.TMAX_TEST_PROVIDER||'openai-codex',model:process.env.TMAX_TEST_MODEL||'gpt-5.4-mini',thinking:process.env.TMAX_TEST_THINKING||'medium',terminal,variant,kind:'real-model',results};
await writeFile(process.argv[2]||'benchmarks/results/live.json',JSON.stringify(report,null,2)+'\n');
if(results.some(r=>r.status!=='pass'))process.exitCode=1;
