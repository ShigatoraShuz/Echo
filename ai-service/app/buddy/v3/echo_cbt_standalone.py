#!/usr/bin/env python3
"""Isolated Echo CBT style experiment: format-only (CPU) or chat (local CUDA).

Only uses existing, read-only SeaLLMs-v3-7B-Chat + mixed_lr_1e4 LoRA.
NOT a deployment safety replacement for the existing Echo application.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from typing import Any

from formatting import format_existing, format_chat_response, wrap_for_console, word_count

HERE = Path(__file__).resolve().parent
POLICY_PATH = HERE / "reference" / "cbt-settings.json"
STYLE_PATH = HERE / "style_config.json"
VERSION = "echo_cbt_reviewer_informed_20261117"
TALK_VERSION = "echo_cbt_spoken_counselor_20261118"
CHAT_VERSION = "echo_cbt_chat_counselor_20261118"
TALK_ADVISORY_ISSUES = frozenset({
    'hard_token_limit', 'extreme_response_length', 'extreme_structural_overload',
    'stock_reassurance', 'excessive_questions_4plus', 'stacked_generic_advice',
    'malformed_discourse_transition',
})


def talk_issue_groups(issues):
    """Unknown issues remain blocking; only explicit style checks are advisory."""
    unique = list(dict.fromkeys(issues))
    return ([item for item in unique if item not in TALK_ADVISORY_ISSUES],
            [item for item in unique if item in TALK_ADVISORY_ISSUES])


def generation_budget(delivery_mode, retry=False):
    if delivery_mode not in ('chat','voice'):raise ValueError('Invalid delivery mode')
    return 1536

# Local, read-only model path fallbacks. User may override using CLI or env vars.
BASE_CANDIDATES = [
    str(HERE / "models" / "base"),
    r"E:\Python Project\CODEX\models\cbt\base",
    r"E:\Python Project\PROJECTS\Thesis2\CBT_RESPONSE\CBT_BASE_MODEL\assets\models\SeaLLMs-v3-7B-Chat",
]
ADAPTER_CANDIDATES = [
    str(HERE / "models" / "adapter"),
    r"E:\Python Project\CODEX\models\cbt\adapter",
    r"E:\Python Project\PROJECTS\Thesis2\CBT_RESPONSE\CBT_BASE_MODEL\outputs\quality_tuning\mixed_lr_1e4\final_adapter",
]

CRISIS_CUES = re.compile(
    r"\b(?:kill\s+(?:myself|ourselves)|suicid(?:al|e)|end\s+my\s+life|"
    r"want\s+to\s+die|going\s+to\s+hurt\s+myself|harm\s+myself|self[- ]harm|"
    r"magpakamatay|pagpapakamatay|saktan\s+(?:ang\s+)?sarili|"
    r"patayin\s+ang\s+sarili|ayoko\s+nang\s+mabuhay|"
    r"overdose\s+(?:myself|on\s+pills))\b",
    flags=re.IGNORECASE,
)

FIL_CUES = {"ako", "ko", "kong", "ang", "ng", "mga", "paano", "kaya", "sobrang", "sobra",
            "grabe", "dami", "ginagawa", "kakayanin", "hindi", "nahihirapan", "pagod",
            "ka", "mo", "na", "lang", "naman", "kasi", "pwedeng", "puwede", "bakit", "parang",
            "yung", "yun", "ito", "sa", "buhay", "po", "salamat", "tayo", "pero", "wala"}
EN_CUES = {"the", "is", "are", "schoolwork", "assignment", "deadline", "tasks", "task", "stress", "stressed",
           "i", "my", "me", "with", "because", "feel", "work", "and", "about", "can", "you", "help", "study"}

# Explicit requests for instructions require a distinct structured-support role.
# General therapy/help questions still use the original ordinary/professional policies.
STEP_REQUEST = re.compile(
    r"\b(?:list\s+(?:the\s+|some\s+|a\s+few\s+)?(?:steps?|things\s+to\s+do)|"
    r"give\s+me\s+(?:(?:a\s+)?list\s+of\s+)?(?:steps?|bullet\s+points?|instructions)|"
    r"(?:what|which)\s+(?:are\s+the\s+|steps?\s+)?steps?\s+(?:can|could|should|do)\s+i|"
    r"step[ -]by[ -]step|"
    r"(?:explain|show|tell)(?:\s+me)?\s+(?:the\s+)?steps?|"
    r"numbered\s+list|bullet\s+points?|"
    r"(?:how\s+do\s+i|paano\s+(?:ko|ba|mag))\b.*\b(?:step|steps|hakbang))\b",
    flags=re.IGNORECASE,
)

# Ambiguous idioms must not automatically become a clinical/suicide label.
AMBIGUOUS_GIVE_UP = re.compile(
    r"\b(?:i\s+(?:(?:just\s+)?wanna|want\s+to|feel\s+like|might|just\s+want\s+to)\s+give\s+up|"
    r"i\s+(?:am|['’]m)\s+(?:about\s+to\s+)?giving\s+up|"
    r"i\s+feel\s+like\s+giving\s+up|"
    r"i\s+give\s+up|"
    r"gusto\s+ko\s+na(?:ng)?\s+sumuko|"
    r"susuko\s+na\s+(?:ako|ko))\b",re.I)
TASK_CONTEXT = re.compile(
    r"\b(?:tasks?|school|schoolwork|assignments?|homework|homeworks|"
    r"studying|exams?|work|job|projects?|deadlines?|responsibilit(?:y|ies)|"
    r"chores?|plate|workload|grades?|classes?|quizzes|"
    r"gawain|trabaho|aralin|iskwela|eskwela|pagod\s+sa\s+school|"
    r"give\s+up\s+on\s+(?:my\s+)?(?:task|school|job|project))\b",re.I)
LIFE_GIVE_UP = re.compile(r"\b(?:give\s+up\s+on\s+(?:life|living|everything)|"
    r"wanna\s+give\s+up\s+on\s+(?:life|living)|"
    r"do\s+not\s+want\s+to\s+(?:be\s+alive|live\s+anymore)|"
    r"don't\s+want\s+to\s+(?:be\s+alive|live\s+anymore))\b",re.I)

SIMPLE_BRIEF = re.compile(
    r"^(?:thanks(?:\s+(?:a lot|so much|for listening))?|thank you(?:\s+so much)?|"
    r"salamat(?:\s+(?:po|ha|talaga))?|ok(?:ay)?|sige|got it|noted|"
    r"i see|oo|yes|no|that's helpful|that helps)[.!\s]*$", re.IGNORECASE)
PROFESSIONAL = re.compile(
    r"\b(?:my\s+clients?|my\s+patient|for\s+(?:a|my|the)\s+client|"
    r"therapeutic\s+alliance|cbt\s+(?:protocol|workshop|worksheet)|"
    r"exposure\s+therapy|in\s+(?:our|my)\s+sessions|"
    r"self[- ]directed\s+exercise|as\s+a\s+(?:counselor|therapist)|"
    r"how\s+(?:can|should)\s+cbt\s+strategies)\b",re.IGNORECASE)

# Reproduce the role/format of the original handover prompts; supplement only
# presentation/length, never replace the behavior and clinical-boundary rules.
STYLE_APPENDIX = """

