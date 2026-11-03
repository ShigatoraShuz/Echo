"""Explicit local synthesis checks; outputs remain in results/."""
import json
from engines import Engines,ROOT
from runner import generate
CASES={
 'English':['You can take 3 slow breaths. You are not alone.','You can pause and notice how you feel. '*8+'This is the final sentence.'],
 'Filipino':['Huminga nang 3 beses. Hindi ka nag-iisa.','Maaari kang magpahinga at huminga nang dahan-dahan. '*6+'Ito ang huling pangungusap.'],
 'Taglish':['Take 3 slow breaths. Hindi ka nag-iisa.','Take a moment to rest. Maaari kang huminga nang dahan-dahan. '*6+'This is the final sentence.']}
if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--model',choices=['MOSS'],default='MOSS');args=p.parse_args()
    engine=Engines();reports=[]
    try:
        for language,texts in CASES.items():
            for text in texts:
                report=generate(engine,dict(language=language,text=text),lambda x:print(x,flush=True));reports.append(report);print(language,report['status'],report.get('error',''),flush=True)
    finally:engine.close()
    (ROOT/'validation-buddy.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
    raise SystemExit(any(r['status']!='complete' for r in reports))
