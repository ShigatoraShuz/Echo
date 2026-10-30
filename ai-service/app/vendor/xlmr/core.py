"""Stable classes, label/data validation, calibrated metrics for Echo mental-distress classification."""
from __future__ import annotations

from pathlib import Path
import hashlib
import json
import re
import unicodedata

import numpy as np
import pandas as pd
from scipy.special import softmax, logsumexp
from scipy.optimize import minimize_scalar
from sklearn.metrics import (accuracy_score, classification_report, confusion_matrix,
                             f1_score, precision_recall_fscore_support,
                             average_precision_score, roc_auc_score)

# Official fixed order used for training, evaluation, model config and inference.
LABELS = ('Others', 'Anxious', 'Depressed', 'Frustrated', 'Suicidal')
LABEL2ID = {name: i for i, name in enumerate(LABELS)}
ID2LABEL = {i: name for name, i in LABEL2ID.items()}
POSITIVE_ID = LABEL2ID['Suicidal']
COLS = {
    'text': ('text', 'Text', 'post', 'content', 'sentence', 'message', 'journal', 'statement'),
    'label': ('label', 'Label', 'category', 'Category', 'class', 'Class', 'distress_label'),
    'split': ('locked_split', 'split', 'Split', 'data_split', 'set'),
}
SPLIT = {'train':'train', 'training':'train',
         'val':'validation', 'valid':'validation','validation':'validation','dev':'validation',
         'test':'test', 'testing':'test'}


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1048576), b''):
            h.update(block)
    return h.hexdigest()


def checkpoint_weights_hash(directory):
    """Content-fingerprint all model weight shard files, excluding tokenizer and optimizer state."""
    folder=Path(directory)
    files=sorted(list(folder.glob('*.safetensors'))+list(folder.glob('pytorch_model*.bin')))
    if not files:
        raise FileNotFoundError(f'No model weight files found in {folder}')
    h=hashlib.sha256()
    for p in files:
        h.update(p.name.encode('utf-8'))
        h.update(bytes.fromhex(sha256_file(p)))
    return h.hexdigest()


def store_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')


def resolve_column(frame, kind, explicit=None):
    if explicit is not None:
        if explicit not in frame.columns:
            raise ValueError(f'Unknown {kind} column {explicit!r}; found {list(frame.columns)}')
        return explicit
    for c in COLS[kind]:
        if c in frame.columns:
            return c
    raise ValueError(f'Missing {kind} column; pass --{kind}-col. Columns: {list(frame.columns)}')


def text_key(text):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', str(text))).strip().casefold()


def prepare_dataset(source, destination, text_col=None, label_col=None, split_col=None):
    src, dest = Path(source), Path(destination)
    if not src.is_file():
        raise FileNotFoundError(src)
    if src.suffix.lower() == '.csv':
        df = pd.read_csv(src, encoding='utf-8-sig')
    elif src.suffix.lower() == '.jsonl':
        df = pd.read_json(src, lines=True)
    else:
        raise ValueError('Source must be CSV or JSONL')
    if df.empty:
        raise ValueError('Empty source dataset')
    t, l, s = (resolve_column(df, k, explicit) for k, explicit in
               [('text',text_col),('label',label_col),('split',split_col)])
    if df[[t,l,s]].isna().any().any():
        raise ValueError('Null text, label, or split; audit source dataset first')
    data = pd.DataFrame({'text':df[t].astype(str).str.strip(),
                         'original_label':df[l].astype(str).str.strip(),
                         'original_split':df[s].astype(str).str.strip(),
                         'source_row_id':range(len(df))})
    if data.text.eq('').any():
        raise ValueError('Blank text is not allowed')
    canonical = {name.casefold():name for name in LABELS}
    lowered = data.original_label.str.casefold()
    unexpected = sorted(set(lowered) - set(canonical))
    if unexpected:
        raise ValueError(f'Unsupported labels {unexpected}; must be the five named categories, never assume a numeric encoding')
    data['class_name'] = lowered.map(canonical)
    data['labels'] = data.class_name.map(LABEL2ID).astype(int)
    data['split'] = data.original_split.str.casefold().map(SPLIT)
    if data.split.isna().any():
        raise ValueError(f'Invalid locked split: {data.loc[data.split.isna(),"original_split"].unique().tolist()}')
    data['norm'] = data.text.map(text_key)
    contradictory = data.groupby('norm').labels.nunique()
    if (contradictory > 1).any():
        raise ValueError(f'{int((contradictory > 1).sum())} identical normalized texts have conflicting labels. Resolve manually.')
    leakage = data.groupby('norm').split.nunique()
    if (leakage > 1).any():
        raise ValueError(f'Exact cross-split leakage detected in {int((leakage>1).sum())} normalized texts; fix the source splits')
    start = len(data)
    data = data.drop_duplicates('norm', keep='first').copy()
    if set(data.split) != {'train','validation','test'}:
        raise ValueError('Input must already contain locked train, validation, and test splits')
    dest.mkdir(parents=True, exist_ok=True)
    partitions = {}
    for split in ('train','validation','test'):
        part = data.loc[data.split.eq(split), ['text','labels','class_name','source_row_id']]
        if set(part.labels) != set(range(5)):
            raise ValueError(f'{split} does not contain all five labels; cannot evaluate reliable 5-class metrics')
        target = dest / f'{split}.csv'
        part.to_csv(target, index=False, encoding='utf-8')
        partitions[split] = {'rows':len(part), 'sha256':sha256_file(target),
                             'counts':{lab:int((part.class_name==lab).sum()) for lab in LABELS}}
    manifest = {'source_path':str(src.resolve()), 'source_sha256':sha256_file(src),
                'source_rows':start,'retained_rows':len(data), 'exact_within_split_deduplicated':start-len(data),
                'source_columns':{'text':t,'label':l,'split':s},
                'class_order':list(LABELS), 'partitions':partitions,
                'near_duplicate_warning':'Semantic or near-duplicate leakage not checked; audit separately.',
                'training_language':'English source dataset only',
                'risk_warning':'Suicidal is a training label, not suicide risk level, intent, behavior, or severity.'}
    store_json(dest/'manifest.json',manifest)
    return manifest


