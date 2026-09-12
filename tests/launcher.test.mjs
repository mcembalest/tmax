// Real Herdr and Pi, with only the foreground attach replaced by a snapshot.
// This exercises terminal environments, not native app rendering.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {exec,until,delay} from './herdr.mjs';
const real=(await exec('which',['herdr'])).stdout.trim();
const build=await mkdtemp(join(tmpdir(),'tmax-build-'));
const binary=join(build,'tmax');
await exec('go',['build','-o',binary,'.']);
for(const terminal of ['Apple_Terminal','ghostty'])test(`${terminal}: launch, return, reload and recovery with surviving helpers`,{timeout:120000},async()=>{
 const dir=await mkdtemp('/tmp/tmax-launch-');
 const tools=join(dir,'tools');await mkdir(tools);
 await writeFile(join(tools,'herdr'),'#!/bin/sh\nif [ "$1" = --session ]; then exec "$TEST_HERDR_REAL" api snapshot; fi\nexec "$TEST_HERDR_REAL" "$@"\n',{mode:0o700});
 const project=join(dir,"project with 'quotes'");await mkdir(project);
 // Make a model selectable without invoking it; login dialogs are a separate flow.
 const env={...process.env,HOME:dir,XDG_CONFIG_HOME:dir,XDG_CACHE_HOME:join(dir,'cache'),PATH:tools+':'+process.env.PATH,TEST_HERDR_REAL:real,TERM_PROGRAM:terminal};
 for(const key of Object.keys(env))if(key.startsWith('HERDR_')||key.startsWith('TMAX_')||key.startsWith('TMUX'))delete env[key];
 // Preserve the same shell behavior in both headless environments.
 env.SHELL='/bin/sh';
 let phase='first launch';
 const launch=async(...args)=>{
  try{return JSON.parse((await exec(binary,args,{cwd:project,env,timeout:45000})).stdout).result.snapshot;}
  catch(error){error.message+='\nDuring '+phase+'\n'+await readFile(join(dir,'Library/Caches/tmax/herdr-server.log'),'utf8').catch(()=>'(no server log)');throw error;}
 };
 let session;
 const api=async(...args)=>JSON.parse((await exec(real,args,{env:{...env,HERDR_SESSION:session},timeout:40000})).stdout || '{}').result;
 try{
  const first=await launch('--offline','--no-session');
  assert.equal(first.agents.length,1);assert.equal(first.panes.length,1);
  assert.equal(first.panes[0].foreground_cwd,await realpath(project));
  let pane=first.agents[0].pane_id;
  const sessions=JSON.parse((await exec(real,['session','list','--json'],{env})).stdout);
  session=(Array.isArray(sessions)?sessions:sessions.sessions).find(s=>s.name.startsWith('tmax-')).name;
  phase='adopt an older launcher session';
  const mainFile=join(process.platform==='darwin'?join(dir,'Library','Caches'):env.XDG_CACHE_HOME,'tmax',session+'.main');
  assert.equal(await readFile(mainFile,'utf8'),first.agents[0].terminal_id);
  await rm(mainFile); // Existing live sessions predate the launcher's identity file.
  assert.equal((await launch()).agents[0].pane_id,pane);
  assert.equal(await readFile(mainFile,'utf8'),first.agents[0].terminal_id);
  phase='concurrent return';
  const [second,third]=await Promise.all([launch(),launch()]);
  assert.equal(second.agents[0].pane_id,pane);assert.equal(third.panes.length,1);
  await assert.rejects(launch('--resume'),/already has a running agent/);
  await api('agent','send-keys',pane,'ctrl+c'); await delay(600); await api('agent','prompt',pane,'/reload');
  await until(async()=>assert.match((await exec(real,['pane','read',pane],{env:{...env,HERDR_SESSION:session}})).stdout,/Reloaded keybindings/));
  await until(async()=>{const a=(await api('agent','get',pane)).agent;assert.ok(['idle','done'].includes(a.agent_status));});
  assert.equal((await launch()).agents[0].pane_id,pane);
  const extra=(await api('pane','split',pane,'--direction','right','--cwd',project,'--no-focus')).pane.pane_id;
  await api('pane','run',extra,'printf "%s\\n%s" "$TERM_PROGRAM" "$PWD" > context; printf KEEP_RUNNING; sleep 60');
  await until(async()=>assert.equal(await readFile(join(project,'context'),'utf8'),terminal+'\n'+await realpath(project)));
  await api('agent','send-keys',pane,'ctrl+c'); await delay(600); await api('agent','prompt',pane,'/quit');
  await until(async()=>assert.equal((await api('agent','list')).agents.length,0,(await exec(real,['pane','read',pane],{env:{...env,HERDR_SESSION:session}})).stdout));
  phase='after quit';
  const restarted=await launch('--offline','--no-session');assert.equal(restarted.agents.length,1);
  assert.equal(restarted.panes.length,3); pane=restarted.agents[0].pane_id;
  assert.match((await exec(real,['pane','read',extra],{env:{...env,HERDR_SESSION:session}})).stdout,/KEEP_RUNNING/);
  const info=(await api('pane','process-info','--pane',pane)).process_info;
  const agent=info.foreground_processes.find(p=>p.pid!==info.shell_pid);assert.ok(agent,JSON.stringify(info));
  process.kill(agent.pid,'SIGKILL');
  await until(async()=>assert.equal((await api('agent','list')).agents.length,0,(await exec(real,['pane','read',pane],{env:{...env,HERDR_SESSION:session}})).stdout));
  phase='after crash';
  const parentFile=join(dir,'parent.jsonl'),options=['--session',parentFile,'-e',resolve('tests/fixtures/provider.ts'),'--provider','tmax-test','--model','fixture'];
  const recovered=await launch(...options); assert.equal(recovered.panes.length,4); pane=recovered.agents[0].pane_id;
  // The actual handoff creates a separate Pi that outlives the main conversation.
  await writeFile(join(project,'.fixture-delay'),'60000');
  await api('agent','prompt',pane,'Please split this fixture check.','--wait');
  await until(async()=>assert.equal((await api('agent','list')).agents.length,2));
  const helper=(await api('agent','list')).agents.find(a=>a.pane_id!==pane).pane_id;
  const helperInfo=(await api('pane','process-info','--pane',helper)).process_info;
  const helperProcess=helperInfo.foreground_processes.find(p=>p.pid!==helperInfo.shell_pid);assert.ok(helperProcess);
  const kept=(await api('pane','list')).panes.map(p=>({id:p.pane_id,terminal:p.terminal_id}));
  await api('agent','rename',pane,'conversation');await api('agent','rename',helper,'tmax');
  await api('agent','focus',helper);
  assert.equal((await launch()).agents.length,2,'Renaming the main agent must not duplicate it');
  assert.equal((await api('pane','layout','--pane',helper)).layout.focused_pane_id,helper,'Reconnecting must preserve focus');
  await api('agent','focus',pane);
  for(const exit of ['quit','crash']){
   phase='main '+exit+' with surviving helper';
   if(exit==='quit'){await api('agent','send-keys',pane,'ctrl+c');await delay(600);await api('agent','prompt',pane,'/quit');}
   else{const info=(await api('pane','process-info','--pane',pane)).process_info;process.kill(info.foreground_processes.find(p=>p.pid!==info.shell_pid).pid,'SIGKILL');}
   await until(async()=>assert.deepEqual((await api('agent','list')).agents.map(a=>a.pane_id),[helper]));
   const start=performance.now();
   // Plain concurrent returns create one replacement; explicit Pi options work too.
   const returns=exit==='quit'?await Promise.all([launch(),launch()]):[await launch(...options)];
   for(const state of returns)assert.equal(state.agents.length,2,'A surviving helper must not prevent starting the main conversation');
   pane=returns[0].agents.find(a=>a.pane_id!==helper).pane_id;
   for(const state of returns)assert.equal(state.agents.find(a=>a.pane_id!==helper).pane_id,pane);
   assert.equal(returns[0].panes.find(p=>p.pane_id===pane).foreground_cwd,await realpath(project));
   assert.equal((await api('pane','layout','--pane',pane)).layout.focused_pane_id,pane);
   const current=(await api('pane','list')).panes;
   for(const old of kept)assert.equal(current.find(p=>p.pane_id===old.id)?.terminal_id,old.terminal,'Existing terminals must survive');
   process.kill(helperProcess.pid,0);
   assert.ok((await api('pane','process-info','--pane',helper)).process_info.foreground_processes.some(p=>p.pid===helperProcess.pid),'The original helper process must survive');
   if(process.env.TMAX_BENCH)console.log('REOPEN_BENCHMARK '+JSON.stringify({terminal,exit,elapsedMs:performance.now()-start,modelCalls:0,concurrent:returns.length}));
  }
  await api('agent','send-keys',pane,'ctrl+c');await delay(600);
  await api('agent','prompt',pane,'/close-workspace');
  await until(async()=>assert.equal((await api('workspace','list')).workspaces.length,0));
 }finally{
  if(session)await exec(real,['server','stop'],{env:{...env,HERDR_SESSION:session}}).catch(()=>{});
  else {const s=JSON.parse((await exec(real,['session','list','--json'],{env})).stdout);for(const x of s.sessions||[])await exec(real,['session','stop',x.name],{env}).catch(()=>{});}
  await rm(dir,{recursive:true,force:true});
 }
});
test.after(async()=>rm(build,{recursive:true,force:true}));
