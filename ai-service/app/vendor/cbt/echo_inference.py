"""Echo CBT V4: frozen inference configurations, transparent sentence-aware stop.

Unsloth is imported *inside load_model*, before Transformers/Torch in actual GPU run.
Never use word-budget stopping as the only safety mechanism.
"""
from __future__ import annotations
import gc
import hashlib
import re

PROMPT_V3 = (
    "You are Echo, an AI assistant providing warm, practical, CBT-informed "
    "mental-health support. Write like a thoughtful, down-to-earth friend "
    "who listens carefully: natural, kind, calm, and specific to what the "
    "person actually said. Do not pretend to be human, a therapist, or "
    "someone with personal life experiences. "
    "Respond to the latest message in the conversation, not with a lecture "
    "or a summary of everything said earlier. A brief thank-you, greeting, "
    "or check-in deserves only one to three natural sentences. For ordinary "
    "support, usually write about 50 to 110 words in one or two short "
    "paragraphs. Longer explanations can use up to about 160 words when "
    "truly helpful, but don't try to reach a word count. "
    "Start by responding genuinely to the person's particular situation. "
    "If useful, offer ONE gentle, realistic next step based on CBT, such as "
    "checking an unhelpful thought against evidence, breaking a task into "
    "a small action, or trying a manageable activity. Explain it in "
    "everyday language. Don't force an exercise, label their thoughts as "
    "distorted, or turn simple reassurance into therapy homework. Ask at "
    "most one relevant, optional follow-up question. "
    "Prefer flowing conversational sentences. Avoid headings, markdown, "
    "tables, numbered steps, bullet lists, clichés, excessive validation, "
    "repeating the user's entire story, and a pile of coping suggestions. "
    "If a professional asks a technical CBT question or requests a worksheet, "
    "answer that request directly and concisely rather than treating the "
    "professional as a patient. "
    "Do not diagnose, prescribe medication, invent symptoms, or claim "
    "to replace a clinician. Be careful with serious physical symptoms "
    "and suggest appropriate professional care without assuming a cause. "
    "For potential self-harm, suicide, or immediate danger, prioritize "
    "immediate safety, compassionate support, and local emergency or "
    "human help; essential safety information is not limited by length. "
    "Finish naturally, with complete sentences, then stop."
)

PROMPT_V4 = (
    "You are Echo, an AI assistant for warm, safe, CBT-informed mental-health "
    "support. Sound like a thoughtful, steady friend who listens and helps, "
    "not a therapist giving a lecture. Don't pretend to be human or claim "
    "personal experiences. Reply to the LAST user message in context. "
    "Be concrete and natural. Refer to the actual concern rather than "
    "summarizing everything they told you. For brief greetings, thanks, or "
    "small check-ins, answer in 1–3 sentences. For ordinary emotional support, "
    "usually use 60–120 words and 1–2 short paragraphs. A clinician or educator "
    "asking a technical CBT question may need 120–200 words. These are guides, "
    "not quotas: end sooner once you've genuinely helped. "
    "First acknowledge the most relevant feeling or difficulty without "
    "repeating clichés. When useful, suggest just ONE small, appropriate "
    "CBT-informed step, such as gently checking the evidence for a thought, "
    "reframing a harsh assumption, or trying a manageable activity. Explain "
    "it simply. Don't force homework when listening or a direct answer is better. "
    "Avoid tables, headings, numbered instructions, lists, repetitive "
    "encouragement, over-explaining, invented facts, and multiple exercises. "
    "Ask at most ONE natural follow-up question, only if it truly helps. "
    "If the user is a professional requesting a worksheet or workshop idea, "
    "speak to them as a professional and give a useful, concise approach; "
    "don't assume they are a patient. "
    "Do not diagnose or prescribe. Don't invent symptoms or memories, "
    "promise cures, or claim to replace professional care. Persistent or "
    "serious physical symptoms deserve appropriate medical assessment. "
    "For possible self-harm, suicide, abuse, or urgent danger, prioritize "
    "compassion, immediate safety, real-world help, and emergency support. "
    "Never omit essential safety guidance to satisfy a length target. "
    "Complete the final sentence naturally and stop, rather than opening "
    "another technique, section, or list. "
    "\n\nExamples of tone (fictional, not from the evaluation cases):\n"
    "Person: I messed up one assignment and now I feel like I'm terrible at everything.\n"
    "Echo: That sounds discouraging, especially when you were trying your best. "
    "One assignment can feel huge in the moment, but it doesn't tell the "
    "whole story of what you're capable of. Maybe pick one part you could "
    "improve next time instead of judging yourself as a whole. What part "
    "of the assignment was hardest for you?\n"
    "\n"
    "Professional: How could I introduce thought checking during a brief workshop?\n"
    "Echo: You could use one relatable example to show how an automatic thought "
    "affects feelings and actions. Invite participants to write a thought "
    "they've had, ask what evidence supports and challenges it, then try "
    "a more balanced statement. Keep sharing optional and allow people to "
    "use a fictional example. That gives them a short, practical CBT skill "
    "without turning the workshop into a therapy session."
)

