import {expect,it} from 'vitest';
import {speechErrorMessage} from './speech-errors';
it.each(['AI_TRANSPORT_UNAVAILABLE','AI_TRANSPORT_AUTH_FAILED','AI_TRANSPORT_CONNECTION_FAILED','AI_TRANSPORT_RATE_LIMITED','AI_TRANSPORT_TIMEOUT','BUDDY_NANO_LOAD_TIMEOUT','BUDDY_NANO_PREFLIGHT_OR_INFERENCE_FAILED'])('explains %s without the generic analysis error',code=>{
 const message=speechErrorMessage(code);expect(message).not.toContain('Local analysis');expect(message.length).toBeGreaterThan(20);
});
it('does not echo arbitrary errors or rejected drafts',()=>{
 expect(speechErrorMessage('private draft E:/secret')).not.toContain('private draft');
 expect(speechErrorMessage(undefined)).toContain('approved answer is retained');
});
