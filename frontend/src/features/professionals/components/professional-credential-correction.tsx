"use client";
import {useEffect,useRef,useState} from "react";
import {professionalApi,type CredentialReview} from "@/services/professionals/professional-api";
import {EchoButton} from "@/shared/components/ui/echo-button";
export function ProfessionalCredentialCorrection({credential,onSaved}:{credential:CredentialReview;onSaved:()=>void}) {
 const [open,setOpen]=useState(false),[label,setLabel]=useState(credential.credentialLabel),[expiry,setExpiry]=useState(credential.expiresAt),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const pending=useRef(false),active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false}},[]);
 if(credential.reviewStatus!=="pending")return null;
 return open?<form aria-label="Correct pending application" className="mt-3 space-y-3" onSubmit={async event=>{
  event.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setError("");
  try {const result=await professionalApi.correctCredential(credential.id,{credentialLabel:label.trim(),expiresAt:expiry});
   if(!active.current)return;
   if(result.credential.id!==credential.id||result.credential.userId!==credential.userId||result.credential.organizationId!==credential.organizationId||result.credential.reviewStatus!=="pending")throw Error("SCOPE_MISMATCH");
   setOpen(false);onSaved();
  }catch {if(active.current)setError("Correction could not be confirmed. Refresh application history before retrying; do not submit a duplicate application.");}
  finally {pending.current=false;if(active.current)setBusy(false)}
 }}>
 <label className="block">Corrected qualification label<input className="echo-input mt-2" value={label} onChange={e=>setLabel(e.target.value)} required minLength={2} maxLength={160}/></label>
 <label className="block">Corrected expiry date<input className="echo-input mt-2" type="date" value={expiry} onChange={e=>setExpiry(e.target.value)} required min={new Date().toISOString().slice(0,10)}/></label>
 <p className="text-xs">Updates this pending application only. Review, evidence, role and membership are unchanged.</p>
 {error?<p role="alert">{error}</p>:null}
 <EchoButton disabled={busy} type="submit">Save pending correction</EchoButton> <EchoButton variant="outline" type="button" disabled={busy} onClick={()=>setOpen(false)}>Cancel correction</EchoButton>
 </form>:<EchoButton size="small" variant="outline" className="mt-3" onClick={()=>setOpen(true)}>Correct pending application</EchoButton>;
}
