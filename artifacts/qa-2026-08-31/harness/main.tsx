import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider,useEchoTheme} from '@/shared/theme/theme-provider';
import {dashboardInsightsSchema} from '@echo/contracts';
import {AnalysisInsightsDashboard} from '@/features/dashboard/components/analysis-insights-dashboard';
import {JournalEditorView} from '@/features/journal/view/journal-editor-view';
import {JournalAnalysisPanel} from '@/features/journal/components/journal-analysis-panel';
import {PrivacySettingsView} from '@/features/settings/view/settings-views';
import {BuddyAnalysisHandoff} from '@/features/buddy/components/buddy-analysis-handoff';
import {configure,setGateRejected,insights,analysis,journalId,jobId,calls} from './fixtures';
import '../../../frontend/src/app/globals.css';
import './qa.css';
const states:{[key:string]:number}={queued:5,waiting_for_provider:0,safety_checking:10,analyzing_emotions:30,classifying_distress:45,estimating_screening:55,generating_recommendation:65,aggregating_week:98,retrying:70,completed:100,failed:70,safety_action_required:10};
dashboardInsightsSchema.parse(insights);
function ThemeToggle(){const theme=useEchoTheme();return <button onClick={()=>theme.setMode(theme.resolvedMode==='dark'?'light':'dark')}>{theme.resolvedMode==='dark'?'Light preview':'Dark preview'}</button>}
function QA(){
 const initial=window.location.pathname.startsWith('/buddy')?'buddy':window.location.pathname.startsWith('/journal/')?'detail':'editor';
 const [view,setView]=useState(initial),[draft,setDraft]=useState(''),[revision,setRevision]=useState(0);
 const [chosen,setChosen]=useState('waiting_for_provider');
 const [requestSummary,setRequestSummary]=useState('');
 const selectView=(next:string)=>{localStorage.removeItem('echo:active-analysis');setView(next);setRevision(n=>n+1)};
 const openStatus=()=>{configure(chosen,states[chosen]);window.dispatchEvent(new CustomEvent('echo:analysis-submitted',{detail:{journalId,analysisJobId:jobId,status:chosen==='waiting_for_provider'?'waiting_for_provider':'queued'}}))};
 return <ThemeProvider key={revision}>
  <header className="qa-banner"><strong>ECHO · QA fixture preview</strong><span>Actual components · synthetic data · no remote writes · not end-to-end evidence</span></header>
  <nav className="qa-controls" aria-label="QA scenarios">
   {['editor','dashboard','empty','detail','privacy','buddy'].map(item=><button key={item} onClick={()=>selectView(item)} aria-pressed={view===item}>{item}</button>)}
   <label><input type="checkbox" onChange={e=>setGateRejected(e.target.checked)}/> Simulate consent gate error</label>
   <label>Analysis state <select value={chosen} onChange={e=>setChosen(e.target.value)}>{Object.keys(states).map(x=><option key={x}>{x}</option>)}</select></label>
   <button onClick={openStatus}>Show state</button>
   <button onClick={()=>configure(chosen,states[chosen])}>Publish status for same job</button>
   <ThemeToggle/>
  </nav>
  <main className="qa-main">
   {view==='editor'?<JournalEditorView/>:null}
   {view==='dashboard'||view==='empty'?<><h1>Journal analysis dashboard</h1><AnalysisInsightsDashboard insights={view==='empty'?undefined:insights as any}/></>:null}
   {view==='detail'?<><h1>Your journal insight</h1><p className="qa-description">Simulated result detail — actual analysis panel</p><JournalAnalysisPanel analysis={analysis as any}/></>:null}
   {view==='privacy'?<PrivacySettingsView/>:null}
   {view==='buddy'?<><h1>ECHO Buddy · approved activity</h1><BuddyAnalysisHandoff onChoose={setDraft}/><label className="qa-draft">Message draft — preview only<textarea value={draft} onChange={e=>setDraft(e.target.value)}/></label><p>Nothing is sent from this QA fixture.</p></>:null}
  </main>
  <footer className="qa-footer"><button onClick={()=>{const submissions=calls.filter(x=>x.operation==='journal.create');setRequestSummary(submissions.map((x,i)=>`${i+1}: ${x.analysis?'analysis':'private'}; ${i===0?'initial key':x.key===submissions[i-1].key?'same key':'new key'}`).join(' | '))}}>Read fixture request summary</button><span>{requestSummary || 'Real authentication, database persistence and Realtime are not exercised here.'}</span></footer>
 </ThemeProvider>
}
createRoot(document.getElementById('root')!).render(<QA/>);
