// QA ONLY. In-memory dependencies; no network or production records.
export const journalId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const jobId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const resultId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const handoffId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
export let selectedStatus='waiting_for_provider';
export let selectedProgress=0;
export let rejectAnalysis=false;
export let calls:Array<{operation:string;key?:string;analysis?:boolean}>=[];
export const configure=(status:string,progress:number)=>{selectedStatus=status;selectedProgress=progress};
export const setGateRejected=(value:boolean)=>{rejectAnalysis=value};
export const env={dataAdapter:'mock',apiBaseUrl:'http://127.0.0.1:4310/qa-memory-only',enableAnalysisFixtures:true,enableBuddy:true,enableFacialAnalysis:false,enableRiskInsights:true,enableNotifications:false,enableDataExport:true};
export const getSupabasePublicConfig=()=>null;
export const createBrowserSupabaseClient=()=>{throw new Error('QA: Realtime intentionally disconnected; polling fixture only')};
export const supabaseAuthTokenProvider={getAccessToken:async()=>null};
export const recommendation={id:'ffffffff-ffff-4fff-8fff-ffffffffffff',title:'Pause and name what helped',description:'Notice one small action that supported you today, then choose a kind next step.',activity:'reflection',version:'qa-fixture-v1'};
export const distribution=[{emotion:'joy',value:.15},{emotion:'calm',value:.4},{emotion:'sadness',value:.1},{emotion:'anxiety',value:.15},{emotion:'anger',value:.05},{emotion:'hope',value:.15}];
export const result={emotionDistribution:distribution,dominantEmotion:'calm',emotionConfidence:.82,distressBand:'low',distressConfidence:.81,depressiveSymptomRange:{lower:2,upper:5},recommendationFeatures:['grounding'],providerName:'development_stub',modelVersion:'qa-fixture-v1',schemaVersion:'echo-journal-analysis-v1',thresholdVersion:'qa-v1',isSimulated:true};
export const insights={latestResultId:resultId,latest:result,recommendation,emotionTrend:[0,1,2].map((i)=>({date:`2026-08-${27+i}`,values:Object.fromEntries(distribution.map(x=>[x.emotion,x.value+(x.emotion==='calm'?i*.04:x.emotion==='anxiety'?-i*.04:0)])),isSimulated:true})),distressTrend:[0,1,2].map(i=>({date:`2026-08-${27+i}`,band:'low',value:.2,isSimulated:true}))};
export const entry={id:journalId,title:'A small moment of calm',body:'This is synthetic QA text. Today I took a short walk, paused beside a tree, and noticed a moment of calm. No personal journal data is used in this preview.',excerpt:'Synthetic QA reflection — no private journal content.',mood:'calm',emotions:['peaceful'],tags:['qa'],privacyStatus:'private',analysisConsent:true,riskScore:12,riskBand:'low',summary:'Synthetic fixture only.',perspective:recommendation.description,createdAt:'2026-08-31',updatedAt:'2026-08-31'};
export const analysis={id:resultId,entryId:journalId,summary:'Simulated QA result',perspective:recommendation.description,moodInsight:'Calm — 40% of the simulated distribution',riskIndication:'Low distress; confidence 81%. Not a diagnosis.',isDemoData:true,createdAt:'2026-08-31',result};
export const settings={profile:{displayName:'QA Preview',timezone:'Asia/Manila',themeVariant:'echo-calm',themeMode:'light',avatarPath:null},privacy:{journalAiAnalysisEnabled:false,journalPrivate:true,facialAnalysisEnabled:false,crisisSupportVisible:true,lockScreenPrivate:true},notifications:{emailEnabled:false,pushEnabled:false,inAppEnabled:true,journalRemindersEnabled:false,wellbeingRemindersEnabled:false,insightNotificationsEnabled:false,reminderTime:null,reminderTimezone:null},trustedContacts:[{id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',contactName:'Sample trusted person',contactEmail:null,contactPhone:null,relationship:'friend',verified:true,isPrimary:true,permissionAcknowledged:true}],latestExport:null,exportHistory:[],deletionRequest:null};
export const settingsService={get:async()=>structuredClone(settings),updatePrivacy:async(updates:any)=>{Object.assign(settings.privacy,updates);return structuredClone(settings.privacy)},getSecurityAuditEvents:async()=>({auditEvents:[]})};
let saved=false;
const service={
 listEntries:async()=>({success:true,data:{entries:saved?[entry]:[],pagination:{page:1,pageSize:10,totalItems:saved?1:0,totalPages:1}}}),
 getEntry:async()=>({success:true,data:entry}),getAnalysis:async()=>({success:true,data:analysis}),
 getDraft:async()=>({success:true,data:null}),saveDraft:async(draft:any)=>({success:true,data:draft}),deleteDraft:async()=>({success:true,data:undefined}),
 createEntry:async(input:any,options:any)=>{
   calls.push({operation:'journal.create',key:options.idempotencyKey,analysis:input.analysisConsent});
   if(input.analysisConsent&&rejectAnalysis)return{success:false,error:{code:'FORBIDDEN',message:'Analysis requires current global consent. Your draft is preserved. Turn analysis off explicitly to save privately.'}};
   saved=true;
   return input.analysisConsent?{success:true,data:{kind:'analysis',submission:{journalId,analysisJobId:jobId,status:'queued'}}}:{success:true,data:{...entry,...input}};
 },
 getAnalysisStatus:async()=>({success:true,data:{jobId,journalId,status:selectedStatus,progress:selectedProgress,updatedAt:new Date().toISOString()}}),
 resolveSupportResources:async()=>({success:true,data:[{id:'qa-resource',resource_name:'QA resource presentation',organization_name:'Fixture only — not a verified support directory',availability_text:'Use the live verified directory for actual help'}]}),
};
export const getJournalService=()=>service;
export function createApiClient(){return{
 get:async(path:string)=>{
  if(path==='/settings')return{success:true,data:structuredClone(settings)};
  if(path.startsWith('/buddy/handoffs/'))return{success:true,data:{id:handoffId,expiresAt:'2026-11-29',recommendation}};
  throw new Error(`No QA fixture for ${path}`);
 },
 post:async(path:string,data:any)=>{
   calls.push({operation:path});
   if(path==='/support-contact-requests')return{success:true,data:{status:'review_required'}};
   if(path==='/buddy/handoffs')return{success:true,data:{handoffId}};
   throw new Error(`No QA fixture for ${path}`);
 },
 patch:async()=>{throw new Error('QA mutation not modeled')},
}}
