import {createHash} from 'node:crypto';
// Real workspace operations, no inference. Run: node benchmarks/local.mjs [report.json]
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fixture,exec,until} from '../tests/herdr.mjs';
const require=createRequire(realpathSync((await exec('which',['pi'])).stdout.trim()));
const {createJiti}=require('jiti');
const {default:extension}=await createJiti(import.meta.url,{alias:{typebox:require.resolve('typebox'),'@earendil-works/pi-tui':require.resolve('@earendil-works/pi-tui')}}).import(resolve('internal/launcher/extension.ts'));
const results=[];
for(const terminal of ['Apple_Terminal','ghostty'])for(let repetition=0;repetition<Number(process.env.TMAX_REPEATS||5);repetition++){
 const f=await fixture(terminal),prior={...process.env};Object.assign(process.env,f.paneEnv);
 const tools=new Map();let cliMs=0,cliCalls=0;
 extension({registerFlag(){},getFlag(){},on(){},registerTool:t=>tools.set(t.name,t),registerCommand(){},exec:async(bin,args,options)=>{
  const start=performance.now();try{return {...await exec(bin,args,{env:f.paneEnv,timeout:35000,signal:options?.signal}),code:0};}
  catch(e){return {stdout:e.stdout,stderr:e.stderr,code:e.code};}finally{cliMs+=performance.now()-start;cliCalls++;}
 }});
 const call=async args=>(await tools.get('workspace').execute('bench',{args})).content[0].text;
 const api=async args=>JSON.parse(await call(args)).result;
 const split=async(id,direction)=>(await api(['pane','split',id,'--direction',direction,'--cwd',f.dir,'--no-focus'])).pane.pane_id;
 const layout=async()=>(await f.api('pane','layout','--pane',f.pane)).layout;
 const grid=async()=>{const p=await split(f.pane,'right');await split(f.pane,'down');await split(p,'down');};
 const checkGrid=async()=>{const l=await layout();assert.equal(l.panes.length,4);assert.equal(new Set(l.panes.map(p=>p.rect.x)).size,2);assert.equal(new Set(l.panes.map(p=>p.rect.y)).size,2);assert.equal(l.focused_pane_id,f.pane);};
 async function measure(id,action,verify){cliMs=0;cliCalls=0;const start=performance.now();let status='pass',error;
  try{await action();await verify();}catch(e){status='fail';error=e.message;}
  results.push({id,terminal,repetition,status,error,elapsedMs:performance.now()-start,cliMs,cliCalls});
 }
 try{
  let p,q;
  await measure('W01 inspect',()=>api(['pane','list']),async()=>assert.equal((await f.api('pane','list')).panes.length,1));
  await measure('W02 open beside',async()=>p=await split(f.pane,'right'),async()=>{const l=await layout();assert.equal(l.panes.length,2);assert.equal(l.focused_pane_id,f.pane);assert.equal((await f.api('pane','get',p)).pane.cwd,realpathSync(f.dir));});
  await measure('W03 open below',async()=>q=await split(p,'down'),async()=>{const l=await layout();assert.equal(l.panes.length,3);assert.ok(l.panes.find(x=>x.pane_id===q).rect.y>l.panes.find(x=>x.pane_id===p).rect.y);});
  await f.api('pane','close',q);await f.api('pane','close',p);
  await measure('W04 grid',grid,checkGrid);
  await measure('W05 inspect existing grid',()=>api(['pane','layout','--current']),checkGrid);
  p=(await layout()).panes.find(x=>x.pane_id!==f.pane).pane_id;
  await measure('W06 rename',()=>api(['pane','rename',p,'notes']),async()=>assert.match(JSON.stringify(await f.api('pane','get',p)),/notes/));
  await measure('W07 focus',()=>api(['pane','focus','--pane',f.pane,'--direction','right']),async()=>assert.notEqual((await layout()).focused_pane_id,f.pane));
  await measure('W08 enlarge',()=>api(['pane','zoom',p,'--on']),async()=>assert.equal((await layout()).zoomed,true));
  await measure('W09 restore',()=>api(['pane','zoom',p,'--off']),async()=>assert.equal((await layout()).zoomed,false));
  let old=JSON.stringify((await layout()).panes.map(x=>x.rect));
  await measure('W10 resize',()=>api(['pane','resize','--pane',f.pane,'--direction','right','--amount','0.1']),async()=>assert.notEqual(JSON.stringify((await layout()).panes.map(x=>x.rect)),old));
  const rect=(await layout()).panes.find(x=>x.pane_id===p).rect;
  await measure('W11 swap',()=>api(['pane','swap','--source-pane',f.pane,'--target-pane',p]),async()=>assert.deepEqual((await layout()).panes.find(x=>x.pane_id===f.pane).rect,rect));
  await measure('W12 start display',()=>call(['pane','run',p,'printf "\\nDISPLAY_READY\\n"; sleep 60']),()=>until(async()=>assert.match(await f.raw('pane','read',p),/^DISPLAY_READY$/m)));
  await measure('W13 read display',()=>call(['pane','read',p]),async()=>assert.match(await f.raw('pane','read',p),/^DISPLAY_READY$/m));
  await measure('W14 interrupt display',()=>call(['pane','send-keys',p,'ctrl+c']),async()=>{await f.raw('pane','run',p,'printf "\\nSTOP_CONFIRMED\\n"');await until(async()=>assert.match(await f.raw('pane','read',p),/^STOP_CONFIRMED$/m));});
  await measure('W15 close',()=>api(['pane','close',p]),async()=>assert.ok(!(await f.api('pane','list')).panes.some(x=>x.pane_id===p)));
  await measure('W16 bounded wait',()=>assert.rejects(call(['pane','wait-output',f.pane,'--match','NOT_PRESENT_82912','--timeout','50']),/timeout/),async()=>assert.ok((await f.api('pane','get',f.pane)).pane));
 }finally{process.env=prior;await f.close();}
}
const report={herdr:(await exec('herdr',['--version'])).stdout.trim(),pi:(await exec('pi',['--version'])).stdout.trim(),sourceHashes:Object.fromEntries(await Promise.all(['internal/launcher/extension.ts','internal/launcher/handoff.ts','internal/launcher/grid.ts'].map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')]))),node:process.version,platform:process.platform,arch:process.arch,date:new Date().toISOString(),revision:(await exec('git',['rev-parse','HEAD'])).stdout.trim(),kind:'local-real-Herdr',results};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
for(const id of [...new Set(results.map(r=>r.id))]){const rows=results.filter(r=>r.id===id),times=rows.filter(r=>r.status==='pass').map(r=>r.elapsedMs).sort((a,b)=>a-b);console.log(JSON.stringify({id,pass:rows.filter(r=>r.status==='pass').length,total:rows.length,medianMs:times.length?(times[Math.floor((times.length-1)/2)]+times[Math.floor(times.length/2)])/2:undefined,errors:[...new Set(rows.filter(r=>r.error).map(r=>r.error))]}));}
if(results.some(r=>r.status==='fail'))process.exitCode=1;
