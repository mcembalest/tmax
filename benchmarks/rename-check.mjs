// Clarification diagnostic for S09; does not replace its original failures.
import {writeFile} from 'node:fs/promises';
import {fixture} from '../tests/herdr.mjs';
import {rpc} from '../tests/rpc.mjs';
if(process.env.TMAX_LIVE!=='1')throw new Error('Set TMAX_LIVE=1 to use model quota');
const results=[];
for(const label of ['copy work','team swarm','roles and workers']){
 const f=await fixture(),p=rpc(f,{live:true});
 try{
  const target=(await f.api('pane','split',f.pane,'--direction','right','--cwd',f.dir,'--no-focus')).pane.pane_id;
  await f.api('pane','rename',target,'scratch');await p.request('get_state');
  const prompt=`Rename the panel named scratch to "${label}".`,start=Date.now();await p.prompt(prompt);
  const actual=(await f.api('pane','get',target)).pane.label,panes=(await f.api('pane','list')).panes;
  results.push({label,prompt,status:actual===label&&panes.length===2&&!panes.some(x=>x.pane_id!==f.pane&&x.agent==='pi')?'pass':'fail',actual,totalMs:Date.now()-start,calls:p.messages.flatMap(m=>Array.isArray(m.content)?m.content.filter(x=>x.type==='toolCall'):[])});
 }finally{await p.close();await f.close();}
}
console.log(JSON.stringify(results));await writeFile('benchmarks/results/rename-clarification.json',JSON.stringify({date:new Date().toISOString(),provider:'openai-codex',model:process.env.TMAX_TEST_MODEL||'gpt-5.6-luna',thinking:process.env.TMAX_TEST_THINKING||'medium',results},null,2)+'\n');
if(results.some(r=>r.status!=='pass'))process.exitCode=1;
