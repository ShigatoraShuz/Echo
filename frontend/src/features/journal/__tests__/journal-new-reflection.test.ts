import {act,renderHook,waitFor} from '@testing-library/react';
import {beforeEach,it,expect,vi} from 'vitest';
import {useJournalEditorViewModel} from '../view-model/use-journal-editor-view-model';
const service=vi.hoisted(()=>({getDraft:vi.fn(),saveDraft:vi.fn(),deleteDraft:vi.fn(),createEntry:vi.fn(),attachDraftImages:vi.fn()}));
vi.mock('@/services/journal/journal-service.factory',()=>({getJournalService:()=>service}));
vi.mock('@/config/environment',()=>({env:{enableAnalysisFixtures:false}}));
const old={id:'40000000-0000-4000-8000-000000000001',submissionKey:'40000000-0000-4000-8000-000000000002',title:'Earlier title',body:'Earlier private writing',emotions:['sadness'],tags:['old'],privacyStatus:'private' as const,analysisConsent:true,updatedAt:'2026-11-04T00:00:00Z'};
beforeEach(()=>{vi.clearAllMocks();service.getDraft.mockResolvedValue({success:true,data:old});service.saveDraft.mockImplementation(async(d:unknown)=>({success:true,data:d}));service.deleteDraft.mockResolvedValue({success:true});});
it('New remains blank while preserving an earlier saved draft; saving cannot overwrite it',async()=>{
 const {result}=renderHook(()=>useJournalEditorViewModel());await waitFor(()=>expect(result.current.draftReady).toBe(true));
 expect(result.current.title).toBe('');expect(result.current.body).toBe('');expect(result.current.tags).toEqual([]);expect(result.current.emotions).toEqual([]);expect(result.current.shouldRestorePhotos).toBe(false);expect(result.current.previousDraft?.id).toBe(old.id);
 act(()=>result.current.setBody('New writing'));
 await act(async()=>{expect(await result.current.saveDraftNow()).toBe(false);});
 expect(service.saveDraft).not.toHaveBeenCalled();expect(service.deleteDraft).not.toHaveBeenCalled();
});
it('explicit Resume restores only the selected current draft and its photo eligibility',async()=>{
 const {result}=renderHook(()=>useJournalEditorViewModel({resumeDraft:true}));await waitFor(()=>expect(result.current.draftReady).toBe(true));
 expect(result.current.body).toBe(old.body);expect(result.current.shouldRestorePhotos).toBe(true);expect(result.current.previousDraft).toBeNull();
});
it('explicit discard preserves new writing and uses a guarded delete before new creation',async()=>{
 const {result}=renderHook(()=>useJournalEditorViewModel());await waitFor(()=>expect(result.current.draftReady).toBe(true));act(()=>result.current.setBody('New text retained'));
 await act(async()=>{expect(await result.current.discardPreviousDraft()).toBe(true);});
 expect(service.deleteDraft).toHaveBeenCalledWith(old.id,{expectedSubmissionKey:old.submissionKey});expect(result.current.body).toBe('New text retained');
 await act(async()=>{expect(await result.current.saveDraftNow()).toBe(true);});expect(service.saveDraft).toHaveBeenCalledWith(expect.objectContaining({body:'New text retained',draftIntent:'create',expectedSubmissionKey:null}));
});
it('failed or stale discard keeps the earlier draft protected',async()=>{
 service.deleteDraft.mockResolvedValue({success:false,error:{message:'Draft changed in another tab'}});
 const {result}=renderHook(()=>useJournalEditorViewModel());await waitFor(()=>expect(result.current.draftReady).toBe(true));
 await act(async()=>{expect(await result.current.discardPreviousDraft()).toBe(false);});expect(result.current.previousDraft?.id).toBe(old.id);expect(service.saveDraft).not.toHaveBeenCalled();
});
it('applying account consent on a blank page does not persist an empty draft',async()=>{
 service.getDraft.mockResolvedValue({success:true,data:null});const {result}=renderHook(()=>useJournalEditorViewModel());await waitFor(()=>expect(result.current.draftReady).toBe(true));
 act(()=>result.current.setAnalysisConsent(true));await act(async()=>{expect(await result.current.saveDraftNow()).toBe(true);});expect(service.saveDraft).not.toHaveBeenCalled();
});
it('a stale save acknowledgement after unmount cannot populate a fresh New editor',async()=>{
 service.getDraft.mockResolvedValue({success:true,data:null});let finish!:(v:unknown)=>void;service.saveDraft.mockImplementation(()=>new Promise(r=>finish=r));
 const first=renderHook(()=>useJournalEditorViewModel());await waitFor(()=>expect(first.result.current.draftReady).toBe(true));act(()=>first.result.current.setBody('Old pending text'));
 let saving!:Promise<boolean>;act(()=>{saving=first.result.current.saveDraftNow();});await waitFor(()=>expect(service.saveDraft).toHaveBeenCalled());first.unmount();
 const next=renderHook(()=>useJournalEditorViewModel());await waitFor(()=>expect(next.result.current.draftReady).toBe(true));
 await act(async()=>{finish({success:true,data:{...old,body:'Old pending text'}});await saving;});expect(next.result.current.body).toBe('');expect(next.result.current.autosaveStatus).toBe('idle');
});

