import {openSync,writeFileSync,fsyncSync,closeSync,renameSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
export function atomicJson(file:string,value:unknown){
 const temp=file+'.'+randomUUID()+'.tmp';let fd:number|undefined;
 try {fd=openSync(temp,'wx');writeFileSync(fd,JSON.stringify(value,null,2));fsyncSync(fd);closeSync(fd);fd=undefined;renameSync(temp,file);}
 finally {if(fd!==undefined)closeSync(fd);try{unlinkSync(temp);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
}
