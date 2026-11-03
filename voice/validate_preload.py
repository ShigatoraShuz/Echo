"""Explicit real GPU residency and context stress test; does not use fake models."""
import argparse,json,time,uuid
from resident import Pool,ROOT
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--experimental',action='store_true');args=p.parse_args();pool=Pool();report={'status':'running','trials':[],'listeningQuality':'unverified'}
    try:
        report['startup']=pool.load();pids=report['startup']['workers'];history=[]
        for text in ['I am overwhelmed with schoolwork.','List steps that I could do.','Please explain how to apply those steps over the next week.']:
            history.append({'role':'user','content':text});start=time.perf_counter();reply=pool.call('cbt',{'messages':history})
            if reply.get('needs_review') or not reply.get('reply'):raise RuntimeError('CBT withheld test response; inspect policy diagnostics: '+str(reply.get('issues')))
            history.append({'role':'assistant','content':reply['reply']});speech=pool.call('nano',{'text':reply['reply'],'language':'English','job':uuid.uuid4().hex})
            assert {k:w.process.pid for k,w in pool.workers.items()}==pids
            if speech['freeGPUBytes']<2*1024**3:raise RuntimeError('Headroom below 2 GiB.')
            report['trials'].append({'reply':reply,'speech':speech,'seconds':time.perf_counter()-start})
        stress=[{'role':'user' if i%2==0 else 'assistant','content':('I have school tasks and want to plan manageable steps. ' if i%2==0 else 'We can consider one manageable step at a time. ')*30} for i in range(19)]
        report['contextStress']=pool.call('cbt',{'messages':stress})
        report['longSpeech']=pool.call('nano',{'text':'You can take one manageable step. '*35,'language':'English','job':uuid.uuid4().hex})
        if args.experimental:
            report['experimental']=[pool.call('nano',{'text':text,'language':lang,'job':uuid.uuid4().hex}) for lang,text in [('Filipino','Hindi ka nag-iisa. Maaari kang magpahinga.'),('Taglish','Take one slow breath. Hindi ka nag-iisa.')]]
        report['status']='complete'
    except Exception as exc:report.update(status='failed',error=str(exc))
    finally:
        pool.close();(ROOT/'preload-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2));raise SystemExit(report['status']!='complete')
