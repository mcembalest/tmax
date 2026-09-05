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
for(const terminal of ['Apple_Terminal','ghostty'])test(`${terminal}: launch, concurrent return, quit, reload, crash and relaunch`,{timeout:120000},async()=>{
 const dir=await mkdtemp('/tmp/tmax-launch-');
 const tools=join(dir,'tools');await mkdir(tools);
 await writeFile(join(tools,'herdr'),'#!/bin/sh\nif [ "$1" = --session ]; then exec "$TEST_HERDR_REAL" api snapshot; fi\nexec "$TEST_HERDR_REAL" "$@"\n',{mode:0o700});
 const project=join(dir,"project with 'quotes'");await mkdir(project);
 // Make a model selectable without invoking it; login dialogs are a separate flow.
 const env={...process.env,HOME:dir,XDG_CONFIG_HOME:dir,PATH:tools+':'+process.env.PATH,TEST_HERDR_REAL:real,TERM_PROGRAM:terminal};
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
  const recovered=await launch('--offline','--no-session'); assert.equal(recovered.panes.length,4); pane=recovered.agents[0].pane_id; await api('agent','send-keys',pane,'ctrl+c'); await delay(600);
  await api('agent','prompt',pane,'/close-workspace');
  await until(async()=>assert.equal((await api('workspace','list')).workspaces.length,0));
 }finally{
  if(session)await exec(real,['server','stop'],{env:{...env,HERDR_SESSION:session}}).catch(()=>{});
  else {const s=JSON.parse((await exec(real,['session','list','--json'],{env})).stdout);for(const x of s.sessions||[])await exec(real,['session','stop',x.name],{env}).catch(()=>{});}
  await rm(dir,{recursive:true,force:true});
 }
});
test.after(async()=>rm(build,{recursive:true,force:true}));
