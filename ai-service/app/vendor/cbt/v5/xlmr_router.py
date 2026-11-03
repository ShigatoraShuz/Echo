"""XLM-R V2 evidence-based research router for Echo CBT V5.

A classifier's 'Suicidal' class probability is NOT a clinical risk probability.
No fallback to lexical-only chat is permitted if the learned classifier fails.
The explicit-urgent lexical check is only a fail-safe override.
"""
from __future__ import annotations
import json, os, math
from pathlib import Path
from dataclasses import dataclass, asdict

LABELS={'others','anxious','depressed','frustrated','suicidal'}


def configuration(path: Path) -> dict:
    config=json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(config,dict):raise ValueError('XLM-R config must be an object')
    t=config.get('suicidal_screening_threshold')
    if isinstance(t,bool) or not isinstance(t,(float,int)) or not 0<float(t)<1:
        raise ValueError('Set a valid 0-1 suicidal screening threshold in xlmr_config.json')
    ml=config.get('max_length')
    st=config.get('window_stride')
    if not isinstance(ml,int) or not 32<=ml<=512:raise ValueError('max_length should be 32..512')
    if not isinstance(st,int) or not 0<=st<ml-2:raise ValueError('window_stride should be less than max_length-2')
    temp=config.get('temperature',1.0)
    if isinstance(temp,bool) or not isinstance(temp,(float,int)) or not 0<float(temp)<=20:
        raise ValueError('Invalid temperature; use verified calibration temperature only')
    return config


def label_lookup(id2label: dict, explicit: list[str] | None = None) -> dict[int,str]:
    if explicit is not None:
        if not isinstance(explicit,list) or len(explicit)!=5:raise ValueError('label_order must be a five-item list')
        arr=[str(x).lower().strip() for x in explicit]
    else:
        if len(id2label)!=5:raise ValueError('Expected exactly five XLM-R labels')
        arr=[str(id2label.get(i,id2label.get(str(i),''))).lower().strip() for i in range(5)]
    if set(arr)!=LABELS or len(set(arr))!=5:
        raise ValueError('XLM-R class labels are ambiguous. Set label_order in xlmr_config.json in the checkpoint output order. Never guess label indices.')
    return dict(enumerate(arr))


class XLMRScreen:
    """Uses the existing local *five-class* XLM-R classifier with CPU inference."""
    def __init__(self, checkpoint: str | Path, cfg: dict):
        location=Path(checkpoint).expanduser()
        if not location.is_dir():raise FileNotFoundError(f'XLM-R checkpoint directory not found: {location}')
        if not (location/'config.json').is_file():raise FileNotFoundError(f'XLM-R model config missing: {location}')
        import torch
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        self.torch=torch
        self.tokenizer=AutoTokenizer.from_pretrained(str(location),local_files_only=True,trust_remote_code=False)
        self.model=AutoModelForSequenceClassification.from_pretrained(str(location),local_files_only=True,trust_remote_code=False).cpu().eval()
        if self.model.config.num_labels!=5:raise ValueError('Checkpoint is not a five-class XLM-R sequence classifier')
        if self.model.config.model_type!='xlm-roberta':raise ValueError('Checkpoint architecture is not XLM-RoBERTa')
        self.labels=label_lookup(self.model.config.id2label,cfg.get('label_order'))
        self.cfg=cfg
        self.checkpoint=str(location)

    def classify(self, text: str) -> dict:
        if not isinstance(text,str) or not text.strip():raise ValueError('Cannot screen empty text')
        cfg=self.cfg
        encoding=self.tokenizer(text, truncation=True, max_length=cfg['max_length'],
                                stride=cfg['window_stride'],return_overflowing_tokens=True,
                                padding=True, return_tensors='pt')
        # Fail closed on unbounded/oversized window batches.
        if len(encoding['input_ids'])>128:raise ValueError('Excessive XLM-R input windows; cannot confidently screen')
        # 'overflow_to_sample_mapping' is not a model input.
        fields={'input_ids','attention_mask','token_type_ids'}
        inputs={k:v for k,v in encoding.items() if k in fields}
        with self.torch.inference_mode():
            logits=self.model(**inputs).logits.float()/float(cfg.get('temperature',1.0))
            probabilities=self.torch.softmax(logits,dim=-1).cpu().tolist()
        suicide_i=next(i for i,name in self.labels.items() if name=='suicidal')
        strongest=max(probabilities,key=lambda row:row[suicide_i])
        max_suicide=max(row[suicide_i] for row in probabilities)
        by_class={name:round(float(strongest[i]),6) for i,name in self.labels.items()}
        return {'relative_class_scores':by_class,'dominant_in_max_suicidal_window':self.labels[max(range(5),key=lambda i:strongest[i])],
                'highest_suicidal_window_score':round(float(max_suicide),6),
                'screening_threshold':float(cfg['suicidal_screening_threshold']),
                'screening_flag':bool(max_suicide>=float(cfg['suicidal_screening_threshold'])),
                'windows':len(probabilities), 'calibration_status':cfg.get('calibration_status','unverified'),
                'note':'Five-class relative scores, NOT suicidal risk/severity probabilities. English-fine-tuned; Filipino/Taglish performance unvalidated.'}


