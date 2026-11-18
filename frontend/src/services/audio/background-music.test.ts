import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let music: typeof import('./background-music');
let tracks: FakeAudio[];
class FakeAudio {
  loop=false; preload=''; volume=1; paused=true; currentTime=42;
  play=vi.fn(async()=>{this.paused=false;});
  pause=vi.fn(()=>{this.paused=true;});
  constructor(public src:string){tracks.push(this);}
}
beforeEach(async()=>{vi.resetModules();tracks=[];localStorage.clear();vi.stubGlobal('Audio',FakeAudio);music=await import('./background-music');});
afterEach(()=>{music.releaseBackgroundMusic();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('plays the supplied music softly on one continuous loop without restarting on subsequent interactions',async()=>{
 expect(music.backgroundMusicPreference()).toEqual({enabled:true,volume:.12});
 expect(await music.playBackgroundMusic()).toBe(true);
 expect(tracks).toHaveLength(1);expect(tracks[0].src).toBe('/audio/golden-afternoon.mp3');
 expect(tracks[0].loop).toBe(true);expect(tracks[0].volume).toBe(.12);
 await music.playBackgroundMusic();expect(tracks[0].play).toHaveBeenCalledOnce();expect(tracks[0].currentTime).toBe(42);
 music.setBackgroundMusicVoiceFocus(true);
 expect(tracks[0].paused).toBe(true);expect(await music.playBackgroundMusic()).toBe(false);
 music.setBackgroundMusicVoiceFocus(false);await music.playBackgroundMusic();
 expect(tracks).toHaveLength(1);
 music.saveBackgroundMusicPreference({enabled:false,volume:.12});
 expect(tracks[0].paused).toBe(true);expect(await music.playBackgroundMusic()).toBe(false);
 music.saveBackgroundMusicPreference({enabled:true,volume:.08});await music.playBackgroundMusic();
 expect(tracks).toHaveLength(1);expect(tracks[0].volume).toBe(.08);expect(tracks[0].currentTime).toBe(42);
});
it('handles autoplay blocking and retries after interaction without creating a second track',async()=>{
 await music.playBackgroundMusic();tracks[0].paused=true;
 tracks[0].play.mockRejectedValueOnce(new DOMException('Blocked','NotAllowedError'));
 expect(await music.playBackgroundMusic()).toBe(false);expect(await music.playBackgroundMusic()).toBe(true);
 expect(tracks).toHaveLength(1);
 music.saveBackgroundMusicPreference({enabled:true,volume:0});
 expect(await music.playBackgroundMusic()).toBe(false);
});
