/* A turn-scoped PCM/WAV queue. Nothing is synthesized in the browser. */
class SegmentPlayer {
 constructor(turn){
  this.turn=turn;this.ctx=new AudioContext();this.analyser=this.ctx.createAnalyser();this.analyser.fftSize=256;this.analyser.connect(this.ctx.destination);
  this.seen=0;this.sources=new Set();this.next=0;this.started=false;this.final=false;this.stopped=false;this.frame=null;this.abort=new AbortController();this.begin=performance.now();this.metrics={bufferingMilliseconds:0};this.bufferSince=null;
  this.done=new Promise(resolve=>this.resolve=resolve);
  $('bufferPlay').hidden=false;$('bufferPause').hidden=false;
  $('bufferPlay').onclick=()=>this.resume();$('bufferPause').onclick=()=>this.pause();
  this.ctx.onstatechange=()=>this.update();
  this.ctx.resume().catch(()=>this.update());
 }
 async accept(segments){
  for(const segment of segments){
   if(this.stopped)return;if(segment.index<this.seen)continue;
   if(segment.index!==this.seen)throw Error('Speech segments arrived out of order.');
   const response=await fetch(segment.url,{signal:this.abort.signal});if(!response.ok)throw Error('Speech segment unavailable.');
   const bytes=await response.arrayBuffer();if(this.stopped)return;
   const buffer=await this.ctx.decodeAudioData(bytes);if(this.stopped)return;
   const source=this.ctx.createBufferSource();source.buffer=buffer;source.connect(this.analyser);
   const at=Math.max(this.next,this.ctx.currentTime+.03);this.next=at+buffer.duration;this.seen++;this.started=true;this.sources.add(source);
   source.onended=()=>{source.disconnect();this.sources.delete(source);this.update();};source.start(at);this.update();
  }
 }
 async pause(){if(!this.stopped){await this.ctx.suspend();this.update();}}
 async resume(){if(!this.stopped){await this.ctx.resume();this.update();}}
 update(){
  if(this.stopped)return;
  if(this.ctx.state!=='running'){state('ready','Paused — press Play / Resume');return;}
  if(this.sources.size){
   if(this.bufferSince!==null){this.metrics.bufferingMilliseconds+=performance.now()-this.bufferSince;this.bufferSince=null;}
   if(this.metrics.firstPlaybackMilliseconds===undefined)this.metrics.firstPlaybackMilliseconds=performance.now()-this.begin;
   state('speaking','Buddy is speaking');this.draw();
  }else if(this.final){this.metrics.playbackCompleteMilliseconds=performance.now()-this.begin;this.stop('complete');}
  else if(this.started){if(this.bufferSince===null)this.bufferSince=performance.now();state('preparing','Buffering speech');$('status').textContent='Buffering speech — Nano is preparing the next segment.';}
 }
 draw(){
  if(this.frame!==null)return;
  const samples=new Uint8Array(this.analyser.fftSize);
  const tick=()=>{this.frame=null;if(this.stopped||this.ctx.state!=='running'||!this.sources.size)return;this.analyser.getByteTimeDomainData(samples);let sum=0;for(const value of samples)sum+=((value-128)/128)**2;$('mouth').setAttribute('ry',reduced.matches?'3':String(3+Math.min(10,Math.sqrt(sum/samples.length)*45)));this.frame=requestAnimationFrame(tick);};tick();
 }
 finish(){this.final=true;this.update();}
 stop(status='cancelled'){
  if(this.stopped)return;this.stopped=true;this.abort.abort();if(this.frame!==null)cancelAnimationFrame(this.frame);
  for(const source of this.sources){source.onended=null;try{source.stop();source.disconnect();}catch(e){}}this.sources.clear();this.ctx.close().catch(()=>{});
  $('mouth').setAttribute('ry','3');$('bufferPlay').hidden=true;$('bufferPause').hidden=true;
  if(this.bufferSince!==null)this.metrics.bufferingMilliseconds+=performance.now()-this.bufferSince;
  this.metrics.status=status;
  if(this.turn)post('/api/conversation/playback',{turn:this.turn,metrics:this.metrics}).catch(()=>{});
  this.resolve(status);
 }
}
globalThis.SegmentPlayer=SegmentPlayer;
