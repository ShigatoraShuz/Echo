"""Opt-in real GPU comparison and read-aloud; fictional review prompts only."""
import json, os, re, subprocess, sys, types, time, hashlib, difflib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'ai-service'))
from app.buddy import worker
from app.buddy.process import Process
from app.buddy.config import paths

CASES=[
 ('P1',"Lately, I've been feeling empty and unmotivated, even when nothing particularly bad has happened. Things I used to enjoy don't feel exciting anymore, and sometimes I feel like I'm not good enough compared to everyone else. I've been feeling this way for the past few weeks, and I don't really know why. How can I start feeling better?"),
 ('P2',"I have so many school requirements, deadlines, and responsibilities that I don't even know where to start anymore. Whenever I try to work, I get overwhelmed and end up procrastinating, which makes me feel even worse. I'm exhausted and scared that I won't finish everything on time. What can I do to manage this without feeling so overwhelmed?"),
 ('P3',"I keep overthinking everything, especially my future and whether I'll be successful. Even when I'm trying my best, I always worry that I'll fail or disappoint my family. It's getting hard to relax because my mind keeps imagining the worst things that could happen. How can I stop worrying so much?"),
 ('P1-paraphrase','For several weeks I have lost interest in everything and keep comparing myself with classmates. What is a manageable starting point?'),
 ('P2-paraphrase','I freeze when I see my assignment deadlines. How can I choose something to start today?'),
 ('P3-paraphrase','My family expects success and I cannot stop picturing failure. How can I work with this worry?'),
]

