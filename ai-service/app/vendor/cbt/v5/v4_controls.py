"""V4 research-only policy helpers shared as *copies* inside independent packages.

These checks are intentionally conservative heuristics, NOT a suicide classifier,
CBT efficacy measurement, or a substitute for Echo's integrated safety routing.
"""
from __future__ import annotations
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from collections import Counter
from typing import Any

STEP_REQUEST = re.compile(
    r"\b(?:list\s+(?:(?:the|some|a\s+few|any)\s+)?(?:steps?|things(?:\s+to\s+do)?|ways?|options?|examples?)|"
    r"(?:give|show|tell|write|make)\s+(?:me\s+)?(?:(?:a|some|the|few|\d+|two|three|four|five|six)\s+)?"
    r"(?:list|steps?|ways?|options?|examples?|suggestions?|instructions?|bullet\s+points?)|"
    r"(?:give|show|tell|write|make)\s+(?:me\s+)?(?:\d+|two|three|four|five|six)\s+(?:steps?|ways?|ideas?|examples?)|"
    r"step[ -]by[ -]step|numbered\s+list|bullet\s+points?|"
    r"(?:explain|show|tell)(?:\s+me)?\s+(?:the\s+)?(?:steps?|ways?|options?)|"
    r"(?:what|which)\s+(?:can|could|should)\s+i\s+(?:do|try)|"
    r"(?:how\s+do\s+i|paano\s+(?:ko|ba|mag))\b.*\b(?:step|steps|hakbang)|"
    r"(?:magbigay|pahingi|bigay|ilista|i-list|lista|pakilista|paki-list)\b.{0,60}?\b(?:hakbang|paraan|gagawin|steps?|ways?|listahan|mga)|"
    r"(?:ano|anu-ano)\s+(?:ba\s+)?(?:ang\s+)?(?:mga\s+)?(?:pwede|puwede|dapat|kaya)\s+(?:kong|ko)\s+(?:gawin|subukan)|"
    r"(?:mga\s+)?(?:hakbang|paraan)\s+(?:na\s+)?(?:pwede|puwede|dapat|kaya)\b)",re.I|re.S)

# Explicit high-concern self-referential patterns, not a clinical diagnosis.
FIRST_PERSON_URGENT = re.compile(
    r"\b(?:i\s+(?:am\s+|['’]m\s+)?(?:going\s+to\s+|might\s+|plan\s+to\s+|want\s+to\s+|wanna\s+|feel\s+like\s+)?"
    r"(?:kill\s+myself|hurt\s+myself|harm\s+myself|end\s+my\s+life|end\s+it\s+all|end\s+everything|die)|"
    r"(?:i\s+)?(?:don['’]?t|do\s+not)\s+want\s+to\s+(?:live|be\s+alive)|"
    r"i\s+(?:am\s+)?suicidal|i\s+have\s+(?:suicidal\s+thoughts|thoughts\s+of\s+suicide)|"
    r"no\s+reason\s+to\s+live|"
    r"gusto\s+ko\s+(?:nang?|na)\s+(?:magpakamatay|mamatay|saktan\s+(?:ang\s+)?sarili|tapusin\s+(?:ang\s+)?lahat)|"
    r"(?:ayoko|ayaw\s+ko)\s+(?:nang?|na)\s+(?:mabuhay|maging\s+buhay)|"
    r"(?:magpapakamatay|magpakamatay)\s+(?:ako|na\s+ako)|"
    r"(?:saktan|sasaktan|papatayin)\s+ko\s+(?:ang\s+)?sarili\s+ko)",re.I)
# Potential self-harm in a context that cannot be interpreted reliably from keywords.
CONCERN_WORDS = re.compile(r"\b(?:suicid\w*|kill\s+(?:myself|himself|herself|yourself)|hurt\s+myself|harm\s+myself|self[- ]harm|"
   r"want\s+to\s+die|end\s+it\s+all|end\s+my\s+life|magpakamatay|pagpapakamatay|"
   r"saktan\s+(?:ang\s+)?sarili|mamatay|mabuhay|papatayin\s+ko\s+(?:ang\s+)?sarili|"
   r"overdose\s+(?:on\s+pills|myself))\b",re.I)
