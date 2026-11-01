import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { facialExpressionResultSchema } from "@echo/contracts";
import { ExternalServiceError } from "../../shared/errors/app-error.js";
let active = false;
export async function evaluateFinalFace(image: Buffer) {
  if(active) throw new ExternalServiceError("FACE_BUSY","Face analysis is busy. Please retry shortly.");
  active=true;
  try { return await new Promise<ReturnType<typeof facialExpressionResultSchema.parse>>((resolveResult,reject)=>{
    const fail=()=>reject(new ExternalServiceError("FACE_UNAVAILABLE","Face analysis could not complete. Please try again."));
    const env:NodeJS.ProcessEnv={PYTHONDONTWRITEBYTECODE:"1",PYTHONIOENCODING:"utf-8"};
    for(const key of ["SYSTEMROOT","WINDIR","PATH","TEMP","TMP","LOCALAPPDATA","USERPROFILE"])if(process.env[key])env[key]=process.env[key];
    const child=spawn(resolve("../ai-service/.venv-face/Scripts/python.exe"),["-B",resolve("../ai-service/app/face_eval_memory.py"),resolve("models/face-final")],{env,windowsHide:true,stdio:["pipe","pipe","ignore"]});
    let output=Buffer.alloc(0);
    const timer=setTimeout(()=>{child.kill();fail();},60000);
    child.stdout.on("data",chunk=>{output=Buffer.concat([output,chunk]);if(output.length>1024*1024){child.kill();fail();}});
    child.once("error",()=>{clearTimeout(timer);fail();});
    child.once("close",code=>{clearTimeout(timer);if(code!==0)return fail();try{resolveResult(facialExpressionResultSchema.parse(JSON.parse(output.toString("utf8"))));}catch{fail();}});
    child.stdin.on("error",()=>{});child.stdin.end(image);
  }); } finally {active=false;}
}
