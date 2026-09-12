import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fixture,delay} from './herdr.mjs';
import {rpc} from './rpc.mjs';
for(const terminal of ['Apple_Terminal','ghostty'])test(`${terminal}: pending helper returns after parent process restart without duplicate delivery`,{timeout:45000},async()=>{
 const f=await fixture(terminal);let parent=rpc(f);
 try{
  await writeFile(join(f.dir,'.fixture-delay'),'5000');
  await parent.prompt('Please split this fixture check with fork context.');
  assert.ok(parent.messages.some(m=>m.role==='toolResult'&&m.toolName==='split_work'&&!m.isError),JSON.stringify(parent.messages));
  const before=(await parent.request('get_state')).sessionId;
  await parent.close();parent=rpc(f);
  assert.equal((await parent.request('get_state')).sessionId,before);
  await parent.waitFor(()=>parent.messages.some(m=>m.role==='custom'&&m.customType==='tmax_results'));
  await parent.waitFor(async()=>!(await parent.request('get_state')).isStreaming);
  assert.match(JSON.stringify(parent.messages),/RIVERSTONE checked/);
  await parent.close();parent=rpc(f);await parent.request('get_state');await delay(1500);
  assert.equal(parent.messages.filter(m=>m.role==='custom'&&m.customType==='tmax_results').length,0);
  assert.equal((await f.api('pane','list')).panes.length,2);
 }finally{await parent.close();await f.close();}
});
test('closing a real helper mid-turn returns incomplete work and preserves the parent',{timeout:35000},async()=>{
 const f=await fixture(),parent=rpc(f);
 try{
  await writeFile(join(f.dir,'.fixture-delay'),'10000');
  await parent.prompt('Please split this fixture check.');
  const tool=parent.messages.find(m=>m.role==='toolResult'&&m.toolName==='split_work'&&!m.isError);assert.ok(tool,JSON.stringify(parent.messages));
  await f.api('pane','close',tool.details.pane);
  await parent.waitFor(()=>parent.messages.some(m=>m.role==='custom'&&m.customType==='tmax_results'));
  const result=parent.messages.find(m=>m.role==='custom'&&m.customType==='tmax_results');assert.match(result.content,/"status":"interrupted"/);
  assert.equal((await f.api('pane','list')).panes.length,1);
 }finally{await parent.close();await f.close();}
});
test('a real helper returns a follow-up without creating another pane',{timeout:35000},async()=>{
 const f=await fixture(),parent=rpc(f);
 try{
  await parent.prompt('Please split this fixture check.');
  const returns=()=>parent.messages.filter(m=>m.role==='custom'&&m.customType==='tmax_results');
  await parent.waitFor(()=>returns().length===1);
  await parent.waitFor(async()=>!(await parent.request('get_state')).isStreaming);
  const before=(await f.api('pane','list')).panes.map(p=>p.terminal_id);
  await parent.prompt('Fixture followup');
  await parent.waitFor(()=>returns().length===2);
  assert.match(returns()[1].content,/SECOND_RESULT confirmed/);
  assert.deepEqual((await f.api('pane','list')).panes.map(p=>p.terminal_id),before);
 }finally{await parent.close();await f.close();}
});