# A change here is a NEW experiment; manifests prohibit mixing versions.
CONFIGS = {
    'v3_control': {'prompt': PROMPT_V3, 'sentence_stop': False,
                   'repetition_penalty': 1.05, 'no_repeat_ngram_size': 0},
    'v4_examples': {'prompt': PROMPT_V4, 'sentence_stop': False,
                    'repetition_penalty': 1.05, 'no_repeat_ngram_size': 0},
    'v4_sentence': {'prompt': PROMPT_V4, 'sentence_stop': True,
                    'repetition_penalty': 1.05, 'no_repeat_ngram_size': 0},
    'v4_penalty110': {'prompt': PROMPT_V4, 'sentence_stop': True,
                     'repetition_penalty': 1.10, 'no_repeat_ngram_size': 0},
    'v4_ngram6': {'prompt': PROMPT_V4, 'sentence_stop': True,
                  'repetition_penalty': 1.05, 'no_repeat_ngram_size': 6},
}

DEFAULT_CONFIG = 'v4_sentence'
DEFAULT_MAX_NEW_TOKENS = 900
DEFAULT_SEQ_LENGTH = 4096
# This is a *heuristic*. It is not a validated clinical risk model.
RISK_RE = re.compile(
    r'\b(?:suicid(?:e|al)|self[- ]harm|self[- ]injur\w*|kill myself|end my life|'
    r'want to die|overdos\w*|hurt myself|not safe|in immediate danger|'
    r'abus(?:e|ed|ive)|sexual assault|domestic violence)\b', re.I
)
PRO_RE = re.compile(
    r'\b(?:my client|my clients|my patient|my patients|client presenting|'
    r'patient presenting|workshop|worksheet|clinical protocol|'
    r'therapeutic alliance|as a (?:therapist|counselor|clinician)|'
    r'teach (?:students|clients)|my practice)\b',re.I
)
BRIEF_RE = re.compile(
    r'^\s*(?:hi|hello|hey|ok(?:ay)?|thanks?(?: you)?|thank you|'
    r'great point|got it|good idea|cool|kool|sure|yes|no|'
    r'you got my point|you(?:\s+are|\'re) welcome|lol)[.!?,\s]*$',re.I
)
WORD_RE = re.compile(r"\b\w+(?:['’]\w+)*\b", re.UNICODE)
SENTENCE_END = re.compile(r'[.!?…。！？]["\'”’\)\]]*\s*$', re.UNICODE)


def config_spec(name):
    if name not in CONFIGS:
        raise ValueError(f'Unknown inference config {name!r}. Choices: {list(CONFIGS)}')
    return CONFIGS[name]


def config_fingerprint(name):
    item = config_spec(name)
    import json
    return hashlib.sha256(json.dumps(item,ensure_ascii=False,sort_keys=True).encode('utf-8')).hexdigest()


