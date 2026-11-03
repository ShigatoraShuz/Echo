"""Sentence boundaries without character-count splits or content changes."""
import re
ABBREVIATIONS={'mr','mrs','ms','dr','prof','sr','jr','st','vs','etc','e.g','i.e','u.s','u.k','no','fig'}
def sentences(text):
    parts=[];start=0
    for match in re.finditer(r'[.!?]+[\"\u201d\u2019\)\]]*(?:\s+|$)',text):
        punctuation=match.group().lstrip()
        prefix=text[:match.start()]
        word=re.search(r'([\w.]+)$',prefix)
        token=word.group(1) if word else ''
        if punctuation.startswith('.') and (token.lower() in ABBREVIATIONS or (len(token)==1 and token.isupper())):continue
        end=match.end();parts.append(text[start:end]);start=end
    if start<len(text):parts.append(text[start:])
    assert ''.join(parts)==text
    return parts
def batches(parts):
    for part in parts[:2]:yield [part]
    for index in range(2,len(parts),3):yield parts[index:index+3]
