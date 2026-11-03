import re
from app.buddy.text_audio import chunks
def speech_segments(text):
    if not text:return []
    end=next((m.end() for m in re.finditer(r'[.!?](?:[\"\u201d\u2019])?\s+',text) if m.end()<=140),None)
    if end is None:
        first=chunks(text,140)[0];end=len(first)
    return [text[:end]]+chunks(text[end:],220)
