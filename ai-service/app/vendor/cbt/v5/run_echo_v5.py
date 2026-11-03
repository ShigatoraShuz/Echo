#!/usr/bin/env python3
"""Standalone Echo V5: frozen CBT backend + local XLM-R V2 routing.

This is a separate research experiment, NOT an Echo production safety router.
"""
from __future__ import annotations
import argparse, json, os, sys
from pathlib import Path
if __package__:
    from . import echo_cbt_standalone as backend
else:
    import echo_cbt_standalone as backend
if __package__:
    from . import v4_controls as legacy
else:
    import v4_controls as legacy
if __package__:
    from .xlmr_router import XLMRScreen, configuration, decide, review_result
else:
    from xlmr_router import XLMRScreen, configuration, decide, review_result

HERE=Path(__file__).resolve().parent
VERSION='echo_cbt_mixed_lr_1e4_xlmr_v5_20261101'
MODEL_ID='mixed_lr_1e4'

# V5 only removes the *wording-dependent* mandate that forced a safety question
# in every task-related 'give up' response. A separate XLM-R/route decision is
# performed BEFORE generation. All other content checks remain intact.
_original_quality=backend.quality_issues
def policy_quality(answer,latest,role,limited):
    issues=_original_quality(answer,latest,role,limited)
    return [x for x in issues if x!='ambiguity_requires_gentle_safety_clarification']
backend.quality_issues=policy_quality


def checkpoint_arg(args):
    return args.xlmr_dir or os.getenv('ECHO_XLMR_V2_DIR')


def get_screener(args):
    path=checkpoint_arg(args)
    if not path:raise ValueError('Set --xlmr-dir or ECHO_XLMR_V2_DIR to your existing five-class XLM-R V2 checkpoint; never fall back to keyword-only CBT')
    return XLMRScreen(path,configuration(Path(args.xlmr_config)))


def safety_triage(turns, screener):
    return decide(turns,screener,legacy,language_fn=backend.language)


def generate_approved(engine,turns,decision):
    if not decision['generation_allowed']:return review_result(decision,VERSION)
    # Do not invoke backend.reply(): V4 owns an outdated independent lexical
    # safety gate and would falsely demand an exact clarification phrase.
    first=engine._attempt(turns,retry=False)
    attempts=[first]
    if first.get('needs_review'):
        try:attempts.append(engine._attempt(turns,retry=True,allow_drops=False))
        except (RuntimeError,ValueError) as exc:
            return {'reply':None,'needs_review':True,'issues':first.get('issues',[])+['retry_failed_or_context_modified'],
                    'warning':str(exc),'attempts':1,'inference_version':VERSION,
                    'screening':decision,'model_output':False}
    for item in reversed(attempts):
        if item.get('needs_review'):continue
        try:
            ready=engine._approved_for_output(item)
        except (ValueError,RuntimeError,TypeError,KeyError) as exc:
            return {'reply':None,'needs_review':True,'issues':['auto_format_failed'],
                    'warning':str(exc),'attempts':len(attempts),'inference_version':VERSION,
                    'screening':decision,'model_output':False}
        ready.update(inference_version=VERSION, screening=decision, safety_route=decision['route'],
                     safety_disposition=decision['route'],
                     attempts=len(attempts),rewrite_attempted=len(attempts)>1,model_output=True)
        if len(attempts)>1:ready['first_attempt_issues']=first.get('issues',[])
        return ready
    issues=list(dict.fromkeys(x for item in attempts for x in item.get('issues',[])))
    return {'reply':None,'needs_review':True,'issues':issues,'attempts':len(attempts),
            'rewrite_attempted':len(attempts)>1,'inference_version':VERSION,
            'warning':'Both model drafts failed quality checks; neither was displayed.',
            'screening':decision,'safety_route':decision['route'],'model_output':False}


def console(result, width):
    if result.get('reply') and not result.get('needs_review'):
        return '\nEcho >\n'+backend.wrap_for_console(result['reply'],width)
    msg='\nEcho >\n[WITHHELD: model response not approved]'
    if result.get('issues'):msg+='\nReason(s): '+', '.join(result['issues'])
    if result.get('safety_message'):msg+='\nSafety routing (not model output): '+backend.wrap_for_console(result['safety_message'],width)
    return msg


