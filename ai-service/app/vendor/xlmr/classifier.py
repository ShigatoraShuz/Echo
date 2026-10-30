"""Echo five-class XLM-RoBERTa inference — automatically classify typed/pasted journals."""
import torch  # import first for Windows c10.dll import-order mitigation
import argparse
import json
import sys
from pathlib import Path
import numpy as np
from .core import LABELS, POSITIVE_ID, probs_from_logits, sha256_file, checkpoint_weights_hash
from .inference import load_checkpoint, window_logits

LANGUAGES = ('unknown','en','fil','taglish')


class Classifier:
    def __init__(self, run_dir='artifacts/xlmr_v2_len384',batch_size=16,stride=64):
        self.run=Path(run_dir)
        meta_file=self.run/'training_manifest.json'
        calib_file=self.run/'calibration'/'calibration.json'
        if not meta_file.exists():
            raise FileNotFoundError(f'Training manifest missing: {meta_file}')
        if not calib_file.exists():
            raise FileNotFoundError(f'Run 03_calibrate.py first: {calib_file}')
        self.meta=json.loads(meta_file.read_text('utf-8'))
        if self.meta.get('encoder_architecture') != 'xlm-roberta':
            raise ValueError('This script requires the NEW five-class XLM-RoBERTa run, not the old MentalRoBERTa/binary run.')
        self.cal=json.loads(calib_file.read_text('utf-8'))
        if (self.cal['source_sha256']!=self.meta['training_data_sha256'] or
            self.cal['calibration_sha256']!=self.meta['calibration_split_sha256'] or
            self.cal['model_config_sha256']!=sha256_file(self.run/'best_model'/'config.json')):
            raise ValueError('Calibration is for a different training dataset or model checkpoint')
        if self.cal.get('model_weights_sha256') and (self.cal['model_weights_sha256']!=self.meta.get('model_weights_sha256') or self.cal['model_weights_sha256']!=checkpoint_weights_hash(self.run/'best_model')):
            raise ValueError('Model weights do not match frozen calibration')
        if self.cal['class_order']!=list(LABELS):
            raise ValueError('Five-class mapping mismatch')
        self.batch_size=batch_size
        self.stride=stride
        self.model,self.tokenizer,self.device=load_checkpoint(self.run/'best_model')

    def classify(self,text,language='unknown'):
        if language not in LANGUAGES:
            raise ValueError('Supported declarations: unknown, en, fil, taglish')
        if not text or not text.strip():
            return {'classification':'INDETERMINATE','distress_category':None,'safety_status':'REVIEW_REQUIRED',
                    'reason':'EMPTY_INPUT'}
        logits,tokens=window_logits(self.model,self.tokenizer,self.device,text,
                                  max_length=int(self.meta['max_length']),stride=self.stride,
                                  batch_size=self.batch_size)
        if self.cal.get('schema')!='ECHO_XLMR_V2_WINDOW_CALIBRATED':
            raise ValueError('Require V2 independent window-level calibration; do not mix with V1 calibration.')
        if self.stride!=int(self.cal['stride']):
            raise ValueError('Inference stride must match frozen calibration stride '+str(self.cal['stride']))
        window_prob=probs_from_logits(logits,self.cal['temperature'])
        # Match 03 and 04: aggregate window LOGITS first, then temperature softmax.
        avg=probs_from_logits(logits.mean(axis=0,keepdims=True),self.cal['temperature'])[0]

        dominant=int(np.argmax(avg))
        max_suicidal=float(np.max(window_prob[:,POSITIVE_ID]))
        threshold=float(self.cal['suicidal_label_flag']['threshold'])
        flag = (dominant == POSITIVE_ID) or (max_suicidal >= threshold)
        is_long=tokens>int(self.meta['max_length'])
        language_unvalidated=(language!='en')
        if flag:
            safety_status='SAFETY_FLAG_EXPERIMENTAL'
            safe_route='SAFETY_AWARE_SUPPORT_OR_HUMAN_REVIEW'
        elif is_long or language_unvalidated:
            safety_status='INDETERMINATE'
            safe_route='SAFETY_AWARE_SUPPORT_OR_HUMAN_REVIEW'
        else:
            safety_status='NO_FLAG_ON_TESTED_STYLE_EXPERIMENTAL'
            safe_route='ADDITIONAL_SAFETY_CONTROLS_REQUIRED'
        return {
            'classification':'FIVE_CLASS_TOP_1',
            'distress_category':LABELS[dominant],
            'all_category_scores_relative_not_diagnoses':{name:round(float(avg[i]),6) for i,name in enumerate(LABELS)},
            'suicidal_language_flag':bool(flag),
            'suicidal_label_top_1':bool(dominant == POSITIVE_ID),
            'max_window_suicidal_label_score':round(max_suicidal,6),
            'validation_selected_suicidal_flag_threshold':threshold,
            'safety_status':safety_status,'safety_route':safe_route,
            'declared_language_not_verified':language,
            'number_of_windows':int(len(window_prob)),
            'token_count_including_special_tokens':int(tokens),
            'language_coverage_validated':False if language_unvalidated else 'ENGLISH_DATASET_ONLY',
            'long_journal_aggregation_validated':'SOURCE_DATASET_ONLY_NOT_REAL_STUDENT_JOURNALS',
            'clinical_suicide_risk':None,'suicidal_ideation_severity':None,
            'warning':'Categories are model estimates of training labels, not psychiatric diagnoses. English-trained; long journal pooling and Filipino/Taglish performance unvalidated. A negative flag never confirms safety.',
        }


