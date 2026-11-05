import {it,expect,vi} from 'vitest';
import {JournalService} from '../../src/features/journals/journals.service.js';
const result={schemaVersion:'echo-face-expression-v1',status:'unavailable',reason:'no_usable_face'};
function service(){
 const s:any=Object.create(JournalService.prototype);
 s.runtime={isProduction:false};s.assertAnalysisGates=vi.fn().mockResolvedValue(undefined);
 s.hasGlobalFacialConsent=vi.fn().mockResolvedValue(true);s.hasGlobalAnalysisConsent=vi.fn().mockResolvedValue(true);
 s.coreClient={face:vi.fn().mockResolvedValue(result)};
 return s;
}
it('live preview uses the same private face provider as saved captures',async()=>{
 const s=service(),image=Buffer.from('synthetic');expect(await s.evaluateFace('user',image)).toBe(result);
 expect(s.coreClient.face).toHaveBeenCalledWith(image);expect(s.assertAnalysisGates).toHaveBeenCalledTimes(2);
});
it('requires both consents before inference',async()=>{
 const s=service();s.hasGlobalFacialConsent.mockResolvedValue(false);
 await expect(s.evaluateFace('user',Buffer.from('synthetic'))).rejects.toThrow(/consent/i);
 expect(s.coreClient.face).not.toHaveBeenCalled();
});
it('does not return an in-flight result after consent is revoked',async()=>{
 const s=service();s.hasGlobalFacialConsent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
 await expect(s.evaluateFace('user',Buffer.from('synthetic'))).rejects.toThrow(/revoked/i);
});
it('reports an unavailable service and bounds captures',async()=>{
 const s=service();await expect(s.evaluateFace('user',Buffer.alloc(0))).rejects.toThrow();
 await expect(s.evaluateFace('user',Buffer.alloc(2*1024*1024+1))).rejects.toThrow();
 expect(s.coreClient.face).not.toHaveBeenCalled();s.coreClient=undefined;
 await expect(s.evaluateFace('user',Buffer.from('synthetic'))).rejects.toThrow(/unavailable/i);
});
