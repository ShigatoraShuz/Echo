"""Content-preserving formatting and display-only console wrapping.

The generated *advice* is never shortened, reordered, or rewritten here.
Only whitespace changes. Inline numbered steps may be separated onto lines.
"""
from __future__ import annotations
import re
import shutil
import textwrap

WORDS = re.compile(r"\b\w+(?:['’]\w+)*\b", re.UNICODE)
STRUCTURED = re.compile(r"(?m)^\s*(?:```|\|.*\||#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s)")
INLINE_NUMBER = re.compile(r"(?<!\S)(?P<num>\d{1,2})[.)](?=\s+\S)")


def word_count(text: str) -> int:
    return len(WORDS.findall(text))


def _preserved(original: str, formatted: str) -> bool:
    return re.sub(r"\s+", "", original) == re.sub(r"\s+", "", formatted)


def _expand_inline_steps(text: str) -> str:
    """Place a recognizable sequence of '1. ... 2. ...' on separate lines.

    Require >=2 consecutive markers: don't damage isolated 1. in ordinary prose,
    decimals like 1.25, or dates. Never changes any non-whitespace character.
    """
    matches=list(INLINE_NUMBER.finditer(text))
    nums=[int(m.group('num')) for m in matches]
    if not any(a+1==b for a,b in zip(nums,nums[1:])):
        return text
    new=text
    # Only convert separators where a numbered sequence is recognized.
    spans=[]
    for m in matches:
        start=m.start()
        if start==0 or new[start-1:start]=='\n':continue
        if start>0 and text[start-1].isspace():
            prev=start-1
            while prev>=0 and text[prev] in ' \t':prev-=1
            if prev>=0 and text[prev]!='\n':spans.append((prev+1,start))
    for a,b in sorted(spans,reverse=True):new=new[:a]+'\n'+new[b:]
    if not _preserved(text,new):raise RuntimeError('Step formatting changed content')
    return new


def _reflow_paragraph(paragraph: str) -> str:
    return re.sub(r"[ \t]*\n[ \t]*", " ", paragraph.strip()).strip()


def _split_sentences(paragraph: str) -> list[str]:
    # Conservative punctuation split; respect capitalization and existing words.
    boundary=re.compile(r'(?<=[.!?])\s+(?=(?:["“‘\']?[A-ZÀ-Ý]))')
    return [s for s in boundary.split(paragraph) if s]


def format_existing(text: str, max_paragraph_words: int = 85) -> str:
    """Format existing content with word-for-word and punctuation preservation."""
    if not isinstance(text,str):raise TypeError('text must be a str')
    original=text.replace('\r\n','\n').replace('\r','\n').strip()
    if not original:return ''
    normalized=_expand_inline_steps(original)
    if STRUCTURED.search(normalized):
        result=re.sub(r'\n{3,}','\n\n',normalized)
    else:
        out=[]
        for block in re.split(r'\n\s*\n+',normalized):
            plain=_reflow_paragraph(block)
            if not plain:continue
            current=''
            for sentence in _split_sentences(plain):
                proposed=(current+' '+sentence).strip() if current else sentence
                if current and word_count(proposed)>max_paragraph_words:
                    out.append(current);current=sentence
                else:current=proposed
            if current:out.append(current)
        result='\n\n'.join(out)
    if not _preserved(original,result):raise RuntimeError('Formatting changed non-whitespace content')
    return result


def format_chat_response(text: str, *, role: str, config: dict) -> str:
    if not isinstance(config,dict) or config.get('enabled') is not True:
        raise ValueError('Chat auto-format must be enabled in chat_output_format')
    bounds=config.get('max_paragraph_words')
    if not isinstance(bounds,dict):raise ValueError('Missing paragraph word limits')
    if role not in ('brief','ordinary','professional','steps'):
        raise ValueError(f'Unexpected chat role: {role!r}')
    limit=bounds.get(role)
    if type(limit) is not int or not 20<=limit<=220:
        raise ValueError('Invalid chat paragraph limit')
    result=format_existing(text,max_paragraph_words=limit)
    if not _preserved(text.strip(),result):raise RuntimeError('Chat formatter changed advice')
    return result


def wrap_for_console(text: str, width: int = 0) -> str:
    """Display-only word wrapping; never used for the underlying model history.

    JSON mode returns the unwrapped response. Very narrow terminals and long
    uninterrupted tokens are not completely fixable using plain stdout.
    """
    if not isinstance(text,str):raise TypeError('text must be a string')
    if width<0 or (width and not 32<=width<=200):raise ValueError('Console width must be 0 or 32..200')
    columns=width or shutil.get_terminal_size(fallback=(80,24)).columns
    width=max(34,min(94,columns-3))
    pieces=[]
    for line in text.split('\n'):
        if not line.strip():pieces.append('');continue
        m=re.match(r'^(\s*(?:\d+[.)]|[-*+])\s+)',line)
        indent='    ' if m else ''
        wrapped=textwrap.fill(line,width=width,break_long_words=False,break_on_hyphens=False,
                              subsequent_indent=indent,replace_whitespace=True,
                              drop_whitespace=True)
        pieces.append(wrapped)
    result='\n'.join(pieces)
    if not _preserved(text,result):raise RuntimeError('Console wrapping changed advice')
    return result