def classify_context(conversation):
    """Coarse categories for word targets; not a clinical safety classifier."""
    latest=next((x.get('content','') for x in reversed(conversation) if x.get('role')=='user'),'')
    if RISK_RE.search(latest):return 'potential_safety',None
    if PRO_RE.search(latest):return 'professional',200
    if BRIEF_RE.fullmatch(latest.strip()) or (len(latest.split()) <= 5 and not '?' in latest):
        return 'brief',40
    return 'ordinary',120


def load_model(adapter_dir,seq_length):
    # Unsloth must load before Torch/Transformers in the real GPU process.
    from unsloth import FastLanguageModel
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=str(adapter_dir), max_seq_length=int(seq_length), dtype=None,
        load_in_4bit=True, local_files_only=True, trust_remote_code=False)
    if tokenizer.pad_token_id is None:
        if tokenizer.eos_token_id is None:raise RuntimeError('Tokenizer missing EOS')
        tokenizer.pad_token=tokenizer.eos_token
    FastLanguageModel.for_inference(model)
    return model,tokenizer


def free_model(model=None,tokenizer=None):
    del model,tokenizer
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            try:torch.cuda.ipc_collect()
            except Exception:pass
    except ImportError:
        pass


def stop_tokens(tokenizer):
    ids=[]
    initial=tokenizer.eos_token_id
    if initial is not None:
        if isinstance(initial,(tuple,list)):ids.extend(map(int,initial))
        else:ids.append(int(initial))
    vocab=tokenizer.get_vocab()
    for token in ('<|im_end|>','<|eot_id|>'):
        if token in vocab:ids.append(int(vocab[token]))
    return list(dict.fromkeys(ids))


def apply_messages(tokenizer,messages):
    return tokenizer.apply_chat_template(messages,tokenize=True,add_generation_prompt=True,
                                         return_tensors='pt',return_dict=True)


def prepare_context(tokenizer,conversation,seq_length,max_new_tokens,prompt):
    capacity=seq_length-max_new_tokens
    if capacity<512:raise ValueError('Need at least 512 prompt/context tokens')
    if not conversation or conversation[-1].get('role')!='user':
        raise ValueError('Conversation must end with a user turn')
    messages=[{'role':'system','content':prompt}]
    for turn in conversation:
        if turn.get('role') in ('user','assistant') and isinstance(turn.get('content'),str):
            messages.append({'role':turn['role'],'content':turn['content']})
    if messages[-1]['role']!='user':raise ValueError('Latest recognized turn must be user')
    before=len(messages)
    dropped=truncated=0
    inputs=apply_messages(tokenizer,messages)
    while inputs['input_ids'].shape[-1]>capacity and len(messages)>2:
        messages.pop(1);dropped+=1
        if len(messages)>2 and messages[1]['role']=='assistant':
            messages.pop(1);dropped+=1
        inputs=apply_messages(tokenizer,messages)
    if inputs['input_ids'].shape[-1]>capacity:
        user=messages[-1]
        ids=tokenizer.encode(user['content'],add_special_tokens=False)
        while inputs['input_ids'].shape[-1]>capacity and len(ids)>1:
            excess=int(inputs['input_ids'].shape[-1]-capacity)
            remove=min(max(1,excess),len(ids)-1)
            ids=ids[remove:];truncated+=remove
            user['content']=tokenizer.decode(ids,skip_special_tokens=True)
            inputs=apply_messages(tokenizer,messages)
    if inputs['input_ids'].shape[-1]>capacity:
        raise RuntimeError('System prompt + final user turn cannot fit into context')
    return inputs,{
        'prompt_tokens':int(inputs['input_ids'].shape[-1]),
        'original_turns':before-1,
        'dropped_earlier_turns':dropped,
        'truncated_latest_user_tokens':truncated,
        'context_modified':bool(dropped or truncated),
    }


