import re
import unicodedata
EN='zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TL='sero isa dalawa tatlo apat lima anim pito walo siyam sampu labing-isa labindalawa labintatlo labing-apat labinlima labing-anim labimpito labingwalo labinsiyam'.split()
def integer(n,tl=False):
    words=TL if tl else EN
    if n<20:return words[n]
    if n<100:
        tens=(['','','dalawampu','tatlumpu','apatnapu','limampu','animnapu','pitumpu','walumpu','siyamnapu'] if tl else ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'])[n//10]
        return tens+(("'t " if tl else ' ')+words[n%10] if n%10 else '')
    if n<1000:
        prefix=['','isang daan','dalawang daan','tatlong daan','apat na raan','limang daan','anim na raan','pitong daan','walong daan','siyam na raan'][n//100] if tl else words[n//100]+' hundred'
        return prefix+((' at ' if tl else ' ')+integer(n%100,tl) if n%100 else '')
    q,r=divmod(n,1000)
    if tl:
        count=integer(q,True)
        linker='ng' if count[-1] in 'aeiou' else ('g' if count.endswith('n') else ' na')
        prefix=count+linker+' libo'
    else:prefix=integer(q)+' thousand'
    return prefix+((' at ' if tl else ' ')+integer(r,tl) if r else '')
def prepare(text,language):
    if language not in ('English','Filipino','Taglish'):raise ValueError('Choose a supported language.')
    if not isinstance(text,str) or not text.strip():raise ValueError('Enter text first.')
    if len(text)>20000:raise ValueError('Limit input to 20,000 characters; nothing was shortened.')
    text=unicodedata.normalize('NFC',text)
    text=re.sub(r'(?m)^\s*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+)','',text)
    text=re.sub(r'\[([^\]]+)\]\([^)]*\)',r'\1',text)
    for marker in ('```','**','__','`'):text=text.replace(marker,'')
    text=text.translate(str.maketrans({'’':"'",'‘':"'",'“':'"','”':'"','–':'-','—':', '}))
    if re.search(r'[$€£₱%]|[+−-]\s*\d|\d\s*[/,:-]\s*\d|[A-Za-z]\d|\d[A-Za-z]|\d+\.\d+\.\d+',text):raise ValueError('Write dates, times, signed values, currency, percentages and identifiers in words.')
    def number(m):
        whole,dot,fraction=m[0].partition('.')
        if len(whole)>6 or (len(whole)>1 and whole.startswith('0')) or not m[0].isascii():raise ValueError('Write large numbers and identifiers in words.')
        tl=language=='Filipino'
        return integer(int(whole),tl)+((' punto ' if tl else ' point ')+' '.join((TL if tl else EN)[int(c)] for c in fraction) if dot else '')
    return re.sub(r'\s+',' ',re.sub(r'\d+(?:\.\d+)?',number,text)).strip()
def chunks(text,limit=220):
    parts=[]
    while text:
        end=min(limit,len(text))
        if end<len(text):
            boundaries=list(re.finditer(r'[.!?;:]\s+',text[:end]))
            end=boundaries[-1].end() if boundaries else text.rfind(' ',0,end)+1
            if end<=0:raise ValueError('A word exceeds the segment limit; nothing was shortened.')
        parts.append(text[:end]);text=text[end:]
    return parts
def validate(wave,rate):
    import numpy as np
    wave=np.asarray(wave,dtype=np.float32)
    if wave.ndim==1:wave=wave[:,None]
    if wave.ndim!=2 or wave.shape[1] not in (1,2) or not 8000<=rate<=96000 or not len(wave):raise ValueError('Invalid audio shape/rate.')
    if not np.isfinite(wave).all() or np.max(np.abs(wave))<1e-5 or len(wave)/rate>300:raise ValueError('Invalid, silent, or excessively long audio.')
    return wave
def assemble(waves,rate):
    import numpy as np
    raw=np.concatenate(waves);parts=[]
    for wave in waves:
        part=wave.copy();peak=float(np.abs(part).max())
        if peak>.98:part*=.98/peak
        n=min(round(rate*.005),len(part)//2)
        if n:
            part[:n]*=np.linspace(0,1,n)[:,None];part[-n:]*=np.linspace(1,0,n)[:,None]
        parts.append(part)
    return raw,np.concatenate(parts)
