import {render,screen,waitFor} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {LocalFaceResult} from './local-face-result';
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