def _stopper_factory(tokenizer,prompt_tokens,word_target,stopping_class):
    """Conservative stop: after full sentence near target, never mid-sentence.

    Decodes every fourth token after an inexpensive token-length gate to
    reduce tokenizer overhead. This is *not* a safety mechanism.
    """
    class SentenceStop(stopping_class):
        def __init__(self):
            self.activated=False
            self.last_checked=0
            self.word_count_at_stop=None
        def __call__(self,input_ids,scores,**kwargs):
            if word_target is None:return False
            generated=int(input_ids.shape[-1]-prompt_tokens)
            if generated < max(8,int(word_target*.75)) or generated-self.last_checked<4:
                return False
            self.last_checked=generated
            text=tokenizer.decode(input_ids[0,prompt_tokens:],skip_special_tokens=True)
            count=len(WORD_RE.findall(text))
            if count>=word_target and SENTENCE_END.search(text.rstrip()):
                # Only stop at a sentence ending, not in the middle of words.
                self.activated=True
                self.word_count_at_stop=count
                return True
            return False
    return SentenceStop()


def infer(model,tokenizer,conversation,*,config=DEFAULT_CONFIG,
          seq_length=DEFAULT_SEQ_LENGTH,max_new_tokens=DEFAULT_MAX_NEW_TOKENS):
    """Generate one response; return (unaltered text, auditable metadata)."""
    spec=config_spec(config)
    prompt=spec['prompt']
    role,target=classify_context(conversation)
    inputs,context=prepare_context(tokenizer,conversation,seq_length,max_new_tokens,prompt)
    import torch  # Unsloth has already been imported by load_model in GPU workflow.
    from transformers import StoppingCriteria,StoppingCriteriaList
    inputs={k:v.to(model.device) for k,v in inputs.items()}
    prefix=int(inputs['input_ids'].shape[-1])
    stops=stop_tokens(tokenizer)
    if not stops:raise ValueError('Tokenizer has no EOS/end-of-turn tokens')
    stopper=None
    kwargs={}
    if spec['sentence_stop'] and role!='potential_safety':
        stopper=_stopper_factory(tokenizer,prefix,target,StoppingCriteria)
        kwargs['stopping_criteria']=StoppingCriteriaList([stopper])
    if spec['no_repeat_ngram_size']:
        kwargs['no_repeat_ngram_size']=spec['no_repeat_ngram_size']
    with torch.inference_mode():
        produced=model.generate(
            **inputs, max_new_tokens=int(max_new_tokens), do_sample=False,
            repetition_penalty=spec['repetition_penalty'],
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=stops if len(stops)>1 else stops[0],
            use_cache=True,**kwargs)
    ids=produced[0,prefix:]
    text=tokenizer.decode(ids,skip_special_tokens=True).strip()
    n=int(ids.numel())
    last=int(ids[-1].item()) if n else None
    ended=last in stops
    length_stopped=bool(stopper is not None and stopper.activated and not ended)
    hit_token_limit=n>=max_new_tokens and not ended and not length_stopped
    finish=('end_of_turn' if ended else 'sentence_stop' if length_stopped
            else 'token_limit' if hit_token_limit else 'other')
    word_tokens=[x.casefold() for x in WORD_RE.findall(text)]
    words=len(word_tokens)
    grams=[tuple(word_tokens[j:j+6]) for j in range(max(0,words-5))]
    from collections import Counter
    most=max(Counter(grams).values(),default=0)
    return text,{
        **context,'generation_config':config,'config_fingerprint':config_fingerprint(config),
        'role_class':role,'target_words':target,'generated_tokens':n,'word_count':words,
        'finish_reason':finish,'hit_token_limit':hit_token_limit,
        'ended_with_stop_token':ended,'sentence_stopped':length_stopped,
        'sentence_ended':bool(SENTENCE_END.search(text)),
        'repeated_sixgram':most>=3,
        'max_sixgram_repeat':most,
        'has_markdown_formatting':bool(re.search(r'(?m)^\s*(?:#{1,6}\s|[-*]\s|\d+\.\s)|\|[^|]+\|',text)),
        'punctuation_ending':bool(SENTENCE_END.search(text)),
        'under_20_words':words<20,'over_110_words':words>110,
        'over_160_words':words>160,'over_200_words':words>200,
        'over_role_target':bool(target is not None and words>target+25),
        'safety_stop_bypassed':role=='potential_safety',
    }