NEGATION = re.compile(r"\b(?:don't|dont|do\s+not|never|not|hindi|di\s+ko|ayoko|wala|huwag)\b",re.I)
HISTORICAL = re.compile(r"\b(?:used\s+to|last\s+(?:year|month|week)|years?\s+ago|in\s+the\s+past|before|dati|noong|nung)\b",re.I)
QUOTED_THIRD_PARTY = re.compile(r"\b(?:my\s+(?:friend|sister|brother|classmate|client|patient|mother|father)|"
    r"someone|somebody|my\s+family|a\s+(?:book|film|movie|story)|"
    r"he\s+(?:said|says)|she\s+(?:said|says)|"
    r"quot(?:e|ed)|hypothetical|example|song\s+lyrics?|in\s+a\s+story|"
    r"sinabi\s+(?:ng|ni)|kaibigan\s+ko|sabi\s+(?:niya|nila))\b",re.I)
# Distinguishes old self-reports from clearly immediate intent, conservatively.
FIRST_PERSON_PAST = re.compile(r"\b(?:i\s+(?:once|previously|used\s+to)|i\s+(?:wanted|thought)\s+(?:to\s+die|about\s+(?:suicide|dying))|"
    r"i\s+was\s+suicidal|naramdaman\s+ko\s+dati)\b",re.I)
AMBIGUOUS_GIVE_UP = re.compile(r"\b(?:i\s+(?:just\s+)?(?:wanna|want\s+to|feel\s+like|might)\s+give\s+up|"
    r"i\s+(?:am|['’]m)\s+(?:about\s+to\s+)?giving\s+up|i\s+give\s+up|"
    r"gusto\s+ko\s+(?:na|nang)\s+sumuko|susuko\s+na\s+(?:ako|ko))\b",re.I)
TASK_CONTEXT = re.compile(r"\b(?:tasks?|school|schoolwork|assignments?|homework|exams?|work|jobs?|"
    r"projects?|deadlines?|responsibilit(?:y|ies)|chores?|plate|workload|classes?|grades?|"
    r"gawain|trabaho|aralin|iskwela|eskwela|school|requirements?|assignments?)\b",re.I)
LIFE_GIVE_UP = re.compile(r"\b(?:give\s+up\s+on\s+(?:life|living|everything)|"
    r"not\s+want\s+to\s+be\s+alive|ayoko\s+na\s+mabuhay)\b",re.I)

# Longer phrases come first; modest nonclinical cue list only.
ADVICE_VERBS = re.compile(r"(?i)\b(?:write|make|list|identify|sort|pick|choose|prioriti[sz]\w*|"
  r"break|start|set|take|ask|reach|contact|share|plan|schedule|focus|breathe|pause|"
  r"check|notice|try|consider|begin|divide|reduce|review|create|put|remove|talk|"
  r"find|note|speak|tell|message|select|organize|organise|"
  r"isulat|piliin|simulan|unahin|gumawa|magpahinga|humingi|maglista|"
  r"subukan|hatiin|gawin|tingnan|tignan|itanong|alamin|magtakda|"
  r"ilista|maglaan|ipahinga|kausapin|mag-isip|magpokus|isipin|"
  r"pwedeng|puwede|maaari|pwede|(?:you\s+can)|(?:you\s+could))\b")
DANGLING_NUMBERED=re.compile(r"(?:^|\s)(?:\d{1,2}|[a-zA-Z])[.)]\s*$")
DANGLING_CLAUSE=re.compile(r"(?i)\b(?:and|or|but|with|because|such\s+as|including|first|then|to|for|the|a|an|"
   r"by|of|as|after|before|that|which|at|so|and\s+then|at\s+least)\s*[,:;]?\s*$")
STEP_MARKER=re.compile(r"(?<!\S)(?P<number>\d{1,2})[.)]\s+(?=\S)")
TOKEN=re.compile(r"\b\w+(?:['’]\w+)*\b", re.UNICODE)