def print_readable(result):
    print('\n'+'='*62)
    print('ECHO — MENTAL DISTRESS CLASSIFICATION (XLM-RoBERTa, 5 classes)')
    print('='*62)
    print('Dominant distress category:', result.get('distress_category') or 'INDETERMINATE')
    scores=result.get('all_category_scores_relative_not_diagnoses')
    if scores:
        print('\nFIVE-CLASS RELATIVE SCORES (not severity / clinical risk):')
        for name,prob in sorted(scores.items(),key=lambda x:-x[1]):
            print(f'  {name:<13} {prob*100:>6.2f}%')
        print('\nSuicidal-language screening:', 'FLAGGED' if result['suicidal_language_flag'] else 'not flagged by threshold')
        print('Highest suicidal window score:',f"{100*result['max_window_suicidal_label_score']:.2f}%")
        print('Screening threshold:',f"{100*result['validation_selected_suicidal_flag_threshold']:.2f}%")
        print('Safety status:',result['safety_status'])
        print('Token windows:',result['number_of_windows'])
    else:
        print('Safety status:',result['safety_status'])
    print('\nThese scores do NOT measure suicidal ideation severity or clinical risk.')
    print('English dataset only; real student journals and other languages are not validated.')
    print('='*62+'\n')


def read_multiline():
    print('Paste or type your journal. Two empty ENTER lines submit automatically.')
    print('A single blank line inside the journal is allowed. Type EXIT to quit.')
    lines=[]
    empty_streak=0
    while True:
        line=input('> ')
        if not lines and line.strip().upper() in ('EXIT','QUIT','Q'):
            return None
        if line.strip().upper()=='END': # Previous Echo convention remains supported.
            return '\n'.join(lines).strip()
        if not line.strip():
            empty_streak+=1
            if empty_streak==2:
                return '\n'.join(lines).strip()
        else: empty_streak=0
        lines.append(line)


def read_single_line():
    print('Paste a one-line journal and press Enter; EXIT to quit.')
    text=input('Journal > ')
    return None if text.strip().upper() in ('EXIT','QUIT','Q') else text


def main(argv=None):
    parser=argparse.ArgumentParser(description='Automatic interactive 5-category XLM-RoBERTa classifier')
    src=parser.add_mutually_exclusive_group()
    src.add_argument('--text')
    src.add_argument('--file',help='UTF-8 text journal')
    parser.add_argument('--run-dir',default='artifacts/xlmr_v2_len384')
    parser.add_argument('--language',choices=LANGUAGES,default='unknown',help='Optional language declaration; NOT detected automatically')
    parser.add_argument('--single-line',action='store_true',help='Classify each one-line input immediately')
    parser.add_argument('--batch-size',type=int,default=16)
    parser.add_argument('--stride',type=int,default=64)
    parser.add_argument('--json',action='store_true',help='Print full JSON after human-readable output')
    a=parser.parse_args(argv)
    try:
        if a.text is not None or a.file is not None:
            text=a.text if a.text is not None else Path(a.file).read_text('utf-8')
            clf=Classifier(a.run_dir,a.batch_size,a.stride)
            result=clf.classify(text,a.language)
            print_readable(result)
            if a.json: print(json.dumps(result,ensure_ascii=False,indent=2))
            return 0
        print('ECHO MENTAL DISTRESS CLASSIFIER — XLM-RoBERTa automatic journal classification')
        print('Five categories: '+', '.join(LABELS))
        clf=None
        read=read_single_line if a.single_line else read_multiline
        while True:
            text=read()
            if text is None:
                print('Exit.')
                return 0
            if not text.strip():
                print_readable({'distress_category':None,'safety_status':'REVIEW_REQUIRED'})
                continue
            if clf is None:
                print('Loading fine-tuned XLM-RoBERTa...')
                clf=Classifier(a.run_dir,a.batch_size,a.stride)
            result=clf.classify(text,a.language)
            print_readable(result)
            if a.json: print(json.dumps(result,ensure_ascii=False,indent=2))
    except (EOFError,KeyboardInterrupt):
        print('\nExit.')
        return 0
    except Exception as exc:
        print(f'INDETERMINATE — model or input error ({type(exc).__name__}): {exc}',file=sys.stderr)
        print('Do not treat inference failure as no mental distress or no safety concern.',file=sys.stderr)
        return 2

if __name__=='__main__': sys.exit(main())