def read_prepared(folder, split):
    folder = Path(folder)
    if split not in ('train','validation','calibration','test'):
        raise ValueError('Invalid split')
    manifest = json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
    if manifest['class_order'] != list(LABELS):
        raise ValueError('Class order was modified')
    file = folder/f'{split}.csv'
    if sha256_file(file) != manifest['partitions'][split]['sha256']:
        raise ValueError(f'Prepared split checksum mismatch: {split}')
    frame = pd.read_csv(file)
    if frame.empty or frame.labels.isna().any() or not set(frame.labels.unique()).issubset(set(range(5))):
        raise ValueError('Prepared labels invalid')
    return frame, manifest


def probs_from_logits(logits, temperature=1.0):
    z = np.asarray(logits, dtype=float)
    if z.ndim != 2 or z.shape[1] != 5 or not temperature > 0:
        raise ValueError('Expected [n,5] logits and a positive temperature')
    return softmax(z / temperature, axis=1)


def categorical_temperature(logits, gold):
    logits, gold = np.asarray(logits, dtype='float64'), np.asarray(gold,dtype=int)
    if logits.shape != (len(gold),5):
        raise ValueError('Logits/labels shapes incorrect')
    def nll(t):
        z = logits / t
        return float(np.mean(logsumexp(z,axis=1) - z[np.arange(len(gold)),gold]))
    result = minimize_scalar(nll,bounds=(0.25,8),method='bounded')
    if not result.success:
        raise RuntimeError('Validation temperature fitting failed')
    return float(result.x)


def metrics(y, probabilities):
    y = np.asarray(y,dtype=int)
    pr = np.asarray(probabilities,dtype=float)
    pred = pr.argmax(axis=1)
    p,r,f,s = precision_recall_fscore_support(y,pred,labels=list(range(5)),zero_division=0)
    mat = confusion_matrix(y,pred,labels=list(range(5)))
    result = {
        'sample_count':int(len(y)), 'accuracy':float(accuracy_score(y,pred)),
        'macro_f1':float(f1_score(y,pred,average='macro',zero_division=0)),
        'weighted_f1':float(f1_score(y,pred,average='weighted',zero_division=0)),
        'suicidal_one_vs_rest_average_precision':float(average_precision_score(y==POSITIVE_ID,pr[:,POSITIVE_ID])),
        'per_class':{lab:{'precision':float(p[i]),'recall':float(r[i]),'f1':float(f[i]),'support':int(s[i])}
                     for i,lab in enumerate(LABELS)},
        'confusion_matrix_label_order':list(LABELS), 'confusion_matrix':mat.tolist(),
        'true_suicidal_predicted_as':{LABELS[i]:int(mat[POSITIVE_ID,i]) for i in range(5)},
    }
    return result


def safety_metrics(y, positive_probs, threshold):
    y = np.asarray(y,dtype=int) == POSITIVE_ID
    positive_probs = np.asarray(positive_probs,dtype=float)
    prediction = positive_probs>=threshold
    tp=int(np.sum(y&prediction)); fp=int(np.sum(~y&prediction))
    tn=int(np.sum(~y&~prediction)); fn=int(np.sum(y&~prediction))
    precision=tp/(tp+fp) if tp+fp else 0.0
    recall=tp/(tp+fn) if tp+fn else 0.0
    f2=5*precision*recall/(4*precision+recall) if precision+recall else 0.0
    return {'threshold':float(threshold),'tp':tp,'fp':fp,'tn':tn,'fn':fn,
            'precision':precision,'recall':recall,'f2':f2,
            'false_positive_rate':fp/(fp+tn) if fp+tn else None,
            'false_negative_rate':fn/(fn+tp) if fn+tp else None}


def select_safety_threshold(y, probabilities, min_precision=0.4, recall_goal=0.95):
    if not (0 < min_precision <= 1 and 0 < recall_goal <= 1):
        raise ValueError('Require 0 < min_precision, recall_goal <= 1')
    y = np.asarray(y,dtype=int)
    pp = np.asarray(probabilities,dtype=float)[:,POSITIVE_ID]
    unique = np.unique(pp)
    candidates = [safety_metrics(y,pp,t) for t in unique]
    candidates = [x for x in candidates if x['precision']>=min_precision]
    if not candidates:
        raise ValueError('No threshold meets precision floor; inspect validation scores before choosing another policy')
    choice = max(candidates, key=lambda d: (d['f2'],d['recall'],d['precision'],d['threshold']))
    return {'threshold':choice['threshold'],'validation':choice,
            'recall_goal':recall_goal,'recall_goal_met':bool(choice['recall']>=recall_goal),
            'min_precision':min_precision,
            'method':'Validation: best F2 with minimum positive-class precision; independent of five-class top-1',
            'note':'A positive flag prompts safety follow-up; negative score cannot establish safety.'}
