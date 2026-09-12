// Actual Pi file tools: reference protection must work even when a model asks
// to overwrite history. The fixture emits tool calls, not simulated file edits.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,symlink,link,rm} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {fixture,until} from './herdr.mjs';
import {rpc} from './rpc.mjs';
for(const terminal of ['Apple_Terminal','ghostty'])test(`${terminal}: Pi preserves reference sources while updating a working plan`,async()=>{
 const f=await fixture(terminal);f.paneEnv.TMAX_VIEWS_DIR=join(f.dir,'saved');let p=rpc(f);
 const source=join(f.dir,'a73 previous.md'),working=join(f.dir,'b29 current.md');
 const original='# Earlier discussion\n\nOriginally we aimed to finish by 16:00.\n';
 const action=async(...calls)=>{const offset=p.messages.length;await p.prompt(JSON.stringify({fixtureTools:calls}));return p.messages.slice(offset).filter(m=>m.role==='toolResult');};
 const call=(name,args)=>({name,arguments:args});
 try{
  await writeFile(source,original);await writeFile(working,'# Current plan\n\nFinish at 16:00.\n');await p.request('get_state');
  const [a,b]=await action(call('recall_view',{title:'Earlier discussion',path:source}),call('show_view',{title:'Current plan',path:working}));
  assert.ok(!a.isError&&!b.isError,JSON.stringify([a,b]));assert.equal(a.details.historical,true);assert.equal(b.details.historical,false);
  const panes=(await f.api('pane','list')).panes.map(x=>x.terminal_id);
  const start=performance.now();
  const edits=await action(call('edit',{path:source,edits:[{oldText:'16:00',newText:'15:00'}]}),call('edit',{path:working,edits:[{oldText:'16:00',newText:'15:00'}]}));
  assert.equal(edits[0].isError,true);assert.match(JSON.stringify(edits[0].content),/recorded history/);assert.ok(!edits[1].isError);
  assert.equal(await readFile(source,'utf8'),original);assert.match(await readFile(working,'utf8'),/15:00/);
  await until(async()=>assert.match(await f.raw('pane','read',b.details.pane,'--source','visible'),/15:00/));
  assert.deepEqual((await f.api('pane','list')).panes.map(x=>x.terminal_id),panes);
  const guardedUpdateMs=performance.now()-start;
  // Neither an alternate file spelling nor changing the view can erase history.
  await symlink(source,join(f.dir,'alias.md'));await link(source,join(f.dir,'hardlink.md'));
  for(const path of ['a73 previous.md','@a73 previous.md','a73\u00a0previous.md','alias.md','hardlink.md',pathToFileURL(source).href,'~/'+relative(homedir(),source)]){
   const [result]=await action(call('write',{path,content:'CHANGED_HISTORY'}));assert.equal(result.isError,true,path);assert.equal(await readFile(source,'utf8'),original);
  }
  for(const args of [{id:a.details.id,content:'CHANGED_HISTORY'},{id:a.details.id,path:working},{title:'Another label',path:source}]){
   const [result]=await action(call('show_view',args));assert.equal(result.isError,true,JSON.stringify(args));
  }
  // A new interpretation is ordinary editable content; the historical view stays.
  const [derived]=await action(call('show_view',{title:'Current interpretation',content:'Finish at 15:00.'}));assert.ok(!derived.isError);
  assert.equal(await readFile(source,'utf8'),original);
  await action(call('dismiss_view',{id:a.details.id}));await p.close();p=rpc(f);await p.request('get_state');
  const [afterRestart]=await action(call('write',{path:source,content:'CHANGED_AFTER_RESTART'}));assert.equal(afterRestart.isError,true);
  const [reopened]=await action(call('show_view',{id:a.details.id}));assert.ok(!reopened.isError);assert.equal(reopened.details.historical,true);
  await until(async()=>assert.match(await f.raw('pane','read',reopened.details.pane,'--source','visible'),/16:00/));
  // A missing reference cannot be silently replaced by a new decision either.
  await rm(source);const [missing]=await action(call('write',{path:source,content:'REPLACEMENT_HISTORY'}));assert.equal(missing.isError,true);await assert.rejects(readFile(source));
  await writeFile(source,original);await until(async()=>assert.match(await f.raw('pane','read',reopened.details.pane,'--source','visible'),/16:00/));
  // Older saved documents remain editable until recalled; recall never downgrades.
  const record=derived.details.file.replace(/\.md$/,'.json'),legacy=JSON.parse(await readFile(record,'utf8'));delete legacy.historical;await writeFile(record,JSON.stringify(legacy));
  const [revised]=await action(call('show_view',{id:derived.details.id,content:'The decision we made at 15:00.'}));assert.ok(!revised.isError);
  const [recalled]=await action(call('recall_view',{id:derived.details.id}));assert.equal(recalled.details.historical,true);
  const [overwrite]=await action(call('write',{path:recalled.details.file,content:'CHANGED_OWNED_HISTORY'}));assert.equal(overwrite.isError,true);
  const [downgrade]=await action(call('show_view',{id:recalled.details.id,content:'CHANGED_OWNED_HISTORY'}));assert.equal(downgrade.isError,true);
  if(process.env.TMAX_BENCH)console.log('REFERENCE_BENCHMARK '+JSON.stringify({terminal,guardedUpdateMs,modelCalls:0,transport:'Pi RPC, deterministic tool calls'}));
 }finally{await p.close();await f.close();}
});
