// Known-gap probe. Real processes, scripted provider; not model tool selection.
import {writeFile} from 'node:fs/promises';
import {fixture,delay} from '../tests/herdr.mjs';
import {rpc} from '../tests/rpc.mjs';
const f=await fixture(),p=rpc(f);let report;
try{
 await p.prompt('Please split this fixture check.');
 await p.waitFor(()=>p.messages.some(m=>m.role==='custom'&&m.customType==='tmax_results'));
 await p.waitFor(async()=>!(await p.request('get_state')).isStreaming);
 const before=p.messages.filter(m=>m.role==='custom'&&m.customType==='tmax_results').length;
 const pane=p.messages.find(m=>m.role==='toolResult'&&m.toolName==='split_work').details.pane;
 const start=Date.now();await p.prompt('Fixture followup');
 await p.waitFor(async()=>/^\s*SECOND_RESULT confirmed\.\s*$/m.test(await f.raw('pane','read',pane)));
 await delay(1500);
 const after=p.messages.filter(m=>m.role==='custom'&&m.customType==='tmax_results').length;
 report={date:new Date().toISOString(),id:'S07 mechanics',provider:'deterministic fixture',status:after>before?'pass':'fail',elapsedMs:Date.now()-start,helperFinished:true,automaticResultsBefore:before,automaticResultsAfter:after,reason:after>before?undefined:'The same helper answers a follow-up, but its second result does not automatically return.'};
}catch(e){report={date:new Date().toISOString(),id:'S07 mechanics',status:'fail',reason:e.message,conversation:p.messages,panel:await f.raw('pane','read','w1:p2').catch(String)};}finally{await p.close();await f.close();}
console.log(JSON.stringify(report));await writeFile(process.argv[2]||'benchmarks/results/followup.json',JSON.stringify(report,null,2)+'\n');
if(report.status!=='pass')process.exitCode=1;
