const panel=document.createElement('section');panel.innerHTML=`<h2>Nano preload conversation</h2><label>Speech segments <select id="segmentMode"><option value="buffered">Current buffered mode</option><option value="sentences_2_then_3">First 2 individually, then batches of 3</option></select></label><small>New option: one sentence per segment. First two are generated individually; later sentences are processed in groups of up to three.</small><label><input type="checkbox" id="waitFull"> Wait for full response</label><button id="bufferPlay" hidden>Play / Resume</button><button id="bufferPause" hidden>Pause</button><button id="loadModels">Load models</button><button id="unloadModels">Unload models</button><p>Hands-free between replies. Interrupt to stop Buddy and speak again.</p><select id="saved" aria-label="Saved conversations"></select><button id="newChat">New conversation</button><button id="startChat">Start conversation</button><button id="interruptChat">Interrupt</button><button id="endChat">End conversation</button><div id="messages" role="log" aria-live="polite"></div><textarea id="typed" aria-label="Type a message" placeholder="Or type a message to Buddy"></textarea><button id="sendChat">Send message</button><button id="retryChat" hidden>Retry speech</button>`;document.querySelector('h1').after(panel);
let sessionId=null,conversationEpoch=0,listening=false,enabled=false,stream=null,micContext=null,micNode=null,micSource=null,micGain=null,parts=[],speechFrames=0,silenceFrames=0,started=false,turnId=null,checked=false,locked=false;
const conversationControls=['generate','previewButton','startChat','sendChat','newChat','saved','segmentMode'];
function controls(value){locked=value;for(const id of conversationControls)$(id).disabled=value;}
function listen(){if(!enabled)return;listening=true;parts=[];speechFrames=0;silenceFrames=0;started=false;if(stream)stream.getTracks().forEach(t=>t.enabled=true);state('listening','Listening');}
function mute(){listening=false;parts=[];if(stream)stream.getTracks().forEach(t=>t.enabled=false);}
async function checkedStart(){if(!checked){$('status').textContent='Checking Whisper, CBT environment and models...';await post('/api/conversation/check',{});checked=true;}if(!sessionId){const s=await post('/api/conversation/new',{});sessionId=s.id;}await render();}
async function render(){const sessions=await(await fetch('/api/sessions')).json();$('saved').replaceChildren(...sessions.map(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.title;return o;}));if(sessionId)$('saved').value=sessionId;if(!sessionId)return;const s=await(await fetch('/api/session?id='+sessionId)).json();$('messages').replaceChildren(...s.messages.map(m=>{const p=document.createElement('p');p.style.whiteSpace='pre-wrap';p.textContent=(m.role==='user'?'You: ':'Buddy: ')+m.content;return p;}));}
function microphoneData(samples){if(!listening||!enabled)return;let energy=0;for(const s of samples)energy+=s*s;const voice=Math.sqrt(energy/samples.length)>.012;if(voice){started=true;speechFrames+=samples.length;silenceFrames=0;}else if(started)silenceFrames+=samples.length;if(!started)return;parts.push(samples);const duration=parts.reduce((n,a)=>n+a.length,0)/micContext.sampleRate;if((silenceFrames/micContext.sampleRate>=1||duration>=60)&&speechFrames/micContext.sampleRate>=.45){const all=new Float32Array(parts.reduce((n,a)=>n+a.length,0));let offset=0;for(const p of parts){all.set(p,offset);offset+=p.length;}const pcm=new Int16Array(Math.min(960000,Math.floor(all.length*16000/micContext.sampleRate)));for(let i=0;i<pcm.length;i++)pcm[i]=Math.max(-32768,Math.min(32767,Math.round(all[Math.floor(i*micContext.sampleRate/16000)]*32767)));mute();let binary='';for(const b of new Uint8Array(pcm.buffer))binary+=String.fromCharCode(b);submit({audio:btoa(binary)});}else if(duration>=60||(!voice&&silenceFrames/micContext.sampleRate>=1)){parts=[];started=false;speechFrames=0;silenceFrames=0;}}
$('startChat').onclick=async()=>{controls(true);try{micContext=new AudioContext();await micContext.resume();await checkedStart();stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});await micContext.audioWorklet.addModule('/microphone.js');micSource=micContext.createMediaStreamSource(stream);micNode=new AudioWorkletNode(micContext,'buddy-microphone');micGain=micContext.createGain();micGain.gain.value=0;micSource.connect(micNode);micNode.connect(micGain);micGain.connect(micContext.destination);micNode.port.onmessage=e=>microphoneData(e.data);stream.getTracks().forEach(t=>t.onended=()=>endConversation());enabled=true;clearAudio();listen();}catch(e){await endConversation();$('status').textContent=e.message;}finally{controls(false);$('startChat').disabled=enabled;}};
async function submit(data){
 const mine=++conversationEpoch;mute();clearAudio();controls(true);$('retryChat').hidden=true;
 const full=$('waitFull').checked;let player=null,lastMessages='';
 try{
  await checkedStart();if(mine!==conversationEpoch)return;
  const turn=await post('/api/conversation/turn',{session:sessionId,language:$('language').value,experimental:$('experimental').checked,segmentMode:$('segmentMode').value,...data});
  turnId=turn.id;if(!data.retry)$('retryChat').dataset.turn=turn.id;
  if(!full){player=new SegmentPlayer(turn.id);globalThis.segmentPlayer=player;}
  while(mine===conversationEpoch){
   const response=await fetch('/api/turn?id='+turn.id);if(!response.ok)throw Error('Turn status unavailable');const result=await response.json();if(mine!==conversationEpoch)return;
   const signature=JSON.stringify([result.transcript,result.reply,result.status]);if(signature!==lastMessages){await render();lastMessages=signature;}
   if(mine!==conversationEpoch)return;
   if(result.status==='failed'||result.status==='cancelled'||result.status==='withheld'){
    player?.stop(result.status==='failed'?'failed':'cancelled');$('status').textContent=(result.segments?.length?'Spoken answer incomplete. ':'')+(result.error||result.message||result.status);
    controls(false);if(result.reply){$('retryChat').hidden=false;state('ready','Retry speech available');}else listen();return;
   }
   if(player){await player.accept(result.segments||[]);if(mine!==conversationEpoch)return;}
   if(result.status==='running'){
    if(!player?.started){state('preparing',result.message||'Preparing speech');$('status').textContent=result.message||'Preparing speech';}
    await new Promise(resolve=>setTimeout(resolve,250));continue;
   }
   if(result.status==='empty'){player?.stop();controls(false);listen();return;}
   if(result.status==='complete'){
    const url='/audio/'+turn.id;$('download').href=url;$('download').hidden=false;
    if(player){player.finish();await player.done;if(mine!==conversationEpoch)return;}
    $('audio').src=url;$('audio').hidden=false;controls(false);$('startChat').disabled=enabled;
    if(full){try{await $('audio').play();}catch(e){state('ready','Press Play to hear Buddy');}}
    else{state('ready','Finished — replay is available');listen();}
    return;
   }
  }
 }catch(e){if(mine!==conversationEpoch)return;player?.stop('failed');controls(false);$('status').textContent=e.message+' — speech may be incomplete.';$('retryChat').hidden=!turnId;state('idle','Needs attention');}
}
$('sendChat').onclick=()=>{const text=$('typed').value.trim();if(text){$('typed').value='';submit({text});}};
$('retryChat').onclick=()=>submit({retry:$('retryChat').dataset.turn||turnId});
async function interrupt(){conversationEpoch++;mute();clearAudio();controls(true);try{await post('/api/conversation/cancel',{});listen();}catch(e){$('status').textContent=e.message;}finally{controls(false);$('startChat').disabled=enabled;}}
$('interruptChat').onclick=interrupt;
async function endConversation(){enabled=false;conversationEpoch++;mute();clearAudio();if(stream){stream.getTracks().forEach(t=>{t.onended=null;t.stop();});stream=null;}if(micContext){await micContext.close().catch(()=>{});micContext=null;}await post('/api/conversation/cancel',{}).catch(()=>{});state('idle','Conversation ended');controls(false);}
$('endChat').onclick=endConversation;
$('newChat').onclick=async()=>{await endConversation();const s=await post('/api/conversation/new',{});sessionId=s.id;await render();};
$('saved').onchange=async()=>{const id=$('saved').value;await endConversation();sessionId=id;await render();};
$('audio').addEventListener('ended',()=>{if(enabled)listen();});$('audio').addEventListener('error',()=>{if(turnId)$('retryChat').hidden=false;});
$('stop').addEventListener('click',()=>interrupt());
window.addEventListener('pagehide',()=>{globalThis.segmentPlayer?.stop();enabled=false;if(stream)stream.getTracks().forEach(t=>t.stop());});render().catch(e=>$('status').textContent=e.message);

$('loadModels').onclick=async()=>{controls(true);try{const info=await post('/api/conversation/check',{});checked=true;$('status').textContent=JSON.stringify(info,null,2);}catch(e){checked=false;$('status').textContent=e.message;}finally{controls(false);}};
$('unloadModels').onclick=async()=>{await endConversation();checked=false;try{await post('/api/conversation/unload',{});$('status').textContent='Models unloaded';}catch(e){$('status').textContent=e.message;}};
$('experimental').onchange=()=>{for(const o of $('language').options)if(o.value!=='English')o.disabled=!$('experimental').checked;if(!$('experimental').checked)$('language').value='English';};

for(const id of ['text','language'])$(id).addEventListener('input',()=>{if(globalThis.segmentPlayer&&!globalThis.segmentPlayer.stopped)interrupt();},{capture:true});
