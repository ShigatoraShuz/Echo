import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect,it,vi} from 'vitest';
import {BuddyVoiceStudio} from './buddy-voice-studio';
import type {useRealtimeTalk} from '../view-model/use-realtime-talk';
vi.mock('@/shared/components/voice-orb/VoiceOrb',()=>({default:({state,label}:{state:string;label:string})=><div role="img" aria-label={label} data-state={state}/>}));
const talk=()=>({state:'idle',active:false,analyser:null,callerAnalyser:null,language:'English',voiceMode:'fast',speechMode:'sentences_2_then_3',sensitivity:'normal',experimentalLanguages:false,error:'',transcript:'',stop:vi.fn(),interrupt:vi.fn(),resumeTalk:vi.fn(),resumePlayback:vi.fn(),retrySpeech:vi.fn(),setVoiceMode:vi.fn(),setSensitivity:vi.fn(),setSpeechMode:vi.fn(),setLanguage:vi.fn(),setExperimentalLanguages:vi.fn()} as unknown as ReturnType<typeof useRealtimeTalk>);
it('focuses the idle view on the orb and Start Talk with settings collapsed',async()=>{
 const value=talk(),start=vi.fn();const user=userEvent.setup();
 render(<BuddyVoiceStudio talk={value} disabled={false} onStart={start} messages={[]} speechProvider={<p>Speech provider</p>}/>);
 expect(screen.getByRole('img',{name:'Buddy voice orb'})).toHaveAttribute('data-state','ready');
 expect(screen.getByLabelText('Voice style')).not.toBeVisible();
 await user.click(screen.getByRole('button',{name:'Start Talk'}));expect(start).toHaveBeenCalledOnce();
 await user.click(screen.getByText('Voice settings'));expect(screen.getByLabelText('Voice style')).toBeVisible();
 await user.selectOptions(screen.getByLabelText('Voice style'),'expressive');expect(value.setVoiceMode).toHaveBeenCalledWith('expressive');
});
it('connects the speaking, interrupt, and stop controls to the existing Talk session',async()=>{
 const value={...talk(),active:true,state:'speaking'};const user=userEvent.setup();
 render(<BuddyVoiceStudio talk={value} disabled onStart={vi.fn()} messages={[]} speechProvider={null}/>);
 expect(screen.getByRole('img',{name:'Buddy voice orb'})).toHaveAttribute('data-state','talking');
 expect(screen.getByRole('button',{name:'Stop Talk'})).toBeEnabled();
 await user.click(screen.getByRole('button',{name:'Interrupt Buddy'}));expect(value.interrupt).toHaveBeenCalledOnce();
 await user.click(screen.getByRole('button',{name:'Stop Talk'}));expect(value.stop).toHaveBeenCalledOnce();
});
it.each([['paused','Resume Talk','resumeTalk'],['playback_blocked','Play reply','resumePlayback'],['speech_failed','Retry speech','retrySpeech']] as const)('keeps recovery available in %s',async(state,label,method)=>{
 const value={...talk(),active:true,state,error:'A recoverable voice issue.'};
 render(<BuddyVoiceStudio talk={value} disabled={false} onStart={vi.fn()} messages={[]} speechProvider={null}/>);
 expect(screen.getByRole('alert')).toHaveTextContent('A recoverable voice issue.');
 await userEvent.setup().click(screen.getByRole('button',{name:label}));expect(value[method]).toHaveBeenCalledOnce();
});
