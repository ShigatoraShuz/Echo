import {render,fireEvent,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {BackgroundMusicController} from './background-music-controller';
import {playBackgroundMusic,releaseBackgroundMusic} from '@/services/audio/background-music';
import {playInterfaceSound} from '@/services/audio/interface-sound';
vi.mock('@/services/audio/background-music',()=>({BACKGROUND_MUSIC_KEY:'music',BACKGROUND_MUSIC_EVENT:'music-change',DEFAULT_BACKGROUND_MUSIC:{enabled:true,volume:.12},backgroundMusicPreference:()=>({enabled:true,volume:.12}),playBackgroundMusic:vi.fn(),pauseBackgroundMusic:vi.fn(),releaseBackgroundMusic:vi.fn(),saveBackgroundMusicPreference:vi.fn()}));
vi.mock('@/services/audio/interface-sound',()=>({playInterfaceSound:vi.fn()}));
it('keeps the root music instance on rerender and never plays popup/tab sound effects',()=>{
 const view=render(<><BackgroundMusicController/><button role="tab" aria-selected="false">Tab</button></>);
 expect(playBackgroundMusic).toHaveBeenCalledOnce();
 view.rerender(<><BackgroundMusicController/><button role="tab" aria-selected="true">Tab</button><div role="dialog">Popup</div></>);
 expect(playBackgroundMusic).toHaveBeenCalledOnce();expect(playInterfaceSound).not.toHaveBeenCalled();
 fireEvent.pointerDown(screen.getByRole('tab'));expect(playBackgroundMusic).toHaveBeenCalledTimes(2);
 view.unmount();expect(releaseBackgroundMusic).toHaveBeenCalledOnce();
});
