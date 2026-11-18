"""Create a readable local review artifact without altering recorded model output."""
import hashlib,json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'ai-service/app/buddy/v3'))
import echo_cbt_standalone as policy
import formatting

def main():
 folder=ROOT/'runtime-cache/buddy-audit'
 data=json.loads((folder/'reviewer-policy-comparison.json').read_text('utf-8'))
 lines=['# Buddy reviewer-policy comparison','',
 'Fictional reviewer prompts only. The checkpoint and model weights are unchanged. These generated outputs have not received renewed counselor approval or clinical validation.',
 '', 'Baseline responses are shown as recorded. Revised responses below use the final content-preserving display formatter. Above ten, the application limit notice and introductory count-label correction are applied; generated items are unchanged. Raw outputs and rejected fictional diagnostic drafts remain in the JSON report.',
 '',f"Tested generation source SHA-256: `{data.get('policySHA256')}`",
 f"Current application policy SHA-256: `{hashlib.sha256((ROOT/'ai-service/app/buddy/v3/echo_cbt_standalone.py').read_bytes()).hexdigest()}`",'']
 approved=sum(bool(row['revised'].get('reply')) for row in data['comparisons'])
 lines += [f'Generated replies approved by automated checks: {approved}/{len(data["comparisons"])}. Withheld cases remain visible below; passing these checks does not establish therapeutic quality.',
 '', 'Human review rubric: assess specific validation, an explained starting action, useful reflection, complete endings, and preserved boundaries for each pair. These are qualitative judgments, not automated clinical scores.','']
 for row in data['comparisons']:
  lines+=['## '+row['case'],'','User: '+row['prompt'],'','### Previous policy','',row['baseline'].get('reply') or '[Withheld by output checks]','','### Revised policy','']
  result=row['revised'];text=result.get('reply')
  if text:
   drafts=[d for d in row.get('syntheticDiagnosticDrafts',[]) if d['rewrite']==bool(result.get('rewrite_attempted'))]
   raw=drafts[-1]['text'] if drafts else text
   text=formatting.format_chat_response(raw,role=result.get('role','ordinary'),config=policy.style()['chat_output_format'])
   text=policy.list_limit_notice(text,row['prompt'])
  lines += [text or '[Withheld after bounded rewrite: '+', '.join(result.get('issues',[]))+']','']
 lines += ['## Requested lists','','| Requested | Actual items |','| --- | --- |']
 for row in data['lists']:
  text=row['result'].get('reply') or ''
  count=len(re.findall(r'(?<!\S)\d+[.)]\s+\S',text))
  lines += [f"| {row['requested']} | {count} |"]
 for row in data['lists']:
  text=row['result'].get('reply')
  if text:
   text=formatting.format_chat_response(text,role='steps',config=policy.style()['chat_output_format'])
   text=policy.list_limit_notice(text,f"Give me {row['requested']} tips")
  lines += ['',f"### Request for {row['requested']} items",'',text or '[Withheld by output checks]']
 lines += ['','## Real MOSS speech checks','']
 if data.get('speechNote'):lines += [data['speechNote'],f"Speech reply generation source SHA-256: `{data.get('speechPolicySHA256')}`",'']
 if data.get('speechTextNormalization'):lines += [data['speechTextNormalization'],'']
 for row in data['speech']:
  lines += [f"- {row['case']}: {len(row['segments'])} segments, minimum raw ASR word coverage {min(s['coverage'] for s in row['segments']):.1%}, minimum normalized token agreement {min(s.get('normalizedTokenAgreement',0) for s in row['segments']):.1%}, shared base resident: {row['baseStillResident']}."]
 lines += ['','ASR consistency does not establish naturalness, pronunciation quality, or clinical appropriateness. Human listening and content review remain necessary.','']
 (folder/'reviewer-policy-comparison.md').write_text('\n'.join(lines),encoding='utf-8')
 print(str(folder/'reviewer-policy-comparison.md'))

if __name__=='__main__':main()
