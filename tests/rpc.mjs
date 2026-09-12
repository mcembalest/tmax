// Shared test transport for Pi's existing RPC mode; not an agent implementation.
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {delay} from './herdr.mjs';
export function rpc(f,{session=resolve(f.dir,'parent.jsonl'),live=false,extension=resolve('internal/launcher/extension.ts')}={}){
 const args=['--mode','rpc','--session',session,'--no-extensions','--no-context-files','--offline','-e',extension,'-e',f.integration];
 if(live)args.push('--provider',process.env.TMAX_TEST_PROVIDER||'openai-codex','--model',process.env.TMAX_TEST_MODEL||'gpt-5.6-luna','--thinking',process.env.TMAX_TEST_THINKING||'medium');
 else args.push('-e',resolve('tests/fixtures/provider.ts'),'--provider','tmax-test','--model','fixture');
 const child=spawn('pi',args,{cwd:f.dir,env:f.paneEnv,stdio:['pipe','pipe','pipe']});
 const events=[],messages=[],pending=new Map();let buffer='',errors='',next=0;
 child.stderr.on('data',d=>errors+=d);
 child.stdout.on('data',d=>{buffer+=d;while(buffer.includes('\n')){
  const i=buffer.indexOf('\n'),line=buffer.slice(0,i);buffer=buffer.slice(i+1);let e;try{e=JSON.parse(line);}catch{continue;}
  events.push({...e,at:Date.now()});if(e.type==='message_end')messages.push(e.message);
  if(e.type==='response'&&pending.has(e.id)){const p=pending.get(e.id);pending.delete(e.id);clearTimeout(p.timer);e.success?p.resolve(e.data):p.reject(new Error(JSON.stringify(e)));}
 }});
 const rejectAll=error=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}pending.clear();};
 child.on('error',rejectAll);child.on('exit',code=>rejectAll(new Error(`Pi exited ${code}: ${errors}`)));
 const request=(type,extra={})=>new Promise((resolve,reject)=>{const id=String(++next),timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Pi RPC ${type} timed out: ${errors}`));},90000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,type,...extra})+'\n');});
 const waitFor=async(predicate,timeout=20000)=>{const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await predicate())return;const error=messages.find(m=>m.role==='assistant'&&m.stopReason==='error');if(error)throw new Error(error.errorMessage||'Model error');if(child.exitCode!==null||child.signalCode!==null)throw new Error('Pi exited: '+errors);await delay(25);}throw new Error('Pi observation timed out: '+errors);};
 return {child,events,messages,request,waitFor,
  async prompt(message){const offset=events.length;await request('prompt',{message});await waitFor(()=>events.slice(offset).some(e=>e.type==='agent_end'),90000);const error=messages.at(-1);if(error?.stopReason==='error')throw new Error(error.errorMessage);},
  async close(){if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');for(let i=0;i<100&&child.exitCode===null&&child.signalCode===null;i++)await delay(25);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}rejectAll(new Error('RPC closed'));}
 };
}