def disposition_one(text: str)->str:
    """Conservative context screening. History is handled by disposition_history.

    Quoted/negated/past reports go to *review*, not an assumption of safety.
    """
    text=text.strip()
    # Direct explicit phrases regardless of idiom location, but first check common context.
    urgent=bool(FIRST_PERSON_URGENT.search(text) or LIFE_GIVE_UP.search(text)
        or re.search(r'(?i)\b(?:want\s+to|wanna|going\s+to|plan\s+to|might)\s+(?:hurt|harm|kill)\s+myself\b',text))
    has_context=bool(QUOTED_THIRD_PARTY.search(text) or HISTORICAL.search(text) or FIRST_PERSON_PAST.search(text))
    # Distinguish current direct negative vs quoted/negated discussion (must review, not ignore).
    negated=re.search(r"(?i)\b(?:i\s+(?:don['’]?t|do\s+not|never)\s+(?:(?:want\s+to|wanna)\s+)?(?:hurt|harm|kill)\s+myself|"
         r"i\s+am\s+not\s+suicidal|hindi\s+ko\s+gusto\s+magpakamatay)\b",text)
    if urgent:
        if has_context or negated:return 'safety_context_review'
        return 'explicit_urgent'
    if CONCERN_WORDS.search(text) or FIRST_PERSON_PAST.search(text) or re.search(
            r'(?i)\b(?:i\s+want\s+to\s+disappear\s+forever|never\s+wake\s+up|\bnot\s+safe\s+tonight)\b',text):
        return 'safety_context_review'
    if AMBIGUOUS_GIVE_UP.search(text):
        return 'contextual_ambiguous' if TASK_CONTEXT.search(text) else 'ambiguous_unqualified'
    return 'ordinary'


def safety_disposition(history:list[dict[str,str]])->str:
    """Sticky safety review on ALL supplied user turns (up to 20)."""
    observations=[disposition_one(t['content']) for t in history if t.get('role')=='user']
    for reason in ('explicit_urgent','safety_context_review','ambiguous_unqualified'):
        if reason in observations:return reason
    return observations[-1] if observations else 'ordinary'


def safety_review_needed(history:list[dict[str,str]])->bool:
    return safety_disposition(history) in ('explicit_urgent','safety_context_review','ambiguous_unqualified')


def safety_withhold(disposition:str, version:str='v4')->dict[str,Any]:
    if disposition=='explicit_urgent':
        detail='possible_current_self_harm_disclosure'
        guidance=('Possible immediate safety concern. This experimental standalone tool cannot assess safety. '
                  'If you might act on self-harm thoughts, contact local emergency services or go to an emergency department, '
                  'and reach out to someone you trust who can stay with you. Use Echo’s full support-routing workflow.')
    elif disposition=='safety_context_review':
        detail='quoted_negated_historical_or_other_sensitive_context_requires_review'
        guidance=('The message contains potentially sensitive safety language, possibly quoted, historical, negated, or about someone else. '
                  'It is not necessarily an immediate first-person crisis. Use Echo’s complete support workflow for context-aware review.')
    else:
        detail='unqualified_give_up_requires_context_review'
        guidance=('The meaning of “give up” remains unclear. The standalone tool will not assume safety or generate routine CBT advice; '
                  'use Echo’s full support-routing workflow to clarify the context.')
    return {'reply':None,'needs_review':True,'issues':[detail], 'safety_disposition':disposition,
            'warning':'Standalone lexical screening is not a validated suicide-risk classifier; route through Echo support checks.',
            'safety_message':guidance, 'inference_version':version, 'attempts':0,
            'model_output':False}


def stop_word_floor(role:str, latest:str, target:int)->int:
    # Don't overrun a short *complete* structured answer to meet a soft word target.
    if role=='brief':return 5
    if role=='steps':return max(6,5*requested_step_count(latest))
    return target


def requested_step_count(latest:str)->int:
    num=r'(?:\b([2-6])\b|\b(two|three|four|five|six|dalawa(?:ng)?|tatlo(?:ng)?|apat(?:\s+na)?|lima(?:ng)?|anim(?:\s+na)?)\b)'
    m=re.search(rf'(?i){num}\s+(?:short\s+)?(?:steps?|ways?|things?|suggestions?|ideas?|hakbang|paraan|gagawin)',latest)
    if not m:return 3
    return int(m.group(1)) if m.group(1) else {
        'two':2,'three':3,'four':4,'five':5,'six':6,
        'dalawa':2,'dalawang':2,'tatlo':3,'tatlong':3,'apat':4,'lima':5,'limang':5,'anim':6,
    }.get(m.group(2).lower(),3)


def step_items(response:str)->list[tuple[int,str]]:
    markers=list(STEP_MARKER.finditer(response))
    return [(int(m.group('number')),response[m.end():markers[i+1].start() if i+1<len(markers) else len(response)].strip())
            for i,m in enumerate(markers)]


