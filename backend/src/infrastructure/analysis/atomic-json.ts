import {openSync,writeFileSync,fsyncSync,closeSync,renameSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
export function atomicJson(file:string,value:unknown){
 const temp=file+'.'+randomUUID()+'.tmp';let fd:number|undefined;
 try {fd=openSync(temp,'wx');writeFileSync(fd,JSON.stringify(value,null,2));fsyncSync(fd);closeSync(fd);fd=undefined;renameSync(temp,file);}
 finally {try{if(fd!==undefined)closeSync(fd);}catch{/* Preserve the original write failure. */}try{unlinkSync(temp);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')console.warn(JSON.stringify({service:'local-json',code:'LOCAL_TEMP_CLEANUP_REQUIRED'}));}}
}
