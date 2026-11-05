import {z} from 'zod';
export function normalizePhilippineMobile(value:string):string|null{
 if(!/^[+0-9 ()-]+$/.test(value))return null;
 let digits=value.replace(/[ ()-]/g,'');
 if(digits.startsWith('+63'))digits=digits.slice(3);
 else if(digits.startsWith('63'))digits=digits.slice(2);
 else if(digits.startsWith('0'))digits=digits.slice(1);
 return /^9[0-9]{9}$/.test(digits)?'+63'+digits:null;
}
export const philippineMobileSchema=z.string().transform((value,ctx)=>{
 const normalized=normalizePhilippineMobile(value.trim());
 if(!normalized){ctx.addIssue({code:'custom',message:'Enter a Philippine mobile number: +63 followed by 10 digits beginning with 9.'});return z.NEVER;}
 return normalized;
});