it('successful publication retains writing until explicit New clears it without reusing identity',async()=>{
 service.getDraft.mockResolvedValue({success:true,data:null});service.attachDraftImages.mockResolvedValue({success:true,data:{attached:0}});
 service.createEntry.mockResolvedValue({success:true,data:{kind:'analysis',submission:{journalId:'saved-journal',analysisJobId:'job',status:'queued'}}});
 const {result}=renderHook(()=>useJournalEditorViewModel());await waitFor(()=>expect(result.current.draftReady).toBe(true));
 act(()=>{result.current.setTitle('Private reflection');result.current.setBody('This is a completely new private reflection.');result.current.setAnalysisConsent(true);});
 await act(async()=>{await result.current.save();});
 expect(result.current.title).toBe('Private reflection');expect(result.current.body).toBe('This is a completely new private reflection.');expect(result.current.wordCount).toBeGreaterThan(0);
 const firstKey=service.createEntry.mock.calls[0][1].idempotencyKey;
 act(()=>result.current.reset());expect(result.current.title).toBe('');expect(result.current.body).toBe('');expect(result.current.tags).toEqual([]);expect(result.current.emotions).toEqual([]);expect(result.current.analysisSubmission).toBeNull();expect(result.current.previousDraft).toBeNull();expect(result.current.analysisConsent).toBe(true);expect(result.current.shouldRestorePhotos).toBe(false);
 act(()=>{result.current.setTitle('Next reflection');result.current.setBody('Another completely new private reflection.');});
 await act(async()=>{await result.current.save();});
 expect(service.createEntry.mock.calls[1][1].idempotencyKey).not.toBe(firstKey);
 expect(service.saveDraft.mock.calls[1][0]).toEqual(expect.objectContaining({draftIntent:'create',expectedSubmissionKey:null}));
});

it('leaving during autosave stops a queued Save before it can submit a reflection',async()=>{
 service.getDraft.mockResolvedValue({success:true,data:null});let finish!:(v:unknown)=>void;
 service.saveDraft.mockImplementation(()=>new Promise(r=>finish=r));
 const editor=renderHook(()=>useJournalEditorViewModel());await waitFor(()=>expect(editor.result.current.draftReady).toBe(true));
 act(()=>{editor.result.current.setTitle('Pending reflection');editor.result.current.setBody('This reflection must remain a draft when leaving.');});
 let autosave!:Promise<boolean>;act(()=>{autosave=editor.result.current.saveDraftNow();});await waitFor(()=>expect(service.saveDraft).toHaveBeenCalledTimes(1));
 let submission!:Promise<void>;act(()=>{submission=editor.result.current.save();});editor.unmount();
 await act(async()=>{finish({success:true,data:service.saveDraft.mock.calls[0][0]});await autosave;await submission;});
 expect(service.saveDraft).toHaveBeenCalledTimes(1);expect(service.createEntry).not.toHaveBeenCalled();
});


it('retains writing through delayed Save and rejects duplicate clicks while models queue',async()=>{
 service.getDraft.mockResolvedValue({success:true,data:null});service.attachDraftImages.mockResolvedValue({success:true,data:{attached:0}});
 let finish!:(v:unknown)=>void;service.createEntry.mockImplementation(()=>new Promise(r=>finish=r));
 const {result}=renderHook(()=>useJournalEditorViewModel());await waitFor(()=>expect(result.current.draftReady).toBe(true));
 act(()=>{result.current.setTitle('Kept title');result.current.setBody('This writing stays visible while models load.');result.current.setTags(['keep']);result.current.setEmotions(['joy']);});
 let saving!:Promise<void>;act(()=>{saving=result.current.save();});await waitFor(()=>expect(service.createEntry).toHaveBeenCalledTimes(1));
 expect(result.current.body).toBe('This writing stays visible while models load.');
 await act(async()=>result.current.save());expect(service.createEntry).toHaveBeenCalledTimes(1);
 await act(async()=>{finish({success:true,data:{kind:'analysis',submission:{journalId:'saved',analysisJobId:'job',status:'waiting_for_provider'}}});await saving;});
 expect(result.current.title).toBe('Kept title');expect(result.current.tags).toEqual(['keep']);expect(result.current.emotions).toEqual(['joy']);
 await act(async()=>result.current.save());expect(service.createEntry).toHaveBeenCalledTimes(1);
 act(()=>result.current.reset());expect(result.current.body).toBe('');expect(result.current.tags).toEqual([]);expect(result.current.emotions).toEqual([]);
});
it('failed save preserves fields and a private successful save also stays visible',async()=>{
 service.getDraft.mockResolvedValue({success:true,data:null});service.attachDraftImages.mockResolvedValue({success:true,data:{attached:0}});
 service.createEntry.mockResolvedValueOnce({success:false,error:{message:'Local model unavailable'}}).mockResolvedValue({success:true,data:{id:'saved-private'}});
 const {result}=renderHook(()=>useJournalEditorViewModel());await waitFor(()=>expect(result.current.draftReady).toBe(true));
 act(()=>{result.current.setTitle('Keep me');result.current.setBody('This private writing must not disappear.');});
 await act(async()=>result.current.save());expect(result.current.body).toBe('This private writing must not disappear.');expect(result.current.error).toBe('Local model unavailable');
 await act(async()=>result.current.save());expect(result.current.title).toBe('Keep me');expect(result.current.savedEntry?.id).toBe('saved-private');
});