def main():
 if '--verify-existing' in sys.argv:
  path=ROOT/'runtime-cache/buddy-audit/reviewer-policy-comparison.json';report=json.loads(path.read_text('utf-8'))
  sys.path.insert(0,str(ROOT/'ai-service/app/buddy/v3'))
  from echo_cbt_standalone import quality_issues
  for row in report['comparisons']:
   result=row['revised'];row['finalPolicyChecks']=quality_issues(result['reply'],row['prompt'],result.get('role','ordinary'),False) if result.get('reply') else []
  for row in report['lists']:row['actual']=len(re.findall(r'(?<!\S)(\d+)[.)]\s+\S',row['result'].get('reply') or ''))
  from app.buddy.text_audio import prepare
  def speech_words(text):
   return re.findall('[a-z]+',re.sub(r'\bwork\s+load\b','workload',prepare(text,'English',spoken=True).lower()))
  for row in report['speech']:
   for segment in row['segments']:
    segment['normalizedTokenAgreement']=difflib.SequenceMatcher(None,speech_words(segment['text']),speech_words(segment['recognized'])).ratio()
  report['speechTextNormalization']='Numerals converted to spoken words and work load/workload treated as the same compound. Raw ASR and coverage retained; token agreement also checks order.'
  report['countVerification']='Rechecked using inline markers, matching generation validation; no model output changed.'
  path.write_text(json.dumps(report,indent=2),encoding='utf-8')
  assert len(report['comparisons'])==6 and len(report['lists'])==5 and len(report['speech'])==2
  assert all(row['revised'].get('reply') or row['revised'].get('needs_review') for row in report['comparisons'])
  assert all(not row['finalPolicyChecks'] for row in report['comparisons'])
  assert all(row['actual']==min(row['requested'],10) for row in report['lists'])
  assert all(row['baseStillResident'] and all(s['coverage']>=.75 for s in row['segments']) for row in report['speech'])
  assert all(all(s['normalizedTokenAgreement']>=.95 for s in row['segments']) for row in report['speech'])
  withheld=[row['case'] for row in report['comparisons'] if not row['revised'].get('reply')]
  print(json.dumps({'listCounts':[(r['requested'],r['actual']) for r in report['lists']],'speechChecks':len(report['speech']),'structuralChecksPassed':True,'approvedReplies':6-len(withheld),'withheldCases':withheld,'humanReviewRequired':True}),flush=True)
  return
 config=json.loads((ROOT/'backend/.local-development/buddy-runtime.json').read_text('utf-8-sig'))
 for field,key in [('cbtPython','BUDDY_CBT_PYTHON'),('mossPython','BUDDY_MOSS_PYTHON'),('whisperPython','BUDDY_WHISPER_PYTHON'),('mossRoot','BUDDY_MOSS_NATIVE_ROOT')]:os.environ[key]=config[field]
 worker.cbt({'check':True});engine=worker.ENGINE
 source=subprocess.check_output(['git','show','HEAD:ai-service/app/buddy/v3/echo_cbt_standalone.py'],cwd=ROOT,encoding='utf-8')
 old=types.ModuleType('review_baseline');old.__file__=str(ROOT/'ai-service/app/buddy/v3/echo_cbt_standalone.py');sys.modules[old.__name__]=old
 exec(compile(source,old.__file__,'exec'),old.__dict__)
 old.style=lambda:json.loads(subprocess.check_output(['git','show','HEAD:ai-service/app/buddy/v3/style_config.json'],cwd=ROOT,encoding='utf-8'))
 baseline=old.LocalCBT.__new__(old.LocalCBT);baseline.__dict__.update(engine.__dict__)
 drafts=[];attempt=engine._attempt
 def traced(*args,**kwargs):
  result=attempt(*args,**kwargs);drafts.append({'rewrite':kwargs.get('retry',False),'issues':result.get('issues'),'text':result.get('_raw_reply')});return result
 engine._attempt=traced
 report={'comparisons':[],'lists':[],'speech':[],'limitations':['Generated comparisons require human review; no renewed counselor approval.','Synthetic audio and ASR are not listening-quality validation.']}
 report['policySHA256']=hashlib.sha256((ROOT/'ai-service/app/buddy/v3/echo_cbt_standalone.py').read_bytes()).hexdigest()
 path=ROOT/'runtime-cache/buddy-audit/reviewer-policy-comparison.json'
 def save():
  path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(report,indent=2),encoding='utf-8')
 moss=None;whisper=None
 try:
  previous=ROOT/'runtime-cache/buddy-audit/reviewer-policy-comparison.json'
  if '--recheck-replies' in sys.argv and previous.exists():
   earlier=json.loads(previous.read_text('utf-8'))
   archive=previous.with_name('reviewer-policy-speech-validation.json')
   if not archive.exists():archive.write_text(json.dumps(earlier,indent=2),encoding='utf-8')
   report['speech']=earlier['speech'];report['speechPolicySHA256']=earlier.get('speechPolicySHA256',earlier['policySHA256'])
   report['speechNote']='Real speech checks used the recorded earlier approved replies. Speech implementation is unchanged; final generation policy is compared separately.'
  baseline_path=previous.with_name('reviewer-policy-speech-validation.json')
  if not baseline_path.exists():baseline_path=previous
  cached_baselines={row['case']:row['baseline'] for row in json.loads(baseline_path.read_text('utf-8')).get('comparisons',[])} if '--reuse-baseline' in sys.argv and baseline_path.exists() else {}
  if '--resume' in sys.argv and previous.exists():report['comparisons']=json.loads(previous.read_text('utf-8'))['comparisons']
  cases=CASES[:2] if '--diagnose' in sys.argv else CASES
  for case,prompt in ([] if report['comparisons'] else cases):
   pair={'case':case,'prompt':prompt}
   for label,runtime in [('baseline',baseline),('revised',engine)]:
    if label=='baseline' and case in cached_baselines:
     pair[label]=cached_baselines[case];continue
    start=time.perf_counter();result=runtime.reply([{'role':'user','content':prompt}]);pair[label]=result;print(json.dumps({'case':case,'policy':label,'approved':bool(result.get('reply')),'seconds':time.perf_counter()-start}),flush=True)
   report['comparisons'].append(pair)
   pair['syntheticDiagnosticDrafts']=list(drafts);drafts.clear()
   save()
  if '--diagnose' in sys.argv:return
  for count in (1,3,7,10,12):
   result=engine.reply([{'role':'user','content':f'Give me {count} practical tips for starting school assignments.'}]);text=result.get('reply') or '';markers=re.findall(r'(?<!\S)(\d+)[.)]\s+\S',text)
   report['lists'].append({'requested':count,'actual':len(markers),'result':result});print(json.dumps({'requested':count,'actual':len(markers),'approved':bool(text)}),flush=True)
   save()
  if '--recheck-replies' in sys.argv:return
  engine.torch.cuda.empty_cache()
  moss=Process(paths()['moss'],'moss');moss.call({'check':True})
  whisper=Process(paths()['whisper'],'whisper');whisper.call({'check':True})
  from app.buddy.text_audio import prepare
  from app.buddy.sentences import sentences
  import base64,numpy as np
  from scipy.signal import resample_poly
  for label,text in [('ordinary',report['comparisons'][1]['revised'].get('reply')),('ten-items',report['lists'][3]['result'].get('reply'))]:
   if not text:raise AssertionError(f'No approved reply for {label}')
   parts=sentences(prepare(text,'English'));rows=[]
   for part in parts:
    start=time.perf_counter();segment=moss.call({'texts':[part],'language':'English'})['segments'][0]
    wave=np.frombuffer(base64.b64decode(segment['audio']),dtype='<i2').reshape(-1,2).astype(np.float32)/32768
    mono=resample_poly(wave.mean(axis=1),1,3);pcm=(np.clip(mono,-1,1)*32767).astype('<i2').tobytes()
    recognized=whisper.call({'audio':base64.b64encode(pcm).decode(),'language':'English'})['text']
    expected=re.findall('[a-z]+',part.lower());actual=set(re.findall('[a-z]+',recognized.lower()));coverage=sum(w in actual for w in expected)/max(1,len(expected))
    rows.append({'text':part,'recognized':recognized,'coverage':coverage,'durationSeconds':len(wave)/48000,'seconds':time.perf_counter()-start});print(json.dumps({'speech':label,'segment':len(rows),'coverage':coverage}),flush=True)
   report['speech'].append({'case':label,'segments':rows,'baseStillResident':next(engine.model.parameters()).is_cuda})
 finally:
  if whisper:whisper.close()
  if moss:moss.close()
  path=ROOT/'runtime-cache/buddy-audit/reviewer-policy-comparison.json';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(report,indent=2),encoding='utf-8')
 assert all(row['actual']==min(row['requested'],10) for row in report['lists'])
 assert all(row['baseStillResident'] and all(s['coverage']>=.75 for s in row['segments']) for row in report['speech'])

if __name__=='__main__':main()
