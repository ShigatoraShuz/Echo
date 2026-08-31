import React from 'react';
export default function Image({src,fill,priority,unoptimized,sizes,...props}:any){return <img src={typeof src==='string'?src:src.src} {...props} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}
