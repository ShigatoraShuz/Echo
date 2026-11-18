/** Browser-owned speech service; never promises a particular provider or offline use. */
type Result={isFinal:boolean;[index:number]:{transcript:string}};
type Recognition={
  lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;
  onstart:(()=>void)|null;onend:(()=>void)|null;
  onresult:((event:{resultIndex:number;results:ArrayLike<Result>})=>void)|null;
  onerror:((event:{error:string})=>void)|null;
  start:()=>void;stop:()=>void;abort:()=>void;
};
type SpeechWindow={SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
function constructor(){const host=globalThis as typeof globalThis&SpeechWindow;return host.SpeechRecognition??host.webkitSpeechRecognition;}
export function browserSpeechSupported(){return Boolean(constructor());}
export type BrowserSpeechCapture={stop:()=>void;cancel:()=>void};
export function startBrowserSpeech(options:{continuous?:boolean;onStart?:()=>void;onInterim?:(text:string)=>void;onFinal:(text:string)=>void;onError:(message:string)=>void}):BrowserSpeechCapture{
  const Constructor=constructor();
  if(!Constructor)throw Error('Browser speech is unavailable in this browser. Choose Whisper.');
  const recognition=new Constructor();
  recognition.lang='en-US';recognition.continuous=options.continuous??true;recognition.interimResults=true;recognition.maxAlternatives=1;
  let closed=false,stopping=false;
  const results=new Map<number,string>();
  let drain:ReturnType<typeof setTimeout>|undefined;
  const cleanup=()=>{closed=true;clearTimeout(limit);clearTimeout(drain);recognition.onstart=null;recognition.onresult=null;recognition.onerror=null;recognition.onend=null;};
  const fail=(message:string)=>{if(closed)return;cleanup();try{recognition.abort();}catch{}options.onError(message);};
  const finish=()=>{if(closed)return;const text=[...results.entries()].sort((a,b)=>a[0]-b[0]).map(([,text])=>text).join(' ').trim();cleanup();if(text)options.onFinal(text);else options.onError('No speech detected. Press the microphone or Resume Talk to try again.');};
  const stop=()=>{if(closed||stopping)return;stopping=true;clearTimeout(limit);drain=setTimeout(()=>fail('Browser speech did not finish. Please try again.'),5000);try{recognition.stop();}catch{fail('Browser speech could not finish. Please try again.');}};
  recognition.onstart=()=>{if(!closed)options.onStart?.();};
  recognition.onresult=event=>{
    if(closed)return;const interim:string[]=[];
    for(let i=event.resultIndex;i<event.results.length;i++){
      const result=event.results[i],text=result[0]?.transcript??'';
      if(result.isFinal)results.set(i,text.trim());else interim.push(text);
    }
    const final=[...results.values()].join(' ');
    if(final.length+interim.join(' ').length>4000){fail('Speech exceeds the 4,000-character limit. Record a shorter message.');return;}
    options.onInterim?.([final,...interim].filter(Boolean).join(' '));
  };
  recognition.onerror=event=>{
    const messages:Record<string,string>={
      'not-allowed':'Microphone permission was denied. Allow microphone access and try again.',
      'service-not-allowed':'The browser speech service is unavailable. Choose Whisper or try another supported browser.',
      'audio-capture':'The microphone is unavailable. Check your microphone and try again.',
      network:'The browser speech service could not connect. Check your connection or choose Whisper.',
      'no-speech':'No speech detected. Press the microphone or Resume Talk to try again.',
      'language-not-supported':'English browser recognition is unavailable on this device. Choose Whisper.',
    };
    fail(messages[event.error]??'Browser speech stopped unexpectedly. Please try again.');
  };
  recognition.onend=finish;
  const limit=setTimeout(stop,59000);
  try{recognition.start();}catch(error){cleanup();try{recognition.abort();}catch{}throw error;}
  return {stop,cancel:()=>{if(closed)return;cleanup();try{recognition.abort();}catch{}}};
}
