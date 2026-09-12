// Deterministic test provider: exercises Pi's real loop without a model service.
import {readFile} from 'node:fs/promises';
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai/compat';
export default function(pi) {
 pi.registerProvider('tmax-test', {
  baseUrl:'http://unused.invalid',apiKey:'test',api:'tmax-test',
  models:[{id:'fixture',name:'Fixture',reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:100000,maxTokens:1000}],
  streamSimple(model,context) {
   const stream=createAssistantMessageEventStream();
   (async()=>{
    const last=context.messages.filter(m=>!JSON.stringify(m.content).includes('Current live terminal workspace')).at(-1);
    const child=process.argv.includes('--tmax-task');
    if(child){const wait=Number(await readFile('.fixture-delay','utf8').catch(()=>3000));await new Promise(r=>setTimeout(r,wait));}
    const split=!child&&last.role==='user'&&JSON.stringify(last.content).includes('Please split');
    const show=!child&&last.role==='user'&&JSON.stringify(last.content).includes('Fixture show view');
    const followup=!child&&last.role==='user'&&JSON.stringify(last.content).includes('Fixture followup');
    const first=context.messages.find(m=>m.role==='toolResult'&&m.toolName==='split_work');
    let scripted;
    if(!child&&last.role==='user')try{scripted=JSON.parse(typeof last.content==='string'?last.content:last.content.filter(c=>c.type==='text').map(c=>c.text).join('')).fixtureTools;}catch{}
    const content=followup?[{type:'toolCall',id:'followup-1',name:'split_work',arguments:{pane:first.details.pane,task:'Please report SECOND_RESULT.'}}]:split?[{type:'toolCall',id:'split-1',name:'split_work',arguments:{task:'Inspect the fixture and report RIVERSTONE.',context:JSON.stringify(last.content).includes('fork context')?'fork':'fresh'}}]:[{type:'text',text:child?(JSON.stringify(last.content).includes('SECOND_RESULT')?'SECOND_RESULT confirmed.':'RIVERSTONE checked.'):JSON.stringify(last).includes('Helper results returned')?'Received RIVERSTONE.':'42; conversation available.'}];
    if(show)content.splice(0,content.length,{type:'toolCall',id:'view-1',name:'show_view',arguments:{title:'Fixture view',content:'# Saved view\n\nEMBEDDED_RENDERER_WORKS'}});
    if(scripted)content.splice(0,content.length,...scripted.map((call,i)=>({type:'toolCall',id:`fixture-${Date.now()}-${i}`,...call})));
    const message={role:'assistant',api:model.api,provider:model.provider,model:model.id,content,stopReason:split||followup||show||scripted?'toolUse':'stop',timestamp:Date.now(),usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}};
    stream.push({type:'start',partial:message});
    stream.push({type:'done',reason:message.stopReason,message});stream.end();
   })();
   return stream;
  }
 });
}