PRESENTATION-ONLY EXPERIMENT (preserve the underlying CBT support approach):
Write like a warm, respectful, practical friend instead of a worksheet or a lecture. Answer the LAST user's actual concern immediately. Keep genuine empathy, context relevance, sound CBT-informed support, professional boundaries and essential safety content.
For everyday support prefer 1 or 2 short, natural paragraphs, usually around 55-95 English words or 45-85 Filipino/Taglish words. A very simple acknowledgment may be 15-40 words. Do not pad to reach a quota. Start by reflecting their specific concern, then give ONE relevant manageable idea if useful. Use a CBT technique naturally rather than naming techniques or listing a menu. A follow-up question is optional, at most one, and should sound genuine. No headings, bullets, tables, unnecessary introductions or conclusions for everyday conversation. Avoid repeated reassurance, excessive details, false praise, stiff Filipino and generic scripts. Do not change the task or assume facts not provided.
For an explicit professional request, fully answer the requested task in clear, efficient language, roughly 120-190 words when sufficient; allow a few steps if essential to the request. Do not shorten away essential qualifications or safety advice. Never sacrifice safety completeness for brevity. Finish every thought in a complete sentence. Output the reply only.
""".strip()

# Qwen ChatML fallback is used ONLY if the adapter tokenizer template fails the
# actual assistant prefix check. Never edit the tokenizer files on disk.
CHATML_TEMPLATE = """{% for message in messages %}<|im_start|>{{ message['role'] }}\n{{ message['content'] }}<|im_end|>\n{% endfor %}{% if add_generation_prompt %}<|im_start|>assistant\n{% endif %}"""


def policy() -> dict[str, Any]:
    data = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    expected = "selected_mixed_lr_1e4_v49_isolated_cascade_20261025"
    if data["generationPolicy"]["VERSION"] != expected:
        raise ValueError("Uploaded handover baseline version unexpectedly changed")
    if data["runtime"]["seqLength"] != 4096:
        raise ValueError("Unexpected model context budget")
    return data


def style() -> dict[str, Any]:
    return json.loads(STYLE_PATH.read_text(encoding="utf-8"))


def choose_model_path(explicit: str | None, env_name: str, choices: list[str]) -> Path:
    if explicit:
        return Path(explicit).expanduser()
    if os.getenv(env_name):
        return Path(os.environ[env_name]).expanduser()
    for c in choices:
        if Path(c).is_dir():
            return Path(c)
    return Path(choices[0])


def model_locations(args: argparse.Namespace) -> tuple[Path, Path]:
    return (choose_model_path(args.base_dir, "ECHO_CBT_BASE", BASE_CANDIDATES),
            choose_model_path(args.adapter_dir, "ECHO_CBT_ADAPTER", ADAPTER_CANDIDATES))


def preflight(base: Path, adapter: Path, check_hashes: bool = False) -> dict[str, Any]:
    baseconfig = base / "config.json"
    adapterconfig = adapter / "adapter_config.json"
    adapterweights = adapter / "adapter_model.safetensors"
    if not baseconfig.is_file():
        raise FileNotFoundError(f"Missing local base config: {baseconfig}")
    if not adapterconfig.is_file():
        raise FileNotFoundError(f"Missing local adapter config: {adapterconfig}")
    if not adapterweights.is_file():
        raise FileNotFoundError(f"Missing local adapter weights: {adapterweights}")
    basejson = json.loads(baseconfig.read_text(encoding="utf-8"))
    adapjson = json.loads(adapterconfig.read_text(encoding="utf-8"))
    if basejson.get("model_type") != "qwen2" or basejson.get("num_hidden_layers") != 28:
        raise ValueError("Incompatible base: expected Qwen2 SeaLLMs-v3-7B-Chat 28 layers")
    expected = policy()["adapterConfig"]
    for k in ("r", "lora_alpha", "peft_type", "task_type"):
        if adapjson.get(k) != expected.get(k):
            raise ValueError(f"Adapter config mismatch at {k}: {adapjson.get(k)!r}")
    if set(adapjson.get("target_modules", [])) != set(expected.get("target_modules", [])):
        raise ValueError("Adapter LoRA target modules mismatch")
    recorded = {x["path"].replace("\\", "/"): x for x in policy()["manifestEntries"]}
    for local, reference in ((baseconfig, 'cbt/base/config.json'),
                             (adapterconfig, 'cbt/adapter/adapter_config.json'),
                             (adapterweights, 'cbt/adapter/adapter_model.safetensors')):
        expected_meta = recorded.get(reference)
        if expected_meta and local.stat().st_size != expected_meta['bytes']:
            raise ValueError(f"Model inventory size mismatch: {local}")
        if check_hashes and expected_meta:
            h=hashlib.sha256()
            with local.open('rb') as inp:
                for chunk in iter(lambda:inp.read(1024*1024),b''):
                    h.update(chunk)
            if h.hexdigest() != expected_meta['sha256']:
                raise ValueError(f"Model SHA-256 differs from uploaded handover: {local}")
    if not (base / 'model.safetensors.index.json').is_file():
        raise FileNotFoundError('Missing model.safetensors.index.json under local base directory')
    return {'base_dir':str(base),'adapter_dir':str(adapter),
            'model':'SeaLLMs-v3-7B-Chat + mixed_lr_1e4',
            'baseline_policy':policy()['generationPolicy']['VERSION'],
            'experimental_policy':VERSION,'weights_included_in_zip':False,
            'manifest_verification':'SHA256 + size' if check_hashes else 'size + architecture + PEFT config'}


def language(latest: str) -> str:
    tokens = re.findall(r"\b\w+(?:['’]\w+)*\b", latest.lower())
    fil = sum(t in FIL_CUES for t in tokens)
    eng = sum(t in EN_CUES for t in tokens)
    if fil < 2:
        return 'english'
    if eng >= 2:
        return 'taglish'
    return 'filipino'


COUNT_WORDS = dict(zip('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split(), range(1,21)))
COUNT_WORDS.update(dict(zip('isa dalawa tatlo apat lima anim pito walo siyam sampu'.split(),range(1,11))))
COUNT_WORDS.update(dict(zip('isang dalawang tatlong apat limang anim pitong walong siyam sampung'.split(),range(1,11))))
COUNT_WORDS.update(dict(zip('twenty thirty forty fifty sixty seventy eighty ninety'.split(),range(20,100,10))))
LIST_NOUNS = r'(?:steps?|tips?|examples?|reasons?|items?|things|ways?|strategies|suggestions?|ideas?|hakbang|paraan|halimbawa|dahilan)'

def requested_item_count(latest):
    units='one|two|three|four|five|six|seven|eight|nine'
    numbers=r'(?:\d+|(?:(?:'+units+r')\s+)?hundred|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[-\s](?:'+units+r'))?|'+'|'.join(COUNT_WORDS)+r')'
    match=re.search(r'\b('+numbers+r')(?:\s+(?:practical|simple|helpful|different|specific|useful|easy|small|coping|CBT|mga)){0,2}\s+'+LIST_NOUNS+r'\b',latest,re.I)
    if not match:
        match=re.search(r'\b(?:list|give me|show me|provide|suggest|name|recommend)\s+(?:all\s+)?('+numbers+r')\s+(?!(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b)\w+',latest,re.I)
    if not match:return None
    if re.search(r'\b(?:tried|have|received|got|read|gave me)\s*$',latest[:match.start()],re.I):return None
    value=match[1].lower()
    if value.isdigit():return int(value)
    if value.endswith('hundred'):return (COUNT_WORDS.get(value.split()[0],1) if value!='hundred' else 1)*100
    return sum(COUNT_WORDS[word] for word in re.split(r'[-\s]+',value))

def list_target(latest):
    count=requested_item_count(latest)
    return max(1,min(10,count)) if count is not None else 3

def list_limit_notice(answer, latest):
    requested=requested_item_count(latest)
    if requested is None or requested<=10:return answer
    first=re.search(r'(?<!\S)1[.)]\s+\S',answer)
    if not first:raise ValueError('Missing approved list')
    intro,items=answer[:first.start()],answer[first.start():]
    labels=[re.escape(str(requested)),*[re.escape(word) for word,value in COUNT_WORDS.items() if value==requested]]
    if 20<requested<100 and requested%10:
        tens=next(word for word,value in COUNT_WORDS.items() if value==requested//10*10)
        unit=next(word for word,value in COUNT_WORDS.items() if value==requested%10)
        labels.append(re.escape(tens)+r'[-\s]'+re.escape(unit))
    intro=re.sub(r'\b(?:'+'|'.join(labels)+r')\b(?=\s+(?:[\w-]+\s+){0,2}'+LIST_NOUNS+r'\b)','ten',intro,flags=re.I)
    return 'I can provide a maximum of ten items per reply.\n\n'+intro+items

def role(latest: str) -> str:
    if SIMPLE_BRIEF.fullmatch(latest.strip()):
        return 'brief'
    if requested_item_count(latest) is not None or STEP_REQUEST.search(latest) or re.search(r'\b(?:list|give me|suggest|provide)\b.{0,35}\b'+LIST_NOUNS+r'\b',latest,re.I):
        return 'steps'
    if PROFESSIONAL.search(latest):
        return 'professional'
    if STEP_REQUEST.search(latest):
        return 'steps'
    return 'ordinary'


def safety_disposition(messages: list[dict[str, str]]) -> str:
    """Return explicit_urgent / ambiguous_unqualified / contextual_ambiguous / ordinary.

    A lexical cue is NOT clinical risk identification. Unqualified ambiguity is
    withheld for the existing Echo support router rather than guessed safe.
    Contextual ambiguity is supported with a clarification-friendly prompt.
    """
    if any(CRISIS_CUES.search(m['content']) or LIFE_GIVE_UP.search(m['content'])
           for m in messages[-6:] if m['role']=='user'):
        return 'explicit_urgent'
    latest=messages[-1]['content']
    if AMBIGUOUS_GIVE_UP.search(latest):
        return 'contextual_ambiguous' if TASK_CONTEXT.search(latest) else 'ambiguous_unqualified'
    return 'ordinary'


def safety_review_needed(messages: list[dict[str, str]]) -> bool:
    return safety_disposition(messages) in ('explicit_urgent','ambiguous_unqualified')


def safety_withhold(disposition: str, version: str = VERSION) -> dict:
    issue=('potential_safety_language_requires_Echo_support_routing'
           if disposition=='explicit_urgent' else 'unqualified_give_up_requires_human_safety_review')
    return {'reply':None,'needs_review':True,'issues':[issue],
            'safety_disposition':disposition,
            'warning':('The standalone prototype cannot safely resolve this language. '
                       'Use Echo’s existing safety/support router for assessment and appropriate human help.'),
            'inference_version':version,'attempts':0}


def validate_history(history: list[dict[str, str]]) -> list[dict[str,str]]:
    if not isinstance(history,list) or not history or len(history)>20:
        raise ValueError('History must be a nonempty list of at most 20 turns')
    cleaned=[]
    for m in history:
        if not isinstance(m,dict) or m.get('role') not in ('user','assistant') or not isinstance(m.get('content'),str) or not m['content'].strip():
            raise ValueError('Every history turn must have role=user/assistant and nonempty string content')
        cleaned.append({'role':m['role'], 'content':m['content'].strip()})
    if cleaned[-1]['role'] != 'user':
        raise ValueError('History must end with a user turn')
    if sum(len(m['content']) for m in cleaned)>20000:
        raise ValueError('History exceeds 20,000 characters')
    return cleaned


DETAIL_REQUEST = re.compile(r"\b(explain|detail(?:ed|s)?|elaborate|tell me more|paliwanag|ipaliwanag|detalyado)\b", re.I)


def response_role(latest: str, delivery_mode='chat') -> str:
    if delivery_mode not in ('chat','voice'):raise ValueError('Invalid delivery mode')
    request=role(latest)
    if delivery_mode=='voice' and request=='ordinary' and re.search(r'\b(steps?|step-by-step|hakbang|numbered list|bullet points)\b',latest,re.I):return 'steps'
    return 'brief' if delivery_mode=='voice' and request=='ordinary' and not DETAIL_REQUEST.search(latest) else request


def system_prompt(latest: str, *, retry=False, delivery_mode='chat', strict_review=False) -> str:
    p=policy()['generationPolicy']
    selected = p['REWRITE_SYSTEM'] if retry else p['V41_SYSTEM']
    lang = language(latest)
    if lang=='filipino':selected += p['FILIPINO_STYLE_GUIDE']
    elif lang=='taglish':selected += p['TAGLISH_STYLE_GUIDE']
    request=response_role(latest,delivery_mode)
    if request in ('ordinary','brief','steps'):
        selected=('You are Buddy, a warm, practical CBT-informed support assistant. Reply directly to the latest user message, using the earlier conversation only when relevant. Speak like a thoughtful person, not a worksheet or lecture. Do not invent experiences or facts, diagnose, prescribe medication, promise improvement, minimize distress, or claim to be a therapist. Preserve appropriate safety and professional-help guidance. Persistent or worsening distress and impaired functioning deserve appropriate real-world support. Do not infer a diagnosis from a metaphor or assume that ambiguous task-related frustration is a suicide disclosure. When the person shares writing, respond to their experience rather than rewriting or continuing it. Output only the reply. ')
        if request=='steps':selected+='The user requested a list. Answer that task as distinct numbered items with concrete, concise, complete sentences. The explicit list count overrides ordinary advice and length preferences. '
        else:selected+='Answer in three or four complete sentences across one or two natural paragraphs. Briefly acknowledge the specific feeling, then explain one doable starting action. Do not retell the whole message, stack strategies, add headings or lists, or finish with generic encouragement. One relevant reflection or question is optional. '
        if retry:selected+='The previous draft failed quality checks. Give a new complete reply to the same user, preserving the conversation and following these instructions carefully. '
        if lang=='filipino':selected+=p['FILIPINO_STYLE_GUIDE']
        elif lang=='taglish':selected+=p['TAGLISH_STYLE_GUIDE']
    extra=''
    if request=='steps':
        extra=('\n\nEXPLICIT STEP-BY-STEP USER REQUEST: The user asked for instructions, '
               'so respond to their specific latest question with a SHORT readable numbered list '
               f'with exactly {list_target(latest)} complete items. '
               'Put each step on a separate line as "1. Action: short explanation.". '
               'Keep an optional one-sentence lead-in and brief close. '
               'Do not start a step you cannot finish. '
               'Do not turn the request into a full worksheet or lecture. '
               'This explicit request overrides the ordinary rule against numbered lists; '
               'retain all CBT boundaries and safety guidance.')
    if AMBIGUOUS_GIVE_UP.search(latest) and TASK_CONTEXT.search(latest):
        extra+=('\n\nAMBIGUOUS LANGUAGE: They said "give up" while discussing tasks/work. '
                'Do not diagnose or assume suicide risk or assume they are safe. '
                'Acknowledge the strain, give a manageable next step, and when meaning '
                'remains unclear ask one gentle question about what "give up" means '
                'or whether they feel safe. Never ignore clear signs of danger.')
    if delivery_mode=='voice' and response_role(latest,delivery_mode)=='brief':
        extra+=('\n\nSPOKEN CONVERSATION: Respond naturally in one or two short, complete sentences. '
                'Reflect the specific concern and offer one manageable idea if useful. '
                'Avoid filler and long introductions. At most one gentle question. '
                'Keep all safety boundaries. Do not cut off an unfinished thought.')
    if request!='steps':
        extra+=('\n\nREVIEWER-INFORMED CONVERSATION: Preserve specific emotional validation and appropriate boundaries. Explain how to start one relevant action rather than naming techniques. Encourage reflection without forcing a question. Do not force questions. Complete every thought and recommendation, including how to finish an exercise. Do not use stock reassurance, minimize symptoms, diagnose, or promise improvement. Persistent or worsening symptoms or impaired functioning warrant professional support.')
    if request=='steps':
        count=list_target(latest)
        extra+=f'\nLIST REQUIREMENT OVERRIDES SHORTNESS TARGETS: Provide exactly {count} distinct, relevant, complete numbered items, numbered 1 through {count}. Use one concise complete sentence per item, with concrete detail. Do not stop early or add another item. Unspecified list counts default to three.'
        if (requested_item_count(latest) or 0)>10:extra+=' Briefly explain that you are limiting this reply to ten items.'
    if persistent_concern(latest):
        extra+='\nCURRENT PERSISTENT CONCERN: First acknowledge the weeks of reduced enjoyment and the impact on self-worth. In the SECOND sentence recommend speaking with a counselor or mental-health professional because this has already persisted; do not postpone support until other strategies fail. Then explain ONE small observable starting action, such as briefly noting a change in energy or enjoyment during a daily activity to help describe the pattern. Keep the entire reply to three or four sentences. No hobby suggestions or menu of self-care activities. Do not diagnose.'
    if request in ('ordinary','brief'):
        if not persistent_concern(latest) and re.search(r'\b(?:assignment|school|deadline|requirements|academic|procrastinat)\w*\b',latest,re.I):
            extra+='\nFor this schoolwork concern, explain how to select ONE task (for example the nearest deadline), then begin its smallest concrete part for a short time. Do not add a new daily/weekly planning program or tell them simply to prioritize or break tasks down. Keep this as prose, with no numbered substeps or unfinished introduction.'
        elif re.search(r'\b(?:future|family|disappoint|failure|fail|expectations)\b',latest,re.I):
            extra+='\nConnect the exercise to their feared outcome: distinguish the prediction about failure or disappointing family from what they actually know, then identify one controllable action. Explain the exercise in plain words instead of merely naming mindfulness or grounding. Avoid unrelated generic relaxation advice.'
    if not strict_review:
        # Remove conflicting sentence-count templates while retaining concern-specific advice.
        selected=selected.replace('Answer in three or four complete sentences across one or two natural paragraphs.', 'Prefer concise, complete conversation, usually around 60 words; use more detail when needed.')
        extra=extra.replace('Respond naturally in one or two short, complete sentences.', 'Respond naturally with complete thoughts, using roughly 60 words as a soft target.')
        extra=extra.replace('In the SECOND sentence recommend', 'When appropriate, recommend')
        extra=extra.replace('Keep the entire reply to three or four sentences.', 'Use enough detail to make the suggestion usable.')
    return selected + '\n\n' + (STYLE_APPENDIX if request=='professional' else '') + extra


def seed_for(messages: list[dict[str,str]], system: str) -> int:
    base=policy()['generationPolicy']
    payload = {'conversation':messages,'system_prompt':system,'base_seed':base['CREATIVE_SEED'],
               'temperature':base['CREATIVE_TEMPERATURE'],'top_p':base['CREATIVE_TOP_P'],
               'top_k':base['CREATIVE_TOP_K']}
    return int(hashlib.sha256(json.dumps(payload,sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:8],16)


def generation_seed(messages, prompt, delivery_mode='chat', generation_attempt=0):
    seed=seed_for(messages,prompt)
    return (seed+int(generation_attempt)*104729) % (2**32)


def verify_template(tokenizer) -> str:
    probe=[{'role':'user','content':'Hello'}]
    try:
        text=tokenizer.apply_chat_template(probe,tokenize=False,add_generation_prompt=True)
    except (ValueError,TypeError):
        text=''
    if text.rstrip().endswith('<|im_start|>assistant'):
        return 'adapter_valid'
    vocab=tokenizer.get_vocab()
    if not {'<|im_start|>','<|im_end|>'}.issubset(vocab):
        raise RuntimeError('Tokenizer template invalid and ChatML tokens not available; refusing inference')
    tokenizer.chat_template=CHATML_TEMPLATE
    text=tokenizer.apply_chat_template(probe,tokenize=False,add_generation_prompt=True)
    if not text.rstrip().endswith('<|im_start|>assistant'):
        raise RuntimeError('In-memory assistant marker repair failed')
    return 'in_memory_chatml_repair'


def stop_ids(tokenizer) -> list[int]:
    ids=[]
    if isinstance(tokenizer.eos_token_id,int):ids.append(tokenizer.eos_token_id)
    for t in ('<|im_end|>','<|eot_id|>'):
        if t in tokenizer.get_vocab():
            tid=tokenizer.convert_tokens_to_ids(t)
            if isinstance(tid,int):ids.append(tid)
    ids=list(dict.fromkeys(ids))
    if not ids:raise RuntimeError('Model EOS/end-of-turn tokens missing')
    return ids


# Stop only after a truly complete answer, never a pending numbered item.
DANGLING_NUMBERED = re.compile(r"(?:^|\s)(?:\d{1,2}|[a-zA-Z])[.)]\s*$")
DANGLING_STEP = re.compile(r"(?i)(?:^|\n|[.!?]\s+)\s*(?:step|hakbang)\s+\d{1,2}\s*[:.)-]?\s*$")
DANGLING_BULLET = re.compile(r"(?m)(?:^|\n)\s*[-*+]\s*$")
DANGLING_CLAUSE = re.compile(r"(?i)\b(?:and|or|but|with|because|such as|including|first|then|to|for|"
                            r"the|a|an|by|of|as|after|before|that|which)\s*[,:;]?\s*$")


def dangling_structure(text: str) -> bool:
    """Cheap fail-closed structural check, independent of required role."""
    t=text.strip()
    return bool(DANGLING_NUMBERED.search(t) or DANGLING_STEP.search(t)
                or DANGLING_BULLET.search(t) or DANGLING_CLAUSE.search(t)
                or re.search(r'(?m)(?:^|\n)\s*(?:#{1,6}|[-*]|\d+[.)])\s*$',t))


def sentence_boundary(text: str, role_name: str) -> bool:
    t=text.strip()
    if not t or t[-1] not in '.!?。”！？':return False
    if t.count('```')%2 or dangling_structure(t):return False
    return True

def practical_help_requested(text):
    return bool(re.search(r'\b(?:how (?:can|do|could|should) I|what can I do|where (?:can|do) I start|paano|anong (?:gagawin|puwede))\b',text,re.I))

def usable_start(text):
    # A structural specificity check, not a clinical or semantic quality score.
    if re.search(r'\b(?:reflect(?:ing)? on|list(?:ing)?|writ(?:e|ing)|select(?:ing)?|identif(?:y|ying)|observ(?:e|ing)|pay(?:ing)? attention to|notic(?:e|ing)|start by|begin by)\b',text,re.I):return True
    return bool(re.search(r'\b(?:write|choose|pick|set|name|identify|list|note|jot|notice|schedule|contact|walk|breathe|open|spend|ask yourself|start with|begin with|take (?:one|a|three)|try (?:one|a|this)|focus on (?:one|a|the)|talk (?:to|with)|reach out)\b',text,re.I))

def persistent_concern(text):
    return bool(re.search(r'\b(?:weeks?|months?|for a while)\b',text,re.I) and re.search(r'\b(?:empty|emptiness|worth|worthless|lost interest|loss of interest|lost enjoyment|no longer|don.t feel exciting)\b',text,re.I))

def persistent_support_covered(answer):
    return bool(re.search(r'\b(?:counsel[lo]+r|therapist|mental.health professional|healthcare|doctor|professional (?:help|support))\b',answer,re.I) and re.search(r'\b(?:weeks?|months?|persist\w*|ongoing|lasting|prolonged|extended period|for a while)\b',answer,re.I))


def quality_issues(answer: str, latest: str, role_name: str, was_limited: bool) -> list[str]:
    a=answer.strip()
    issues=[]
    if not a: issues.append('empty')
    if was_limited:issues.append('hard_token_limit')
    if persistent_concern(latest) and not persistent_support_covered(a):issues.append('persistent_distress_support_missing')
    if role_name in ('ordinary','brief') and practical_help_requested(latest) and not usable_start(a):issues.append('generic_advice_without_starting_action')
    if role_name in ('ordinary','brief'):
        if re.search(r"\b(?:you(?:'re| are) not alone|seeking help is a sign of strength|everyone has their own unique journey)\b",a,re.I):issues.append('stock_reassurance')
        if re.search(r'\b(?:another (?:idea|strategy)|experiment with different (?:forms|activities)|(?:engaging in|forms of) self.care activities|remember to prioritize (?:sleep|nutrition))\b',a,re.I):issues.append('stacked_generic_advice')
    if a and dangling_structure(a): issues.append('dangling_list_or_clause')
    if a and not sentence_boundary(a,role_name):issues.append('unfinished_structure_or_clause')
    if role_name!='professional' and a.count('?')>=4:issues.append('excessive_questions_4plus')
    if role_name in ('ordinary','steps') and word_count(a)>(max(210,list_target(latest)*40) if role_name=='steps' else 240 if persistent_concern(latest) else 170):issues.append('extreme_response_length')
    if role_name=='brief' and word_count(a)>95:issues.append('extreme_response_length')
    if role_name not in ('professional','steps') and re.search(r'(?m)^\s*(?:#|\d+[.)]\s|[-*]\s)',a):issues.append('extreme_structural_overload')
    if role_name not in ('professional','steps') and re.search(r'(?<!\S)\d{1,2}[.)]\s+\S',a) and 'extreme_structural_overload' not in issues:issues.append('extreme_structural_overload')
    if persistent_concern(latest) and re.search(r'\b(?:activities|hobbies|small goals)\b',a,re.I) and not re.search(r'\b(?:write|note|record|track|jot|minute|minutes|open|one task|one activity|one change|pay attention to|observe|notice)\b',a,re.I):issues.append('persistent_advice_without_concrete_start')
    if role_name=='steps':
        markers=[int(x) for x in re.findall(r'(?<!\S)(\d{1,2})[.)]\s+\S',a)]
        if not markers:issues.append('requested_step_list_missing')
        # Explicit counts include a single complete item.
        if len(markers)!=list_target(latest):issues.append('requested_step_count_mismatch')
        if markers!=list(range(1, len(markers)+1)):
            issues.append('nonconsecutive_step_numbering')
        if len(markers)>10:issues.append('excessive_step_count')
        items=re.split(r'(?<!\S)\d{1,2}[.)]\s+',a)[1:]
        if any(not sentence_boundary(item.strip(),'steps') for item in items):issues.append('incomplete_list_item')
        if len({re.sub(r'\W+','',item).casefold() for item in items})!=len(items):issues.append('duplicate_list_item')
    if word_count(latest)>=20 and a.casefold()==latest.casefold():issues.append('near_verbatim_user_copy')
    if re.search(r'\b(?:this,\s+(?:you|one|we)|pinpointinging|pahingap|orong)\b',a,re.I):issues.append('malformed_discourse_transition')
    return issues


class LocalCBT:
    def __init__(self,base_dir:Path,adapter_dir:Path):
        preflight(base_dir,adapter_dir)
        # Import only on GPU path: format-only/tests do not import torch/PEFT.
        import torch
        from transformers import AutoModelForCausalLM,AutoTokenizer,BitsAndBytesConfig
        from peft import PeftModel
        from transformers import StoppingCriteria,StoppingCriteriaList
        if not torch.cuda.is_available():
            raise RuntimeError('CUDA GPU not available; format mode remains available on CPU')
        if not torch.cuda.is_bf16_supported():
            raise RuntimeError('Selected handover requires bfloat16 CUDA compute support')
        self.torch=torch
        self.device=torch.device('cuda:0')
        try:
            self.tokenizer=AutoTokenizer.from_pretrained(str(adapter_dir),local_files_only=True,trust_remote_code=False)
        except (OSError, ValueError):
            self.tokenizer=AutoTokenizer.from_pretrained(str(base_dir),local_files_only=True,trust_remote_code=False)
        self.template_state=verify_template(self.tokenizer)
        if self.tokenizer.pad_token_id is None:
            self.tokenizer.pad_token=self.tokenizer.eos_token
        self.eos=stop_ids(self.tokenizer)
        quant=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type='nf4',bnb_4bit_compute_dtype=torch.bfloat16,bnb_4bit_use_double_quant=False)
        self.model=AutoModelForCausalLM.from_pretrained(str(base_dir),quantization_config=quant,
                   dtype=torch.bfloat16,device_map={'':'cuda:0'},local_files_only=True,trust_remote_code=False)
        self.model=PeftModel.from_pretrained(self.model,str(adapter_dir),is_trainable=False,local_files_only=True)
        self.model.eval()
        # Construct stopper using runtime StoppingCriteria type.
        self.StoppingCriteria=StoppingCriteria
        self.StoppingCriteriaList=StoppingCriteriaList

    def _input(self,turns,system,max_new, *, allow_drops=True):
        tokenizer=self.tokenizer
        budget=policy()['runtime']['seqLength']-max_new
        latest=turns[-1]
        def build(selected):
            return tokenizer.apply_chat_template([{'role':'system','content':system}]+selected,
                    tokenize=True,add_generation_prompt=True,return_tensors='pt',return_dict=True)
        inputs=build([latest])
        if inputs['input_ids'].shape[1] > budget:
            raise ValueError('Latest user message plus prompts exceeds token budget; refusing truncation')
        selected=list(turns)
        dropped=0
        while True:
            inputs=build(selected)
            if inputs['input_ids'].shape[1]<=budget:break
            if not allow_drops:raise ValueError('Rewrite would modify context; refusing rewrite')
            if len(selected)<=1:raise ValueError('Context cannot fit while preserving latest user message')
            selected.pop(0);dropped+=1
            if selected and selected[0]['role']=='assistant':
                selected.pop(0);dropped+=1
        return {k:v.to(self.device) for k,v in inputs.items()},dropped

    def _attempt(self,history,*,retry=False,allow_drops=True,delivery_mode="chat",repair_issues=(),generation_attempt=0,strict_review=False):
        torch=self.torch
        latest=history[-1]['content']
        typ=response_role(latest,delivery_mode)
        lang=language(latest)
        prompt=system_prompt(latest,retry=retry,delivery_mode=delivery_mode,strict_review=strict_review)
        if repair_issues:
            prompt+='\nREPAIR THESE OUTPUT PROBLEMS: '
            if typ=='steps':prompt+=f'Use exactly {list_target(latest)} items, each on its own numbered line, with one complete sentence per item. Do not restart numbering or add extra items. '
            else:prompt+='Write three fluent complete sentences in one paragraph: one specific acknowledgement, one concrete starting action with how to begin, and one relevant reflection or support suggestion. No bullets, numbering, menus of strategies, or filler transitions. '
            if persistent_concern(latest):prompt+='Keep this to three sentences: acknowledge the weeks of difficulty; recommend counselor/professional support now without diagnosing; explain one concrete observation to note today and why it helps. Do not add other strategies. Example of concise structure, to adapt rather than copy: "Having so little energy for weeks can make even familiar routines feel heavy. Since this has lasted, consider speaking with a counselor about the changes and their effect on daily life. Today, jot down one activity that felt harder and when your energy shifted, so you have a concrete example to discuss." '
        if repair_issues and not strict_review:
            # Repair content without imposing a scripted sentence count or order.
            prompt=system_prompt(latest,retry=retry,delivery_mode=delivery_mode)
            prompt+='\nImprove this response: acknowledge the specific concern, explain how to begin one relevant action, and finish each thought. Include relevant reflection or professional support when warranted. '
            if typ=='steps':prompt+=f'Provide exactly {list_target(latest)} distinct complete numbered items. '
        max_new=policy()['runtime']['rewriteMaxNewTokens' if retry else 'maxNewTokens'] if strict_review else generation_budget(delivery_mode,retry)
        inp,dropped=self._input(history,prompt,max_new,allow_drops=allow_drops)
        n_prompt=int(inp['input_ids'].shape[1])
        target=style()['word_targets'][typ if typ in ('brief','professional','steps') else lang]
        if not strict_review and typ in ('ordinary','brief'):target=60
        requested_steps=None
        if typ=='steps':
            requested_steps=list_target(latest)
            target=requested_steps*18
        owner=self
        class CompleteSentenceStop(owner.StoppingCriteria):
            def __init__(self):
                self.triggered=False
            def __call__(self, input_ids, scores, **kwargs):
                extra=int(input_ids.shape[1])-n_prompt
                if requested_steps:
                    if extra<8:return False
                elif extra < max(35,target//2):return False
                text=owner.tokenizer.decode(input_ids[0,n_prompt:],skip_special_tokens=True)
                if not requested_steps and word_count(text)<target:return False
                if not requested_steps and practical_help_requested(latest) and not usable_start(text):return False
                if persistent_concern(latest) and not persistent_support_covered(text):return False
                if not sentence_boundary(text,typ):return False
                if requested_steps and len(re.findall(r'(?<!\S)\d{1,2}[.)]\s+\S',text))<requested_steps:return False
                self.triggered=True
                return True
        stopper=CompleteSentenceStop()
        random_seed=seed_for(history,prompt) if strict_review else generation_seed(history,prompt,delivery_mode,generation_attempt)
        settings=policy()['generationPolicy']
        # HF generate() does not reliably accept a `generator` kwarg across
        # releases. Seed a temporary forked Torch RNG context instead.
        with torch.random.fork_rng(devices=[self.device.index or 0],enabled=True):
            torch.manual_seed(random_seed)
            torch.cuda.manual_seed_all(random_seed)
            with torch.inference_mode():
                out=self.model.generate(**inp,
                    max_new_tokens=max_new,
                    do_sample=True,
                    temperature=settings['CREATIVE_TEMPERATURE'],
                    top_p=settings['CREATIVE_TOP_P'],
                    top_k=settings['CREATIVE_TOP_K'],
                    repetition_penalty=settings['CREATIVE_REPETITION_PENALTY'],
                    use_cache=True,
                    stopping_criteria=self.StoppingCriteriaList([stopper]),
                    pad_token_id=self.tokenizer.pad_token_id,
                    eos_token_id=self.eos,
                    return_dict_in_generate=True,
                )
        new_ids=out.sequences[0,n_prompt:]
        response=self.tokenizer.decode(new_ids,skip_special_tokens=True).strip()
        ended_eos=bool(len(new_ids) and int(new_ids[-1].item()) in self.eos)
        hard_cap=len(new_ids)>=max_new and not ended_eos and not stopper.triggered
        quality=quality_issues(response,latest,typ,hard_cap)
        if requested_steps and len(re.findall(r'(?<!\S)\d{1,2}[.)]\s+\S',response))!=requested_steps:quality.append('requested_step_count_mismatch')
        return {'_raw_reply':response,
                'word_count':word_count(response),'role':typ,'language_heuristic':lang,
                'attempt':'rewrite' if retry else 'initial',
                'needs_review':bool(quality),'issues':quality,
                'stop':'sentence_boundary' if stopper.triggered else 'eos' if ended_eos else 'limit_or_unknown',
                'prompt_tokens':n_prompt,'generated_tokens':len(new_ids),'dropped_history_turns':dropped,
                'inference_version':VERSION if strict_review else TALK_VERSION if delivery_mode=='voice' else CHAT_VERSION,
                'source_model':'SeaLLMs-v3-7B-Chat + mixed_lr_1e4',
                'original_policy_version':settings['VERSION'],
                'safety_disposition':safety_disposition(history)}

    def _approved_for_output(self, attempt):
        """One delivery boundary: only quality-approved drafts reach the formatter.

        Formatting changes whitespace/paragraph layout only; it cannot rewrite,
        shorten or add CBT advice. Raw drafts and rejected drafts stay private.
        """
        if attempt.get('needs_review') or attempt.get('issues'):
            raise ValueError('Refusing to display a draft that failed quality review')
        original=attempt.pop('_raw_reply',None)
        if not isinstance(original,str) or not original.strip():
            raise ValueError('Approved model attempt has no usable raw response')
        formatted=format_chat_response(original,role=attempt['role'],config=style()['chat_output_format'])
        # The formatter itself verifies non-whitespace preservation. Reverify at
        # delivery, so a future formatter change cannot silently alter advice.
        nonws=lambda t:re.sub(r'\s+','',t)
        if nonws(original.strip())!=nonws(formatted):
            raise RuntimeError('Auto-format changed answer content; refusing delivery')
        if not formatted.strip():
            raise RuntimeError('Auto-format produced empty response')
        attempt['reply']=formatted
        attempt['auto_format_applied']=True
        attempt['auto_format_mode']='content_preserving_paragraph_layout'
        attempt['auto_format_layout_changed']=original.strip()!=formatted
        attempt['auto_format_preserved_content']=True
        attempt['output_paragraphs']=len([part for part in formatted.split('\n\n') if part.strip()])
        attempt['raw_response_sha256']=hashlib.sha256(original.encode('utf-8')).hexdigest()
        return attempt

    def _conversational_reply(self, turns, generation_attempt, delivery_mode, strict_review=False):
        version=VERSION if strict_review else TALK_VERSION if delivery_mode=='voice' else CHAT_VERSION
        candidates=[]
        for retry in (False, True):
            repair=candidates[0]['issues'] if candidates else ()
            try:
                attempt=self._attempt(turns,retry=retry,delivery_mode=delivery_mode,
                                      generation_attempt=generation_attempt,repair_issues=repair,
                                      **({'strict_review':True,'allow_drops':not retry} if strict_review else {}))
            except ValueError:
                if candidates and not candidates[0]['blocking_issues']:break
                raise
            blocking, advisory=(list(attempt['issues']),[]) if strict_review else talk_issue_groups(attempt['issues'])
            attempt.update(blocking_issues=blocking,advisory_issues=advisory)
            candidates.append(attempt)
            if not blocking and not advisory:break
        eligible=[candidate for candidate in candidates if not candidate['blocking_issues']]
        diagnostics=[{'blockingIssues':c['blocking_issues'],'advisoryIssues':c['advisory_issues']} for c in candidates]
        if not eligible:
            return {'reply':None,'needs_review':True,'attempts':len(candidates),
                    'issues':list(dict.fromkeys(i for c in candidates for i in c['blocking_issues'])),
                    'advisory_issues':list(dict.fromkeys(i for c in candidates for i in c['advisory_issues'])),
                    'attempt_diagnostics':diagnostics,'inference_version':version}
        selected=min(eligible,key=lambda c:len(c['advisory_issues']))
        # Advisory findings are preserved separately; formatter still enforces exact content.
        selected['issues']=[];selected['needs_review']=False
        try:ready=self._approved_for_output(selected)
        except (ValueError, RuntimeError, TypeError, KeyError):
            return {'reply':None,'needs_review':True,'attempts':len(candidates),
                    'issues':['auto_format_failed'],'attempt_diagnostics':diagnostics,'inference_version':version}
        ready['reply']=list_limit_notice(ready['reply'],turns[-1]['content'])
        ready.update(attempts=len(candidates),rewrite_attempted=len(candidates)>1,
                     attempt_diagnostics=diagnostics,template_check=self.template_state)
        return ready

    def reply(self,history,*,delivery_mode="chat",generation_attempt=0,strict_review=False):
        turns=validate_history(history)
        response_role(turns[-1]["content"],delivery_mode)
        disposition=safety_disposition(turns)
        if disposition in ('explicit_urgent','ambiguous_unqualified'):
            return safety_withhold(disposition)
        return self._conversational_reply(turns,generation_attempt,delivery_mode,strict_review)


def main(argv: list[str] | None=None) -> int:
    parser=argparse.ArgumentParser(description='Standalone CBT with automatic chat formatting before display (no Echo app modifications)')
    parser.add_argument('--mode',choices=('format','chat','audit'),default='format',
                        help='format=preserve exact wording/CPU; chat=local 7B + automatic approved-answer formatting')
    parser.add_argument('--text',help='Input text; in chat mode the latest user turn')
    parser.add_argument('--latest-user',help='Latest user prompt, required for --mode audit')
    parser.add_argument('--text-file',type=Path,help='UTF-8 text file to format or send as a chat prompt')
    parser.add_argument('--history-json',type=Path,help='JSON list of role/content turns ending in a user turn (chat mode)')
    parser.add_argument('--interactive',action='store_true',help='Interactive chat session; retains prior turns')
    parser.add_argument('--base-dir',help='Read-only model base path; overrides discovery')
    parser.add_argument('--adapter-dir',help='Read-only mixed_lr_1e4 adapter path; overrides discovery')
    parser.add_argument('--check',action='store_true',help='Validate model directory/config without loading CUDA')
    parser.add_argument('--verify-hashes',action='store_true',help='Read and hash 161 MB adapter and selected configs')
    parser.add_argument('--json',action='store_true',help='JSON object instead of plain reply')
    parser.add_argument('--wrap-width',type=int,default=0,help='Console width; 0=terminal auto (no wrapping inside words)')
    args=parser.parse_args(argv)
    if args.wrap_width and not 32<=args.wrap_width<=200:parser.error('--wrap-width must be 0 or 32..200')
    if args.check:
        base,adapter=model_locations(args)
        print(json.dumps(preflight(base,adapter,check_hashes=args.verify_hashes),indent=2,ensure_ascii=False))
        return 0
    if args.text and args.text_file:parser.error('Use either --text or --text-file, not both')
    if args.history_json and args.mode!='chat':parser.error('--history-json requires --mode chat')
    if args.latest_user and args.mode!='audit':parser.error('--latest-user is only valid in audit mode')
    if args.interactive and args.mode!='chat':parser.error('--interactive requires --mode chat')
    if args.history_json and (args.text or args.text_file or args.interactive):parser.error('--history-json is exclusive of --text/--text-file/--interactive')
    text=args.text if args.text is not None else args.text_file.read_text(encoding='utf-8') if args.text_file else None
    if args.mode=='audit':
        if text is None or not args.latest_user:
            parser.error('audit mode requires --text/--text-file and --latest-user')
        typ=role(args.latest_user)
        issues=quality_issues(text,args.latest_user,typ,False)
        disposition=safety_disposition([{'role':'user','content':args.latest_user}])
        return_data={'inference_version':VERSION,'mode':'audit','input_type':'candidate_draft',
                     'inferred_role':typ,'safety_disposition':disposition,
                     'completed_sentence':sentence_boundary(text,typ),
                     'quality_issues':issues,'accepted':not issues and disposition not in ('explicit_urgent','ambiguous_unqualified'),
                     'note':'CPU-only heuristic inspection of supplied text; not a clinical safety or model-quality validation.'}
        print(json.dumps(return_data,ensure_ascii=False,indent=2))
        return 0
    if args.mode=='format':
        if text is None:parser.error('format mode requires --text or --text-file')
        response=format_existing(text)
        result={'reply':response,'mode':'format','word_count_before':word_count(text),
                'word_count_after':word_count(response),'content_changed':False,
                'notes':'Only whitespace layout changed; no shortening, paraphrasing, or model inference.'}
        print(json.dumps(result,ensure_ascii=False,indent=2) if args.json else wrap_for_console(response,args.wrap_width))
        return 0
    if not args.interactive and args.history_json is None and text is None:parser.error('chat mode requires --text/--text-file/--history-json or --interactive')
    # Crisis triage before GPU load when input is already available.
    turns=None
    if args.history_json is not None:
        turns=validate_history(json.loads(args.history_json.read_text(encoding='utf-8')))
    elif text is not None:
        turns=validate_history([{'role':'user','content':text}])
    if turns is not None and safety_review_needed(turns):
        print(json.dumps(safety_withhold(safety_disposition(turns)),ensure_ascii=False,indent=2))
        return 2
    base,adapter=model_locations(args)
    engine=LocalCBT(base,adapter)
    if args.interactive:
        turns=[]
        print('Echo standalone experiment. Type EXIT to stop. Research only; not a crisis-support service.')
        while True:
            try:user=input('USER > ').strip()
            except (EOFError,KeyboardInterrupt):break
            if user.lower() in ('exit','quit'):break
            if not user:continue
            proposed=validate_history((turns+[{'role':'user','content':user}])[-20:])
            response=engine.reply(proposed)
            reply_text=response.get('reply') or '[WITHHELD: needs review — use Echo support routing]'
            print('\nEcho >\n'+wrap_for_console(reply_text,args.wrap_width))
            if args.json:print(json.dumps(response,ensure_ascii=False,indent=2))
            if response.get('reply') and not response.get('needs_review'):
                turns=(proposed+[{'role':'assistant','content':response['reply']}])[-19:]
        return 0
    result=engine.reply(turns)
    print(json.dumps(result,indent=2,ensure_ascii=False) if args.json or result['needs_review'] else wrap_for_console(result['reply'],args.wrap_width))
    return 2 if result['needs_review'] else 0

if __name__=='__main__':
    try:sys.exit(main())
    except (OSError,RuntimeError,ValueError,ImportError) as e:
        print(f'[ECHO STANDALONE ERROR] {type(e).__name__}: {e}',file=sys.stderr)
        sys.exit(1)