def dangling_structure(answer:str)->bool:
    a=answer.strip()
    return (not a or bool(DANGLING_NUMBERED.search(a) or DANGLING_CLAUSE.search(a) or
            re.search(r'(?m)(?:^|\n)\s*(?:[-*+]\s*|(?:step|hakbang)\s+\d+\s*[:.)-]?)$',a,re.I)))


def step_quality_issues(answer:str,latest:str)->list[str]:
    items=step_items(answer)
    n=requested_step_count(latest)
    if len(items)<n:return ['requested_step_list_missing']
    if n!=3 and len(items)!=n:return ['requested_step_count_mismatch']
    if [i for i,_ in items] != list(range(1,len(items)+1)):
        return ['nonconsecutive_step_numbering']
    if len(items)>6 and not re.search(r'\b(?:[7-9]|1\d)\s+(?:steps?|hakbang)\b',latest,re.I):
        return ['excessive_step_count']
    examples_only=bool(re.search(r'(?i)\b(?:examples?|options?|alternatives?|ideas?)\b',latest)) and not bool(re.search(r'(?i)\b(?:steps?|hakbang)\b',latest))
    for i,desc in items:
        # Two-word commands such as "Choose one." and Filipino "Unahin ito." are allowed.
        if len(TOKEN.findall(desc))<2 or len(desc.strip())<7 or not re.search(r'[.!?。！？]["\'”’)]?\s*$',desc):
            return ['incomplete_numbered_step']
        first=' '.join(TOKEN.findall(desc)[:15])
        if not examples_only and not ADVICE_VERBS.search(first):return ['non_actionable_numbered_step']
    return []


def sentence_boundary(text:str,role:str,latest:str='')->bool:
    text=text.strip()
    if not text or text[-1] not in '.!?。”！？':return False
    if text.count('```')%2 or dangling_structure(text):return False
    if role=='steps' and step_quality_issues(text,latest):return False
    if role not in ('professional','steps') and text.count('?')>1:return False
    return True


def quality_issues(answer:str,latest:str,role:str,was_limited:bool)->list[str]:
    a=answer.strip()
    issues=[]
    if not a:issues.append('empty')
    if was_limited:issues.append('hard_token_limit')
    if a and dangling_structure(a):issues.append('dangling_list_or_clause')
    if a and not sentence_boundary(a,role,latest):issues.append('unfinished_structure_or_clause')
    if role not in ('professional','steps') and a.count('?')>=4:issues.append('excessive_questions_4plus')
    if role in ('ordinary','steps') and len(TOKEN.findall(a))>(210 if role=='steps' else 170):issues.append('extreme_response_length')
    if role=='brief' and len(TOKEN.findall(a))>95:issues.append('extreme_response_length')
    if role not in ('professional','steps') and re.search(r'(?m)^\s*(?:#|\d+[.)]\s|[-*+]\s)',a):
        issues.append('extreme_structural_overload')
    if role=='steps':issues.extend(step_quality_issues(a,latest))
    if re.search(r"(?i)\b(?:i\s+have\s+(?:personally\s+)?been\s+(?:there|through\s+(?:this|that|the\s+same))|"
                 r"i\s+(?:personally\s+)?(?:experienced|went\s+through)\s+(?:the\s+same|this|that)|"
                 r"i\s+know\s+exactly\s+how\s+you\s+feel)\b",a):
        issues.append('invented_personal_experience_claim')
    if re.search(r"(?i)\b(?:you\s+will\s+be\s+cured|you\s+are\s+guaranteed\s+to|"
                 r"i\s+(?:can\s+)?guarantee\s+(?:you|that)|this\s+will\s+(?:definitely\s+)?cure\s+you)\b",a):
        issues.append('unjustified_outcome_promise')
    normalized=re.findall(r'\w+',a.casefold())
    grams=[' '.join(normalized[i:i+6]) for i in range(max(0,len(normalized)-5))]
    if grams and any(n>=3 for n in Counter(grams).values()):
        issues.append('repeated_sixgram_3plus')
    # A *heuristic*, not a model of factual relevance: explicit advice requests
    # without an action term should be reviewed.
    if re.search(r"(?i)\b(?:give\s+me\s+(?:some\s+)?advice|what\s+should\s+i\s+do|"
                 r"can\s+you\s+suggest|what\s+can\s+i\s+try|help\s+me\s+figure\s+out)\b",latest) \
       and role=='ordinary' and not ADVICE_VERBS.search(a):
        issues.append('requested_advice_without_action')
    if AMBIGUOUS_GIVE_UP.search(latest) and TASK_CONTEXT.search(latest):
        if not ('?' in a and re.search(r'(?i)\b(?:safe|safety|give\s+up|quitting|hurt\s+yourself|mean|self[- ]harm|ligtas|sumuko|sarili)\b',a)):
            issues.append('ambiguity_requires_gentle_safety_clarification')
    if not re.search(r'(?i)\b(?:rewrite|edit|proofread|rephrase|summarize|summarise)\b',latest) and re.search(
        r'(?i)\b(?:here\s+is\s+(?:the|a)\s+(?:revised|rewritten|corrected)\s+(?:version|message|text)|i\s+rewrote\s+your\s+(?:text|message))\b',a):
        issues.append('task_switch_to_rewriting')
    if re.search(r'(?i)\b(?:you\s+(?:should|need\s+to|must)\s+(?:kill|hurt|harm)\s+yourself|stop\s+taking\s+your\s+(?:prescribed\s+)?medication)\b',a):
        issues.append('clearly_unsafe_instruction_requires_review')
    if len(TOKEN.findall(latest))>=20 and a.casefold()==latest.casefold():
        issues.append('near_verbatim_user_copy')
    if re.search(r'\b(?:this,\s+(?:you|one|we)|pinpointinging|pahingap|orong)\b',a,re.I):
        issues.append('malformed_discourse_transition')
    return list(dict.fromkeys(issues))


