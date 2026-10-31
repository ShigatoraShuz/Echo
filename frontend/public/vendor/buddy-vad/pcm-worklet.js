/* Local mono capture. Browser audio never leaves through a third-party service. */
class BuddyPCM extends AudioWorkletProcessor {
 constructor(){super();this.frame=new Float32Array(512);this.offset=0;this.phase=0;}
 process(inputs){const input=inputs[0]?.[0];if(input)for(let i=0;i<input.length;i++){this.phase+=16000;if(this.phase>=sampleRate){this.phase-=sampleRate;this.frame[this.offset++]=input[i];if(this.offset===512){this.port.postMessage(this.frame,[this.frame.buffer]);this.frame=new Float32Array(512);this.offset=0;}}}return true;}
}
registerProcessor('buddy-pcm',BuddyPCM);
