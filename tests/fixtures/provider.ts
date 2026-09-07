// Deterministic test provider: exercises Pi's real loop without a model service.
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai/compat';
export default function(pi) {
 pi.registerProvider('tmax-test', {
  baseUrl:'http://unused.invalid',apiKey:'test',api:'tmax-test',
  models:[{id:'fixture',name:'Fixture',reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:100000,maxTokens:1000}],
  streamSimple(model,context) {
   const stream=createAssistantMessageEventStream();
   (async()=>{
    const last=context.messages.at(-1);
    const child=process.argv.includes('--tmax-task');
    if(child)await new Promise(r=>setTimeout(r,3000));
    const split=!child&&last.role==='user'&&JSON.stringify(last.content).includes('Please split');
    const content=split?[{type:'toolCall',id:'split-1',name:'split_work',arguments:{task:'Inspect the fixture and report RIVERSTONE.',context:JSON.stringify(last.content).includes('fork context')?'fork':'fresh'}}]:[{type:'text',text:child?'RIVERSTONE checked.':JSON.stringify(last).includes('Helper results returned')?'Received RIVERSTONE.':'42; conversation available.'}];
    const message={role:'assistant',api:model.api,provider:model.provider,model:model.id,content,stopReason:split?'toolUse':'stop',timestamp:Date.now(),usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}};
    stream.push({type:'start',partial:message});
    stream.push({type:'done',reason:message.stopReason,message});stream.end();
   })();
   return stream;
  }
 });
}
