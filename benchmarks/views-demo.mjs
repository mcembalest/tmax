// Real Pi TUI + Herdr client, recorded through a PTY. No native app screenshot.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fixture,exec,until,delay} from '../tests/herdr.mjs';
if(process.env.TMAX_LIVE!=='1')throw new Error('Set TMAX_LIVE=1 to use model quota.');
const out=resolve(process.argv[2]||'/tmp/tmax-views-demo');await mkdir(out,{recursive:true});
const f=await fixture(process.env.TMAX_TERMINAL||'Apple_Terminal');
const session=join(f.dir,'demo.jsonl'),steps=[];let recording;
const notes='# What we remembered\n\n_DEMO FIXTURE · earlier discussion_\n\n- A relaxed afternoon, close to home\n- £40 budget\n- Originally, home by 16:00\n';
try{
 const config=join(f.dir,'config.toml');await writeFile(config,'onboarding = false\n'+await readFile(config,'utf8')+'\n[ui]\nsidebar_start_collapsed = true\n');
 await f.raw('server','reload-config');
 await writeFile(join(f.dir,'notes.md'),notes);
 await writeFile(join(f.dir,'options.md'),'# Possibilities\n\n_DEMO FIXTURE · nearby places_\n\n| Place | Setting | Cost |\n| --- | --- | --- |\n| Garden | Outdoors | £0 |\n| Gallery | Indoors | £12 |\n| Café | Indoors | £8 |\n');
 await writeFile(join(f.dir,'plan.md'),'# Our afternoon\n\n_DEMO FIXTURE · developing plan_\n\n- **12:00** Garden\n- **14:00** Café\n- **16:00** Home\n');
 await f.raw('workspace','rename',f.paneEnv.HERDR_WORKSPACE_ID,'Afternoon');
 await f.raw('workspace','focus',f.paneEnv.HERDR_WORKSPACE_ID);
 // Only this isolated pane receives the fixture's private view directory.
 const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
 await f.raw('pane','run',f.pane,'export TMAX_VIEWS_DIR='+quote(join(f.dir,'saved')));
 await f.raw('agent','start','tmax','--kind','pi','--pane',f.pane,'--','--session',session,'--no-extensions','--no-context-files','--offline','-e',resolve('internal/launcher/extension.ts'),'-e',f.integration,'--provider',process.env.TMAX_TEST_PROVIDER||'openai-codex','--model',process.env.TMAX_TEST_MODEL||'gpt-5.6-luna','--thinking',process.env.TMAX_TEST_THINKING||'low');
 recording=spawn('uv',['run',resolve('benchmarks/record-pty.py'),join(out,'session.cast')],{env:{...f.env,TERM:'xterm-256color'},stdio:'inherit',detached:true});
 await until(async()=>assert.ok((await readFile(join(out,'session.cast'),'utf8')).split('\n').length>2));
 const started=Date.now();await delay(1000);
 for(const [name,prompt,count] of [
  ['1 → 2','Bring our earlier discussion in notes.md into view beside this conversation. Keep it there while we work.',2],
  ['2 → 4','Show the options and our afternoon plan alongside it, so I can see all three while we talk.',4],
  ['Change together','Actually, let’s stay indoors and be finished by three. Revise what needs to change.',4],
  ['4 → 1','Bring us back to just this conversation. Keep those views available for later.',4],
 ]){
  const start=Date.now();
  await exec('herdr',['agent','prompt',f.pane,prompt,'--wait','--timeout','90000'],{env:f.env,timeout:95000});
  assert.equal((await f.api('pane','list')).panes.length,count);
  const historyPreserved=await readFile(join(f.dir,'notes.md'),'utf8')===notes;
  if(!historyPreserved)process.exitCode=1;
  if(name==='4 → 1')assert.equal((await f.api('pane','layout','--pane',f.pane)).layout.zoomed,true);
  if(name==='Change together'){
   const plan=await readFile(join(f.dir,'plan.md'),'utf8');assert.match(plan,/15:00|3\s*(?:pm|p\.m\.)/i);assert.doesNotMatch(plan,/12:00\*?\*? Garden|16:00\*?\*? Home/);
  }
  steps.push({name,prompt,startMs:start-started,endMs:Date.now()-started,historyPreserved});console.log(JSON.stringify(steps.at(-1)));
  await delay(1500);
 }
 await writeFile(join(out,'steps.json'),JSON.stringify({kind:'Real Pi TUI and Herdr PTY recording; labeled planning fixture',herdr:(await exec('herdr',['--version'])).stdout.trim(),pi:(await exec('pi',['--version'])).stdout.trim(),model:process.env.TMAX_TEST_MODEL||'gpt-5.6-luna',thinking:process.env.TMAX_TEST_THINKING||'low',steps},null,2)+'\n');
}finally{
 if(recording&&recording.exitCode===null&&recording.signalCode===null){const stopped=new Promise(r=>recording.once('exit',r));process.kill(-recording.pid,'SIGTERM');await stopped;}
 await f.close();
}
