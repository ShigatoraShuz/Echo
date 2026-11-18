import {expect,it,vi} from 'vitest';
import {JournalService} from '../../src/features/journals/journals.service';
import {AuthorizationError} from '../../src/shared/errors/app-error';
const context=()=>({get:vi.fn().mockResolvedValue({id:'owned',title:'Private reflection',body:'Saved text',analysis_consent:true}),assertAnalysisGates:vi.fn().mockResolvedValue(undefined),hasGlobalAnalysisConsent:vi.fn().mockResolvedValue(true),getLatestAnalysis:vi.fn().mockResolvedValue({id:'saved-result'}),faceStatus:vi.fn().mockResolvedValue({status:'not_requested',result:null})});
it('exports only owner-scoped saved analysis and never requests inference',async()=>{
 const service=context();const output=await JournalService.prototype.getExportData.call(service as any,'owner','owned');
 expect(output.analysis).toEqual({id:'saved-result'});expect(service.get).toHaveBeenCalledWith('owner','owned');
 expect(service.getLatestAnalysis).toHaveBeenCalledWith('owner','owned');expect(service.faceStatus).toHaveBeenCalledWith('owner','owned');
});
it.each(['entry','global','access'])('keeps saved results out of the export when %s consent/access is unavailable',async(reason)=>{
 const service=context();
 if(reason==='entry')service.get.mockResolvedValue({id:'owned',title:'Private reflection',body:'Saved text',analysis_consent:false});
 if(reason==='global')service.hasGlobalAnalysisConsent.mockResolvedValue(false);
 if(reason==='access')service.assertAnalysisGates.mockRejectedValue(new AuthorizationError());
 const output=await JournalService.prototype.getExportData.call(service as any,'owner','owned');
 expect(output.entry.body).toBe('Saved text');expect(output.analysis).toBeNull();expect(output.face).toBeNull();
 expect(service.getLatestAnalysis).not.toHaveBeenCalled();expect(service.faceStatus).not.toHaveBeenCalled();
});