def decide(history: list[dict], screen, legacy_controls, *, language_fn=None) -> dict:
    """Screen EVERY user turn. Unresolved concerns stay sticky within provided history.

    `screen` may be a real XLMRScreen or a deterministic fake in unit tests.
    """
    user_texts=[m['content'] for m in history if m.get('role')=='user']
    if not user_texts:raise ValueError('No user turns to screen')
    observations=[]
    for i,text in enumerate(user_texts):
        evidence=screen.classify(text) # always run classifier; if it fails, fail closed
        lexical=legacy_controls.disposition_one(text)
        flagged=bool(evidence['screening_flag'])
        lang=language_fn(text) if language_fn else 'unknown'
        # The retained explicit-danger backstop overrides weak learned evidence.
        # Potentially ambiguous context is NOT declared safe by a negative classifier.
        if lexical=='explicit_urgent':action='safety_support'
        elif flagged:action='safety_review'
        elif lexical in ('safety_context_review','ambiguous_unqualified'):action='clarification_review'
        else:action='support_with_clarification' if lexical=='contextual_ambiguous' else 'ordinary_support'
        observations.append({'turn_index':i,'lexical_backstop':lexical,'language_heuristic':lang,
                             'route':action,'xlmr':evidence})
    priority=('safety_support','safety_review','clarification_review','support_with_clarification','ordinary_support')
    chosen=next((r for r in priority if any(o['route']==r for o in observations)),'ordinary_support')
    return {'route':chosen,'generation_allowed':chosen in ('support_with_clarification','ordinary_support'),
            'requires_clarification':chosen in ('support_with_clarification','clarification_review'),
            'latest':observations[-1], 'reviewed_user_turns':len(observations),
            'trigger_turn_indices':[o['turn_index'] for o in observations if o['route'] not in ('ordinary_support','support_with_clarification')],
            'screening':'xlmr_v2_five_class_plus_explicit_danger_backstop',
            'clinical_risk_assessed':False,
            'note':'XLM-R provides learned screening evidence, not proof of safety. Explicit-danger and uncertain disclosures remain reviewable.'}


def review_result(decision:dict, version:str)->dict:
    route=decision['route']
    reasons={'safety_support':'explicit_danger_backstop_requires_Echo_safety_route',
             'safety_review':'xlmr_suicidal_language_screening_flag_requires_review',
             'clarification_review':'meaning_or_context_unresolved_requires_Echo_safety_route'}
    return {'reply':None,'needs_review':True,'model_output':False,
            'issues':[reasons.get(route,'unknown_safety_route')], 'safety_route':route,
            'inference_version':version,'attempts':0,
            'screening':decision,
            'safety_message':('This message needs safety-support review. This standalone prototype cannot determine risk. '
                'If there may be immediate danger, seek emergency care or local emergency services and contact someone trusted. '
                'For unresolved context, use Echo’s full safety-support route before regular CBT chat.'),
            'warning':'No CBT model response was generated; this is a non-model safety handoff.'}
