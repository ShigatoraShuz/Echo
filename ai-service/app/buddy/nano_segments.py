"""Bound oversized sentences at whitespace, preserving the exact prepared text."""
import re

def bounded_sentences(parts, count_tokens, limit=512, max_chars=320):
    result=[]
    for part in parts:
        remaining=part
        while len(remaining)>max_chars or count_tokens(remaining)>limit:
            boundaries=[m.end() for m in re.finditer(r'\s+',remaining)]
            lo,hi=0,len(boundaries)-1
            best=0
            while lo<=hi:
                mid=(lo+hi)//2
                if boundaries[mid]<=max_chars and count_tokens(remaining[:boundaries[mid]])<=limit:
                    best=boundaries[mid];lo=mid+1
                else:hi=mid-1
            if not best:raise RuntimeError('BUDDY_NANO_OVERSIZED_WORD')
            result.append(remaining[:best]);remaining=remaining[best:]
        if remaining:result.append(remaining)
    if ''.join(result)!=''.join(parts):raise RuntimeError('BUDDY_NANO_TEXT_COVERAGE_FAILED')
    return result
