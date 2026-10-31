/** Offline configuration check. Never connects to Supabase or writes environment files. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {fileURLToPath} from 'node:url';

const looksConfigured=value=>!!value&&!/^(your-|replace-|<)/i.test(value);
export function inspectSharedEnvironment({frontend,backend,expectedProject}) {
  const errors=[],notes=[];
  const result={mode:'offline-read-only',expectedProject,project:null,frontendOrigin:null,apiOrigin:null,errors,notes};
  if(!/^[a-z0-9]{20}$/.test(expectedProject??''))errors.push('Supply the explicitly approved 20-character project reference.');
  const expected=expectedProject+'.supabase.co';
  for(const [label,value] of [['Backend',backend.SUPABASE_URL],['Frontend',frontend.NEXT_PUBLIC_SUPABASE_URL??backend.SUPABASE_URL]]) {
    try {const u=new URL(value);if(u.protocol!=='https:'||u.hostname!==expected||u.username||u.password||u.port||!['','/'].includes(u.pathname)||u.search||u.hash)throw Error();result.project=u.hostname;} catch {errors.push(label+' Supabase target does not exactly match the approved shared project.');}
  }
  if(!looksConfigured(frontend.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??backend.SUPABASE_PUBLISHABLE_KEY))errors.push('Frontend publishable key is missing or a placeholder.');
  if(!looksConfigured(backend.SUPABASE_PUBLISHABLE_KEY))errors.push('Backend publishable key is missing or a placeholder.');
  if(!looksConfigured(backend.SUPABASE_SERVICE_ROLE_KEY))errors.push('Backend-only service-role key is missing or a placeholder.');
  if(Object.keys(frontend).some(key=>key.startsWith('NEXT_PUBLIC_')&&/SERVICE_ROLE|ENCRYPTION_KEY|HMAC|REFRESH_TOKEN|TOTP/i.test(key)))errors.push('A server secret variable is incorrectly prefixed NEXT_PUBLIC_.');
  if(frontend.NEXT_PUBLIC_DATA_ADAPTER!=='http')errors.push('Use the http adapter for the shared integration environment.');
  try {const api=new URL(frontend.NEXT_PUBLIC_API_BASE_URL);if(api.protocol!=='http:'||!['localhost','127.0.0.1'].includes(api.hostname)||api.username||api.password||api.search||api.hash||api.pathname.replace(/\/$/,'')!=='/api/v1'||Number(api.port||80)!==Number(backend.PORT||4200))throw Error();result.apiOrigin=api.origin;}catch{errors.push('The browser must call this laptop’s local Express /api/v1 at its configured port.');}
  try {const origin=new URL(backend.FRONTEND_URL);if(origin.protocol!=='http:'||!['localhost','127.0.0.1'].includes(origin.hostname)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error();result.frontendOrigin=origin.origin;}catch{errors.push('FRONTEND_URL must be this laptop’s exact local frontend origin.');}
  try{if(Buffer.from(backend.JOURNAL_ENCRYPTION_KEY_BASE64??'','base64').length!==32)throw Error();}catch{errors.push('The approved shared encryption key is missing or not 32 bytes.');}
  notes.push('Each laptop uses its own frontend and Express server; only Supabase is shared.');
  notes.push('The project owner must securely provide the same approved encryption key/version, previous-key map and shared idempotency keyring to every authorized backend. Do not generate replacement keys for existing shared ciphertext.');
  notes.push('Auth redirect allow-list, email configuration, account eligibility, MFA, reviewer authorization and migration parity require separate read-only/operator checks. This command proves none of those.');
  return {...result,ok:errors.length===0};
}
async function readEnv(file){try{return parseEnv(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return {};throw Error('An environment file could not be parsed; contents are not printed.');}}
export async function checkLocalFiles(root,expectedProject,environment={}) {
  const backend={...await readEnv(path.join(root,'backend/.env')),...environment};
  let frontend={};for(const name of ['.env','.env.development','.env.local','.env.development.local'])frontend={...frontend,...await readEnv(path.join(root,'frontend',name))};
  return inspectSharedEnvironment({backend,frontend:{...frontend,...environment},expectedProject});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const index=process.argv.indexOf('--expected-project');const expectedProject=index<0?'':process.argv[index+1];
  try {const result=await checkLocalFiles(fileURLToPath(new URL('../',import.meta.url)),expectedProject,process.env);console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;}catch{console.error('Offline configuration check failed. No environment values or secrets were printed.');process.exitCode=1;}
}