def style_addendum(latest:str,structured:bool)->str:
    content=("\n\nV4 POLICY CLARIFICATION: Keep the same CBT-informed, nonclinical support approach. "
       "Prioritize the person's last actual request. Avoid invented personal experiences, false certainty, "
       "and formulaic or repetitive reassurance. Make replies conversational and concise, and do not omit "
       "a safety-relevant qualification or stop mid-thought. If a user asks for alternatives, examples, "
       "or a numbered plan, respond with short actionable items; do not force a worksheet or multiple unrelated interventions. "
       "For Filipino/Taglish requests, respond naturally in the user's language and use fluent imperative verbs. "
       "For ambiguous workload-related 'give up' language, do not assume meaning; ask one gentle clarifying question.")
    if structured:content+=("\nSTRUCTURED USER REQUEST: Give short, clearly labeled, sequentially numbered actionable items "
       "(use the number the user requested; otherwise three). Each item's action and explanation must be complete. "
       "A concise two-word action such as 'Choose one.' is acceptable. Do not start an unfinished next number.")
    return content


def write_audit_log(path:Path, result:dict[str,Any], *, model:str, mode:str, text:str|None=None):
    """Opt-in metadata-only JSONL audit, not a clinical evaluation and no message content."""
    path=Path(path).expanduser()
    path.parent.mkdir(parents=True, exist_ok=True)
    item={'timestamp_utc':datetime.now(timezone.utc).isoformat(), 'model':model,
          'inference_version':result.get('inference_version'), 'mode':mode,
          'needs_review':result.get('needs_review'), 'safety_disposition':result.get('safety_disposition'),
          'issues':result.get('issues',result.get('quality_issues',[])),
          'attempts':result.get('attempts'), 'rewrite_attempted':result.get('rewrite_attempted'),
          'role':result.get('role',result.get('inferred_role')),
          'language_heuristic':result.get('language_heuristic'),
          'word_count':result.get('word_count'), 'stop':result.get('stop'),
          'prompt_tokens':result.get('prompt_tokens'), 'generated_tokens':result.get('generated_tokens'),
          'dropped_history_turns':result.get('dropped_history_turns'),
          'output_sha256':(hashlib.sha256(result['reply'].encode()).hexdigest()
              if isinstance(result.get('reply'),str) else None),
          'input_sha256':hashlib.sha256(text.encode('utf-8')).hexdigest() if isinstance(text,str) else None,
          'note':'Research metadata only; hashes are not anonymization and may still be sensitive.'}
    with path.open('a',encoding='utf-8') as f:f.write(json.dumps(item,ensure_ascii=False,sort_keys=True)+'\n')
