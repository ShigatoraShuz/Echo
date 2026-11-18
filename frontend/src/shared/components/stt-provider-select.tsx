"use client";
import {useId} from 'react';
import type {SttProvider} from '@echo/contracts';
import {useEffect,useState} from 'react';
import {browserSpeechSupported} from '@/shared/browser-speech';
export function SttProviderSelect({value,onChange,disabled=false}:{value:SttProvider;onChange:(value:SttProvider)=>void;disabled?:boolean}){
  const id=useId();
  const [supported,setSupported]=useState(false);
  useEffect(()=>{setSupported(browserSpeechSupported());},[]);
  return <div className="space-y-1 text-sm"><label htmlFor={id}>Speech recognition </label><select id={id} value={value} disabled={disabled} onChange={event=>onChange(event.target.value as SttProvider)} className="rounded-lg border bg-background px-2 py-1"><option value="whisper">Whisper · on this host</option><option value="browser" disabled={!supported}>Browser speech · no API key</option></select><p className="text-xs text-muted-foreground">{value==='browser'?'English audio may be sent to the browser’s speech service. No Google Cloud API key is needed.':'English audio is processed on the Echo host.'}{!supported&&' Browser speech is unavailable in this browser; Whisper is available.'}</p></div>;
}
