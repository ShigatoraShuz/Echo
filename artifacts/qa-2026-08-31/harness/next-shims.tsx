import React from 'react';
export default function Link({href,children,prefetch,replace,scroll,...props}:any){return <a href={typeof href==='string'?href:'#'} {...props}>{children}</a>}
export const useRouter=()=>({push:(url:string)=>window.location.assign(url),replace:(url:string)=>window.location.replace(url),back:()=>window.history.back(),refresh:()=>window.location.reload(),prefetch:()=>{}});
export const usePathname=()=>window.location.pathname;
export const useSearchParams=()=>new URLSearchParams(window.location.search);
