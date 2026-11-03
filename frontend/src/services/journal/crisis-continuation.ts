import {env} from '@/config/environment';
import {supabaseAuthTokenProvider} from '@/infrastructure/api/supabase-auth-token-provider';
export type BlockedReflection={jobId:string;journalId:string;createdAt:string};
async function request(path:string,body?:unknown){
 const token=await supabaseAuthTokenProvider.getAccessToken();if(!token)throw Error('Sign in to confirm a saved reflection.');
 const res=await fetch(env.apiBaseUrl+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const value=await res.json();if(!res.ok)throw Error(value.error?.message??'Confirmation could not be completed. Please retry.');return value.data;
}
export async function blockedReflections():Promise<BlockedReflection[]>{return request('/analysis-jobs/blocked-local');}
export async function confirmContinuation(jobId:string,key:string){return request('/analysis-jobs/'+encodeURIComponent(jobId)+'/confirm-continuation',{key,steps:[true,true,true,true]});}

export async function confirmCurrentPauses(ids:string[],key:string){return request('/analysis-jobs/confirm-current-crisis',{ids,key,steps:[true,true,true,true]});}
