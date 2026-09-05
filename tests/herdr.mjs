import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export const exec = promisify(execFile);
export const delay = ms => new Promise(r=>setTimeout(r,ms));
export async function until(action) {
  let error;
  for(let i=0;i<100;i++){try{return await action();}catch(e){error=e;await delay(100);}}
  throw error;
}
export async function fixture(terminal='Apple_Terminal') {
  const dir=await mkdtemp(join(tmpdir(),'tmax-herdr-'));
  const config=join(dir,'config.toml');
  await writeFile(config,'[terminal]\ndefault_shell = "/bin/sh"\nshell_mode = "non_login"\n[session]\nresume_agents_on_restore = false\n[update]\nmanifest_check = false\n');
  const env={...process.env,XDG_CONFIG_HOME:dir,HERDR_SESSION:'test',HERDR_CONFIG_PATH:config,TERM_PROGRAM:terminal};
  delete env.HERDR_SOCKET_PATH;delete env.HERDR_PANE_ID;delete env.HERDR_ENV;
  const raw=async(...args)=>(await exec('herdr',args,{env,timeout:40000})).stdout.trim();
  const api=async(...args)=>JSON.parse(await raw(...args)).result;
  const server=spawn('herdr',['server'],{env,cwd:dir,stdio:'ignore'});
  await until(()=>api('api','snapshot'));
  const created=await api('workspace','create','--cwd',dir,'--no-focus');
  const pane=created.root_pane.pane_id;
  const paneEnv={...env,HERDR_ENV:'1',HERDR_SOCKET_PATH:join(dir,'herdr','sessions','test','herdr.sock'),HERDR_PANE_ID:pane,HERDR_WORKSPACE_ID:created.workspace.workspace_id};
  const integrationDir=join(dir,'pi');await mkdir(join(integrationDir,'extensions'),{recursive:true});
  await exec('herdr',['integration','install','pi'],{env:{...env,PI_CODING_AGENT_DIR:integrationDir}});
  return {dir,env,paneEnv,pane,raw,api,integration:join(integrationDir,'extensions','herdr-agent-state.ts'),
    async close(){await raw('server','stop').catch(()=>{});server.kill();await rm(dir,{recursive:true,force:true});}};
}
