import {render,screen,waitFor} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {LocalFaceResult} from './local-face-result';
import userEvent from '@testing-library/user-event';
vi.mock('@/infrastructure/api/supabase-auth-token-provider',()=>({supabaseAuthTokenProvider:{getAccessToken:async()=> 'synthetic'}}));
afterEach(()=>vi.unstubAllGlobals());

it('renders native uncalibrated expression separately',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{status:'completed',result:{schemaVersion:'echo-face-expression-v1',status:'available',experimental:true,prediction:'joy',scoreType:'uncalibrated_class_probability',classProbabilities:{joy:.125,trust:.125,fear:.125,surprise:.125,sadness:.125,disgust:.125,anger:.125,anticipation:.125},quality:{warning_flags:''},modelFingerprint:'a'.repeat(64),inferenceVersion:'facemesh-1.6.0',generatedAt:'2026-10-31T01:00:00Z'}}})}));
 render(<LocalFaceResult entryId="synthetic-id"/>);
 expect(await screen.findByText('joy')).toBeInTheDocument();expect(screen.getByText(/Uncalibrated model scores/)).toBeInTheDocument();expect(screen.getByText(/separate from text emotions/)).toBeInTheDocument();
});

it('shows no-face explicitly instead of an invented emotion',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{status:'unavailable',result:{schemaVersion:'echo-face-expression-v1',status:'unavailable',reason:'no_usable_face'}}})}));
 render(<LocalFaceResult entryId="synthetic-id"/>);await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent(/No usable single face/));expect(screen.queryByText('joy')).not.toBeInTheDocument();
});

it('shows a neutral label discrepancy without a diagnosis or fused score',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{status:'completed',comparison:{status:'different',textEmotion:'sadness',faceEmotion:'joy'},result:{schemaVersion:'echo-face-expression-v1',status:'available',experimental:true,prediction:'joy',scoreType:'uncalibrated_class_probability',classProbabilities:{joy:.125,trust:.125,fear:.125,surprise:.125,sadness:.125,disgust:.125,anger:.125,anticipation:.125},quality:{},modelFingerprint:'a'.repeat(64),inferenceVersion:'test',generatedAt:'2026-11-05T01:00:00Z'}}})}));
 render(<LocalFaceResult entryId="synthetic-id"/>);
 const difference=await screen.findByText('Different leading labels');expect(difference).toHaveClass('font-semibold','text-primary');expect(screen.getByText(/Written text: sadness/)).toBeInTheDocument();expect(screen.getByText(/comparison does not establish how you feel/)).toBeInTheDocument();
});
it('identifies which legacy signal needs refreshing without hiding the available face result',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{status:'completed',comparison:{status:'unavailable',reason:'stale_revision',textState:'current',faceState:'unverified',textEmotion:'sadness',faceEmotion:'trust'},result:{schemaVersion:'echo-face-expression-v1',status:'available',experimental:true,prediction:'trust',scoreType:'uncalibrated_class_probability',classProbabilities:{joy:0,trust:1,fear:0,surprise:0,sadness:0,disgust:0,anger:0,anticipation:0},quality:{},modelFingerprint:'a'.repeat(64),inferenceVersion:'test',generatedAt:'2026-11-18T01:00:00Z'}}})}));
 render(<LocalFaceResult entryId="synthetic-id"/>);
 expect(await screen.findByText(/saved face capture has no verifiable/)).toBeVisible();
 expect(screen.getByText(/Written text: sadness/)).toBeVisible();
 expect(screen.getByRole('button',{name:'Capture expression again'})).toBeVisible();
 expect(screen.queryByRole('button',{name:'Analyze current text'})).not.toBeInTheDocument();
 expect(screen.getByText('trust')).toBeVisible();
});
it('requests text refresh from the journal-only endpoint',async()=>{
 let refreshed=false;
 const fetcher=vi.fn(async(_url:unknown,options?:RequestInit)=>{
  if(options?.method==='POST'){refreshed=true;return {ok:true,json:async()=>({data:{queued:true}})};}
  return {ok:true,json:async()=>({data:{status:'completed',comparison:refreshed?{status:'different',textEmotion:'sadness',faceEmotion:'joy'}:{status:'unavailable',reason:'stale_revision',textState:'unverified',faceState:'current'}}})};
 });
 vi.stubGlobal('fetch',fetcher);render(<LocalFaceResult entryId="synthetic-id"/>);
 await userEvent.setup().click(await screen.findByRole('button',{name:'Analyze current text'}));
 expect(fetcher.mock.calls.some(([url,options])=>String(url).endsWith('/journals/synthetic-id/reanalyze')&&options?.method==='POST')).toBe(true);
 expect(await screen.findByText('Different leading labels')).toBeVisible();
});
