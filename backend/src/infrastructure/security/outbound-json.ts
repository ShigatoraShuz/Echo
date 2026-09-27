import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

export function isPublicAddress(address:string):boolean {
 if(isIP(address)===4) {
  const [a,b,c]=address.split(".").map(Number);
  return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||
   (a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||(b===88&&c===99)))||
   (a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));
 }
 if(isIP(address)===6) {
  const canonical=new URL('http://['+address+']/').hostname.slice(1,-1).toLowerCase();
  const groups=canonical.split(":");
  return /^[23]/.test(canonical) && !(groups[0]==="2001" && (parseInt(groups[1]||"0",16)<0x200 || groups[1]==="db8")) && !canonical.startsWith("2002:") && !canonical.startsWith("3fff:");
 }
 return false;
}
export function approvedOutboundUrl(value:string,allowedOrigins:readonly string[]):URL {
 const url=new URL(value);
 if(url.protocol!=="https:"||url.username||url.password||url.hash||url.search||isIP(url.hostname.replace(/^\[|\]$/g,""))||
  !allowedOrigins.includes(url.origin)) throw new Error("Outbound destination is not approved.");
 return url;
}
/** Resolve once, reject private answers, pin the selected address and retain TLS hostname verification. */
export async function postApprovedJson(url:URL,headers:Record<string,string>,body:string,timeoutMs:number):Promise<unknown> {
 if(Buffer.byteLength(body)>256_000) throw new Error("Outbound input limit exceeded.");
 const signal=AbortSignal.timeout(Math.min(30_000,Math.max(1000,timeoutMs)));
 const addresses=await new Promise<LookupAddress[]>((resolve,reject)=>{
  const abort=()=>reject(new Error("Outbound timeout."));signal.addEventListener("abort",abort,{once:true});
  void lookup(url.hostname,{all:true}).then(resolve,reject).finally(()=>signal.removeEventListener("abort",abort));
 });
 // lookup(all:true) returns addresses; no redirect or second DNS lookup is allowed.
 if(!Array.isArray(addresses)||!addresses.length||addresses.some(item=>!isPublicAddress(item.address))) throw new Error("Outbound address is not public.");
 signal.throwIfAborted();
 const selected=addresses[0];
 return new Promise((resolve,reject)=>{
  const req=request(url,{method:"POST",headers,signal,agent:false,servername:url.hostname,rejectUnauthorized:true,
   family:selected.family,
   lookup:(_hostname,options,callback)=>options.all ? callback(null,[selected]) : callback(null,selected.address,selected.family),
  },res=>{
   if(!res.statusCode||res.statusCode<200||res.statusCode>=300){res.resume();reject(new Error("Outbound response rejected."));return;}
   let size=0;const chunks:Buffer[]=[];
   res.on("data",(chunk:Buffer)=>{size+=chunk.length;if(size>1_000_000){res.destroy();reject(new Error("Outbound response limit exceeded."));}else chunks.push(chunk);});
   res.on("error",()=>reject(new Error("Outbound response failed.")));
   res.on("end",()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));}catch{reject(new Error("Outbound JSON invalid."));}});
  });
  req.on("error",()=>reject(new Error("Outbound request failed.")));
  req.end(body);
 });
}
