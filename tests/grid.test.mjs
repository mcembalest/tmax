import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {fixture,exec} from './herdr.mjs';
import {rpc} from './rpc.mjs';
const require=createRequire(realpathSync((await exec('which',['pi'])).stdout.trim()));
const {createJiti}=require('jiti');
const {default:grids}=await createJiti(import.meta.url,{alias:{typebox:require.resolve('typebox')}}).import(process.env.TMAX_GRID_SOURCE||resolve('internal/launcher/grid.ts'));
for(const terminal of ['Apple_Terminal','ghostty'])test(`${terminal}: grid shapes preserve terminals, focus and idempotence`,async()=>{
 for(const [rows,columns] of [[1,2],[2,1],[2,2],[2,3],[3,2],[3,3],[4,4]]){
  const f=await fixture(terminal);let tool;
  grids({registerTool:t=>tool=t,registerCommand:()=>{}},async args=>(await exec('herdr',args,{env:f.paneEnv})).stdout);
  const run=()=>tool.execute('grid',{rows,columns},undefined,undefined,{cwd:f.dir});
  try{
   const original=(await f.api('pane','get',f.pane)).pane.terminal_id;
   await run();const l=(await f.api('pane','layout','--pane',f.pane)).layout;
   assert.equal(l.panes.length,rows*columns);assert.equal(new Set(l.panes.map(p=>p.rect.x)).size,columns);assert.equal(new Set(l.panes.map(p=>p.rect.y)).size,rows);assert.equal(l.focused_pane_id,f.pane);
   const ids=(await f.api('pane','list')).panes.map(p=>p.terminal_id);await run();assert.deepEqual((await f.api('pane','list')).panes.map(p=>p.terminal_id),ids);assert.ok(ids.includes(original));
  }finally{await f.close();}
 }
});
for(const terminal of ['Apple_Terminal','ghostty'])test(`${terminal}: /grid completes through Pi without a model turn`,async()=>{
 const f=await fixture(terminal),p=rpc(f),samples=[];
 try{
  await p.request('get_state');
  const original=(await f.api('pane','get',f.pane)).pane.terminal_id;
  for(let i=0;i<5;i++){
   const start=performance.now();
   await p.request('prompt',{message:'/grid'});
   const layout=(await f.api('pane','layout','--pane',f.pane)).layout;
   const elapsedMs=performance.now()-start;samples.push(elapsedMs);
   assert.equal(layout.panes.length,4);assert.equal(new Set(layout.panes.map(p=>p.rect.x)).size,2);assert.equal(new Set(layout.panes.map(p=>p.rect.y)).size,2);
   assert.equal(layout.focused_pane_id,f.pane);assert.ok(elapsedMs<2000,`Grid took ${elapsedMs} ms`);
   const ids=(await f.api('pane','list')).panes.map(p=>p.terminal_id);
   await p.request('prompt',{message:'/grid'});
   await p.request('prompt',{message:'/grid 0 99'});
   assert.deepEqual((await f.api('pane','list')).panes.map(p=>p.terminal_id),ids);
   for(const pane of layout.panes)if(pane.pane_id!==f.pane)await f.api('pane','close',pane.pane_id);
  }
  await p.request('prompt',{message:'/grid 2 3'});
  assert.equal((await f.api('pane','layout','--pane',f.pane)).layout.panes.length,6);
  assert.equal((await f.api('pane','get',f.pane)).pane.terminal_id,original);
  assert.equal(p.events.filter(e=>e.type==='agent_start'||e.type==='tool_execution_start').length,0);
  assert.equal(p.messages.filter(m=>m.role==='assistant').length,0);
  if(process.env.TMAX_BENCH)console.log('GRID_COMMAND_BENCHMARK '+JSON.stringify({terminal,samplesMs:samples,modelTurns:0}));
 }finally{await p.close();await f.close();}
});
test('partial grid retains a running display; incompatible layout is rejected without mutations',async()=>{
 const f=await fixture();let tool;
 grids({registerTool:t=>tool=t,registerCommand:()=>{}},async args=>(await exec('herdr',args,{env:f.paneEnv})).stdout);
 try{
  const p=(await f.api('pane','split',f.pane,'--direction','right','--cwd',f.dir,'--no-focus')).pane;
  await f.raw('pane','run',p.pane_id,'printf GRID_DISPLAY; sleep 60');
  await tool.execute('grid',{rows:2,columns:2},undefined,undefined,{cwd:f.dir});
  assert.match(await f.raw('pane','read',p.pane_id),/GRID_DISPLAY/);assert.equal((await f.api('pane','get',p.pane_id)).pane.terminal_id,p.terminal_id);
  const before=(await f.api('pane','list')).panes.map(p=>p.terminal_id);
  await assert.rejects(tool.execute('grid',{rows:3,columns:3},undefined,undefined,{cwd:f.dir}),/align/);
  assert.deepEqual((await f.api('pane','list')).panes.map(p=>p.terminal_id),before);
 }finally{await f.close();}
});
