// Exercise playback lifecycle using an in-memory DOM and audio analyser.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{dataset:{},attrs:{},events:{},value:id==='language'?'English':'Hello',paused:true,ended:false,addEventListener(k,f){this.events[k]=f},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this[k]},pause(){this.paused=true;this.events.pause?.()},load(){}});return elements.get(id)}
let frames=new Map(),count=0,created=0;
const reduced={matches:false,addEventListener(){}};
class AudioContext{constructor(){created++}createAnalyser(){return {fftSize:256,getByteTimeDomainData(a){a.fill(160)},connect(){}}}createMediaElementSource(){return {connect(){}}}async resume(){}}
const ctx={document:{getElementById:element},matchMedia:()=>reduced,AudioContext,Uint8Array,Math,console,fetch:async()=>({ok:true,json:async()=>({status:'cancelled'})}),requestAnimationFrame:f=>{frames.set(++count,f);return count},cancelAnimationFrame:id=>frames.delete(id),setTimeout:()=>{}};
vm.createContext(ctx);const html=fs.readFileSync('index.html','utf8');assert(!html.includes('id="model"'));vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
(async()=>{
 const audio=element('audio'),buddy=element('buddy'),mouth=element('mouth');
 audio.paused=false;await audio.events.play();assert.equal(buddy.dataset.state,'speaking');assert(+mouth.attrs.ry>3);
 audio.pause();assert.equal(buddy.dataset.state,'ready');assert.equal(mouth.attrs.ry,'3');assert.equal(frames.size,0);
 audio.paused=false;await audio.events.play();assert.equal(created,1);
 audio.ended=true;audio.events.ended();assert.equal(frames.size,0);assert.equal(mouth.attrs.ry,'3');
 audio.ended=false;reduced.matches=true;await audio.events.play();assert.equal(mouth.attrs.ry,'3');
 audio.events.error();assert.equal(frames.size,0);assert.equal(buddy.dataset.state,'idle');
 await element('stop').onclick();assert.equal(buddy.dataset.state,'idle');assert.equal(mouth.attrs.ry,'3');
 element('text').events.input();assert.equal(buddy.dataset.state,'idle');console.log('Avatar lifecycle checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
