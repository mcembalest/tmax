import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,writeFile,rename,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fixture,exec,until} from './herdr.mjs';
const piEntry=realpathSync((await exec('which',['pi'])).stdout.trim()),require=createRequire(piEntry);
const {createJiti}=require('jiti');
const {default:views}=await createJiti(import.meta.url,{alias:{typebox:require.resolve('typebox'),'@earendil-works/pi-tui':require.resolve('@earendil-works/pi-tui')}}).import(resolve('internal/launcher/views.ts'));
for(const terminal of ['Apple_Terminal','ghostty'])test(`${terminal}: useful views spread, update, gather, survive reload and reopen`,async()=>{
 const f=await fixture(terminal),env={...process.env},argv=process.argv[1];
 Object.assign(process.env,f.paneEnv,{TMAX_VIEWS_DIR:join(f.dir,'saved')});process.argv[1]=piEntry;
 const tools=new Map(),commands=new Map(),ctx={cwd:f.dir,ui:{theme:{name:'dark'}}};let suppressLaunch=false;
 const load=()=>views({on(){},registerTool:t=>tools.set(t.name,t),registerCommand:(n,c)=>commands.set(n,c)},async(args,signal)=>suppressLaunch&&args[0]==='pane'&&args[1]==='run'?'':(await exec('herdr',args,{env:f.paneEnv,signal})).stdout);
 const call=(name,args={},signal)=>tools.get(name).execute('test',args,signal,undefined,ctx);
 const visible=async(id,pattern)=>until(async()=>assert.match(await f.raw('pane','read',id),pattern));
 try {
  let registry=load();const start=performance.now();
  const memory=(await call('show_view',{title:'Remembered',content:'# Remembered\n\nSILVER_BEACON\n\n- Finish by four\n- Stay nearby'})).details;
  await visible(memory.pane,/SILVER_BEACON/);const firstViewMs=performance.now()-start;
  assert.equal((await f.api('pane','list')).panes.length,2);
  const source=join(f.dir,"live source's notes.md");await writeFile(source,'# Conditions\n\nLIVE_CLEAR');
  const canceled=new AbortController();
  const batch=[call('show_view',{title:'Conditions',path:source}),call('show_view',{title:'Plan',content:'# Saturday\n\n| When | What |\n| --- | --- |\n| 12:00 | Explore |\n| 16:00 | Home |'})];
  const abandoned=assert.rejects(call('show_view',{title:'Canceled',content:'Never create this view'},canceled.signal),/Canceled/);canceled.abort();
  const [{details:conditions},{details:plan}]=await Promise.all(batch);await abandoned;
  assert.equal((await registry.list(f.dir)).length,3,'Canceled queued requests must not create a view');
  await visible(conditions.pane,/LIVE_CLEAR/);await visible(plan.pane,/Saturday/);
  const layout=(await f.api('pane','layout','--pane',f.pane)).layout;
  assert.equal(layout.panes.length,4);assert.equal(new Set(layout.panes.map(p=>p.rect.x)).size,2);assert.equal(new Set(layout.panes.map(p=>p.rect.y)).size,2);
  assert.equal(layout.focused_pane_id,f.pane);
  const ids=(await f.api('pane','list')).panes.map(p=>p.terminal_id);
  const updateStart=performance.now();await writeFile(source+'.new','# Conditions\n\nLIVE_RAIN');await rename(source+'.new',source);
  await visible(conditions.pane,/LIVE_RAIN/);const liveUpdateMs=performance.now()-updateStart;
  const gatherStart=performance.now();await call('gather_views');
  assert.equal((await f.api('pane','layout','--pane',f.pane)).layout.zoomed,true);const gatherMs=performance.now()-gatherStart;
  assert.deepEqual((await f.api('pane','list')).panes.map(p=>p.terminal_id),ids);
  registry=load();assert.equal((await registry.list(f.dir)).length,3);
  await call('show_view',{id:plan.id,content:'# Saturday\n\nINDOORS_ONLY'});await visible(plan.pane,/INDOORS_ONLY/);
  assert.equal((await f.api('pane','layout','--pane',f.pane)).layout.zoomed,false);
  assert.deepEqual((await f.api('pane','list')).panes.map(p=>p.terminal_id),ids);
  await call('dismiss_view',{id:conditions.id});assert.equal((await f.api('pane','list')).panes.length,3);
  assert.match(await readFile(source,'utf8'),/LIVE_RAIN/);
  const reopened=(await call('show_view',{id:conditions.id})).details;await visible(reopened.pane,/LIVE_RAIN/);
  await call('show_view',{id:conditions.id,content:'# Snapshot\n\nSAVED_SNAPSHOT'});await visible(reopened.pane,/SAVED_SNAPSHOT/);
  assert.match(await readFile(source,'utf8'),/LIVE_RAIN/,'Editing a view must not overwrite its external source');
  await rm(source);await call('show_view',{id:conditions.id,path:plan.file});await visible(reopened.pane,/INDOORS_ONLY/);
  await commands.get('gather').handler();await commands.get('spread').handler();
  assert.equal((await f.api('pane','layout','--pane',f.pane)).layout.zoomed,false);
  // Losing a source is visible, and restoring it revives the same display.
  await rm(plan.file);await visible(plan.pane,/Source unavailable/);
  await writeFile(plan.file,'# Recovered\n\nRECOVERED_CONTENT');await visible(plan.pane,/RECOVERED_CONTENT/);
  // A killed display can be reopened without relying on its damaged terminal modes.
  const info=(await f.api('pane','process-info','--pane',memory.pane)).process_info;
  const viewer=info.foreground_processes.find(p=>p.pid!==info.shell_pid);assert.ok(viewer);process.kill(viewer.pid,'SIGKILL');
  await until(async()=>{const i=(await f.api('pane','process-info','--pane',memory.pane)).process_info;assert.ok(i.foreground_processes.every(p=>p.pid===i.shell_pid));});
  const revived=(await call('show_view',{id:memory.id})).details;assert.notEqual(revived.pane,memory.pane);await visible(revived.pane,/SILVER_BEACON/);
  // A user can leave the viewer and repurpose that pane. Dismiss must protect it.
  await f.raw('pane','send-keys',revived.pane,'ctrl+c');
  await until(async()=>{const i=(await f.api('pane','process-info','--pane',revived.pane)).process_info;assert.ok(i.foreground_processes.every(p=>p.pid===i.shell_pid));});
  await f.raw('pane','run',revived.pane,'sleep 60');
  await until(async()=>assert.ok((await f.api('pane','process-info','--pane',revived.pane)).process_info.foreground_processes.some(p=>p.name==='sleep')));
  await assert.rejects(call('dismiss_view',{id:memory.id}),/Other work was left intact/);
  const again=(await call('show_view',{id:memory.id})).details;assert.notEqual(again.pane,revived.pane);await visible(again.pane,/SILVER_BEACON/);
  assert.ok((await f.api('pane','process-info','--pane',revived.pane)).process_info.foreground_processes.some(p=>p.name==='sleep'));
  await call('dismiss_view',{id:conditions.id,discard:true});assert.ok(!(await registry.list(f.dir)).some(v=>v.id===conditions.id));
  assert.match(await readFile(plan.file,'utf8'),/RECOVERED_CONTENT/,'Discarding a view never deletes an external source');
  await call('dismiss_view',{id:memory.id,discard:true});await assert.rejects(readFile(memory.file));
  // A submitted launch is not success until the actual renderer acknowledges it.
  suppressLaunch=true;
  await assert.rejects(call('show_view',{title:'Unconfirmed',content:'RETAIN_AFTER_TIMEOUT'}),/startup is unconfirmed/);
  const uncertain=(await registry.list(f.dir)).find(v=>v.title==='Unconfirmed');assert.ok(uncertain);
  const count=(await f.api('pane','list')).panes.length;
  await assert.rejects(call('show_view',{id:uncertain.id}),/no second display was started/);
  assert.equal((await f.api('pane','list')).panes.length,count);
  assert.match(await readFile(uncertain.file,'utf8'),/RETAIN_AFTER_TIMEOUT/);
  suppressLaunch=false;await f.api('pane','close',uncertain.pane);
  const confirmed=(await call('show_view',{id:uncertain.id})).details;await visible(confirmed.pane,/RETAIN_AFTER_TIMEOUT/);
  // Long sources start at the top and use Pi's own viewport scrolling.
  await call('show_view',{id:confirmed.id,content:'# START_OF_DOCUMENT\n\n'+Array.from({length:60},(_,i)=>'Line '+i+'\n').join('')+'\nEND_OF_DOCUMENT'});
  await f.raw('pane','zoom',confirmed.pane,'--on');
  await until(async()=>assert.match(await f.raw('pane','read',confirmed.pane,'--source','visible'),/START_OF_DOCUMENT/));
  await f.raw('pane','send-text',confirmed.pane,'\u001b[6~\u001b[6~');
  await until(async()=>assert.match(await f.raw('pane','read',confirmed.pane,'--source','visible'),/END_OF_DOCUMENT/));
  if(process.env.TMAX_BENCH)console.log('VIEW_BENCHMARK '+JSON.stringify({terminal,firstViewMs,liveUpdateMs,gatherMs,modelCalls:0}));
 }finally{process.env=env;process.argv[1]=argv;await f.close();}
});
