"""Frozen experimental knobs for independent E4 models; no historical E3 paths."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
RAW=ROOT/'data'/'raw'; PREP=ROOT/'data'/'prepared'; REPORTS=ROOT/'reports'; RUNS=ROOT/'runs'
SEED=42
BASE_MODEL='FacebookAI/roberta-large'
PLUTCHIK=['joy','trust','fear','surprise','sadness','disgust','anger','anticipation']
GO_LABELS=['admiration','amusement','anger','annoyance','approval','caring','confusion',
 'curiosity','desire','disappointment','disapproval','disgust','embarrassment','excitement',
 'fear','gratitude','grief','joy','love','nervousness','optimism','pride','realization',
 'relief','remorse','sadness','surprise']
GO_NEUTRAL='neutral'  # all 27 targets zero when neutral; NOT a Plutchik class
SYNTH_REPO='uavster/Llama3_8b-emotion_multiclass-Plutchik'
SYNTH_FILENAME='emotions_llama3-8b-4bit_6540rows_robust07-filtered.csv'
ED_URL='https://dl.fbaipublicfiles.com/parlai/empatheticdialogues/empatheticdialogues.tar.gz'
SEMEVAL_URL='https://saifmohammad.com/WebDocs/AIT-2018/AIT2018-DATA/SemEval2018-Task1-all-data.zip'
GO_REPO='google-research-datasets/go_emotions'
SYNTH_SIMILARITY=0.90
MAX_LENGTH=256
TRAIN_BATCH=2
EVAL_BATCH=4
GRAD_ACCUM=8
EPOCHS=4
PATIENCE=2
LR=1.5e-5
WD=0.01
WARMUP=0.08
LAMBDA_GO=0.30
MIX_SYNTH_SHARE=0.50
# Sampling of primary sources is independent for each arm: A synthetic-only;
# B mixed primary supervised; C IDENTICAL B primary training plus 27-label auxiliary.
# Per-epoch exposure: 6,000 primary samples (with replacement if fewer) and, for C, 6,000 Go samples.
PRIMARY_EPOCH_EXAMPLES=6000
GO_EPOCH_EXAMPLES=6000
# Try reduce both to 200 in a first smoke run; do not claim smoke outputs as final.
