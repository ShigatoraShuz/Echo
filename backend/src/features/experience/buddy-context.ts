import type {ChatTurn} from '../../infrastructure/analysis/core-client.js';
export function prepareBuddyContext(input:ChatTurn[]){
 const messages=input.map(m=>({...m}));
 if(!messages.length||messages.at(-1)?.role!=='user')throw Error('Latest user message required');
 const original=messages.length;
 while(messages.length>1&&(messages.length>20||messages.reduce((n,m)=>n+m.content.length,0)>20000))messages.shift();
 if(messages[0].content.length>20000)throw Error('Latest message exceeds context limit');
 return {messages,reduction:{droppedMessages:original-messages.length,source:'backend',maxMessages:20,maxCharacters:20000}};
}
