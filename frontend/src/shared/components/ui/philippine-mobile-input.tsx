"use client";
import type {InputHTMLAttributes,ChangeEvent} from 'react';
export function PhilippineMobileInput({value,onChange,className,...props}:InputHTMLAttributes<HTMLInputElement>){
 let display=String(value??'').replace(/[ ()-]/g,'');
 if(display.startsWith('+63'))display=display.slice(3);else if(display.startsWith('63'))display=display.slice(2);else if(display.startsWith('0'))display=display.slice(1);
 return <span className="flex items-center gap-2"><span aria-hidden="true" className="before:content-['+63']" /><input {...props} type="tel" inputMode="tel" className={className} value={display} placeholder="917 123 4567" aria-label={props['aria-label']} onChange={(event:ChangeEvent<HTMLInputElement>)=>{
 let digits=event.target.value.replace(/[ ()-]/g,'');
 if(digits.startsWith('+63'))digits=digits.slice(3);else if(digits.startsWith('63'))digits=digits.slice(2);else if(digits.startsWith('0'))digits=digits.slice(1);
 if(!/^[0-9]{0,10}$/.test(digits))return;
 event.target.value=digits?'+63'+digits:'';onChange?.(event);
 }}/></span>;
}