def main(argv=None):
    p=argparse.ArgumentParser(description='Isolated CBT + frozen XLM-R V2 five-class screening (research only)')
    p.add_argument('--mode',choices=['chat','triage','audit','format','check'],default='chat')
    p.add_argument('--text');p.add_argument('--text-file',type=Path)
    p.add_argument('--history-json',type=Path)
    p.add_argument('--latest-user');p.add_argument('--interactive',action='store_true')
    p.add_argument('--xlmr-dir',help='Existing local frozen five-class XLM-R checkpoint directory')
    p.add_argument('--xlmr-config',type=Path,default=HERE/'xlmr_config.json')
    p.add_argument('--base-dir');p.add_argument('--adapter-dir')
    p.add_argument('--verify-hashes',action='store_true')
    p.add_argument('--json',action='store_true')
    p.add_argument('--wrap-width',type=int,default=72)
    p.add_argument('--audit-log',type=Path,help='Optional private metadata-only JSONL audit; no raw text stored')
    args=p.parse_args(argv)
    if not 32<=args.wrap_width<=200:p.error('--wrap-width must be 32..200')
    if args.text and args.text_file:p.error('Choose --text OR --text-file')
    if args.history_json and (args.text or args.text_file or args.interactive):p.error('--history-json is exclusive')
    raw=args.text if args.text is not None else args.text_file.read_text(encoding='utf8') if args.text_file else None
    if args.mode=='format':
        if raw is None:p.error('Format needs --text or --text-file')
        formatted=backend.format_existing(raw)
        print(json.dumps({'reply':formatted,'model_generated':False,'content_preserved':True},ensure_ascii=False,indent=2) if args.json else backend.wrap_for_console(formatted,args.wrap_width))
        return 0
    if args.mode=='audit':
        if raw is None or not args.latest_user:p.error('Audit requires --text and --latest-user')
        role=backend.role(args.latest_user)
        issues=policy_quality(raw,args.latest_user,role,False)
        print(json.dumps({'accepted_structurally':not issues,'issues':issues,'safety_screened':False,'note':'Not a safety approval'},ensure_ascii=False,indent=2))
        return 0
    # XLM-R is REQUIRED for triage/chat/check. Fail closed if missing or incompatible.
    xlmr=get_screener(args)
    if args.mode=='check':
        output={'xlmr_checkpoint_loaded':True,'xlmr_path':xlmr.checkpoint,
                'xlmr_label_map':xlmr.labels,'threshold':xlmr.cfg['suicidal_screening_threshold'],
                'calibration_status':xlmr.cfg.get('calibration_status','unverified')}
        b,a=backend.model_locations(args)
        output['cbt_preflight']=backend.preflight(b,a,check_hashes=args.verify_hashes)
        print(json.dumps(output,indent=2,ensure_ascii=False));return 0
    if args.history_json:
        turns=backend.validate_history(json.loads(args.history_json.read_text(encoding='utf8')))
    elif raw is not None:
        turns=backend.validate_history([{'role':'user','content':raw}])
    else:turns=None
    if args.mode=='triage':
        if turns is None:p.error('Triage requires --text or --history-json')
        decision=safety_triage(turns,xlmr)
        print(json.dumps(decision,indent=2,ensure_ascii=False))
        return 0
    if turns is None and not args.interactive:p.error('Chat requires input or --interactive')
    engine=None
    def evaluate(new_turns):
        nonlocal engine
        dec=safety_triage(new_turns,xlmr)
        if not dec['generation_allowed']:return review_result(dec,VERSION)
        if engine is None:engine=backend.LocalCBT(*backend.model_locations(args))
        return generate_approved(engine,new_turns,dec)
    if args.interactive:
        print('Echo mixed_lr_1e4 V5 + XLM-R (experimental; no clinical safety approval). Type EXIT to stop.')
        history=[]
        pending_review=None
        while True:
            try:msg=input('USER > ').strip()
            except (KeyboardInterrupt,EOFError):break
            if msg.lower() in ('exit','quit'):break
            if not msg:continue
            proposal=backend.validate_history((history+[{'role':'user','content':msg}])[-20:])
            # A review requirement stays pending across history trimming; no chat-level 'all clear' command.
            if pending_review is not None:
                result=review_result(pending_review,VERSION)
            else:
                result=evaluate(proposal)
                if result.get('needs_review') and result.get('screening',{}).get('generation_allowed') is False:
                    pending_review=result['screening']
            print(console(result,args.wrap_width))
            if args.json:print(json.dumps(result,ensure_ascii=False,indent=2))
            if args.audit_log:backend.v4.write_audit_log(args.audit_log,result,model=MODEL_ID,mode='v5_interactive',text=msg)
            # Preserve non-approved user turns and relevant safety history.
            if result.get('reply') and not result.get('needs_review'):
                history=(proposal+[{'role':'assistant','content':result['reply']}])[-19:]
            else:history=proposal[-19:]
        return 0
    result=evaluate(turns)
    if args.audit_log:backend.v4.write_audit_log(args.audit_log,result,model=MODEL_ID,mode='v5_chat',text=turns[-1]['content'])
    print(json.dumps(result,indent=2,ensure_ascii=False) if args.json else console(result,args.wrap_width))
    return 2 if result.get('needs_review') else 0

if __name__=='__main__':
    try:sys.exit(main())
    except (OSError,RuntimeError,ValueError,ImportError,KeyError) as exc:
        print(f'[ECHO V5 ERROR] {type(exc).__name__}: {exc}',file=sys.stderr)
        sys.exit(1)
