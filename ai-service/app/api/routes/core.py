from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from app.core.security import require_internal_token
from app.core.exceptions import TalkBusyError, ModelUnavailableError

router = APIRouter(dependencies=[Depends(require_internal_token)])


class TextInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=20000)
    language: Literal["en", "fil", "taglish", "unknown"] = "unknown"
    owner: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")


class Turn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=20000)


class ChatInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    messages: list[Turn] = Field(min_length=1, max_length=20)


def runtime(request):
    value = request.app.state.model_runtime
    if not hasattr(value, "analyze"):
        raise HTTPException(503, "Core inference is disabled.")
    return value


def invoke(fn):
    try:
        return fn()
    except TalkBusyError:
        raise HTTPException(503, {"code":"TALK_BUSY"}) from None
    except ValueError:
        raise HTTPException(422, "Invalid model input.") from None
    except ModelUnavailableError as error:
        code = str(error)
        if code.startswith(("BUDDY_","FACE_","NATIVE_")) and code.replace("_", "").isalnum() and len(code) < 80:
            raise HTTPException(503, {"code": code}) from None
        raise HTTPException(503, "Local inference is unavailable.") from None
    except Exception:  # noqa: BLE001 -- internal boundary must not expose model inputs or loader paths
        raise HTTPException(503, "Local inference is unavailable.") from None


class JournalRuntimeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["prepare", "owners", "unload"]
    owners: list[str] = Field(default_factory=list, max_length=128)
    faceOwners: list[str] = Field(default_factory=list, max_length=128)

@router.post("/v2/journal-runtime")
def journal_runtime(payload: JournalRuntimeInput, request: Request):
    import re
    if any(not re.fullmatch(r"[a-f0-9]{64}", owner) for owner in [*payload.owners,*payload.faceOwners]) or not set(payload.faceOwners).issubset(payload.owners):
        raise HTTPException(422, "Invalid journal ownership")
    return invoke(lambda: runtime(request).journal_runtime(payload.action, payload.owners, payload.faceOwners))

@router.post("/v2/analyze")
def analyze(payload: TextInput, request: Request):
    return invoke(lambda: runtime(request).analyze(payload.text, payload.language, **({"owner":payload.owner} if payload.owner else {})))


@router.post("/v2/classify")
def classify(payload: TextInput, request: Request):
    return invoke(lambda: runtime(request).classify(payload.text, payload.language, *((payload.owner,) if payload.owner else ())))


@router.get("/v2/preparation")
def preparation_status(request: Request):
    value = runtime(request)
    if not hasattr(value, "preparation_status"):
        return {"preparation": None}
    return invoke(value.preparation_status)


@router.get("/v2/runtime")
def metrics(request: Request):
    return invoke(lambda: runtime(request).metrics())


@router.post("/v2/chat")
def chat(payload: ChatInput, request: Request):
    if payload.messages[-1].role != "user":
        raise HTTPException(422, "Conversation must end with a user message.")
    if sum(len(x.content) for x in payload.messages) > 20000:
        raise HTTPException(422, "Conversation is too long.")
    return invoke(lambda: runtime(request).chat([t.model_dump() for t in payload.messages]))


class SpeechInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    task: Literal["transcribe", "speak"]
    audio: str = Field(default="", max_length=13981016)
    text: str = Field(default="", max_length=12000)


@router.post("/v2/speech")
async def speech(payload: SpeechInput, request: Request):
    if payload.task == "speak" and not payload.text.strip():
        raise HTTPException(422, "Empty speech")
    if payload.task == "transcribe" and not payload.audio:
        raise HTTPException(422, "Empty audio")
    import asyncio
    import threading

    cancelled = threading.Event()
    task = asyncio.create_task(
        asyncio.to_thread(runtime(request).speech, payload.model_dump(), cancelled)
    )
    try:
        while not task.done():
            if await request.is_disconnected():
                cancelled.set()
            await asyncio.wait({task}, timeout=0.1)
        return invoke(task.result)
    finally:
        cancelled.set()
        if not task.done():
            try:
                await task
            except Exception:  # noqa: BLE001, S110 -- cancelled child is reaped; response must not expose audio or loader paths
                pass


@router.post("/v3/screening")
def screening(payload: TextInput, request: Request):
    return invoke(lambda: runtime(request).screening(payload.text))


class FaceInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    image: str = Field(min_length=1, max_length=2796204)


@router.post('/v1/face')
def face(payload: FaceInput, request: Request):
    return invoke(lambda: runtime(request).face(payload.image))


class TalkInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    sessionId: str = Field(pattern=r'^[a-f0-9-]{36}$')
    task: Literal['warm','warm_chat','warm_nano','warm_whisper','close','unload','pulse','transcribe','speak','chat','support_check','prepare']
    audio: str = Field(default='',max_length=2560000)
    audioFormat: Literal['pcm16','encoded'] = 'pcm16'
    text: str = Field(default='',max_length=12000)
    texts: list[str] = Field(default_factory=list,max_length=3)
    speechMode: Literal['sentences_2_then_3','buffered'] = 'sentences_2_then_3'
    language: Literal['English','Filipino','Taglish','eng','tgl'] = 'English'
    messages: list[Turn] = Field(default_factory=list,max_length=20)


@router.post('/v1/talk')
async def talk(payload: TalkInput, request: Request):
    import asyncio
    import threading
    from app.core.config import get_settings
    if not get_settings().realtime_talk_enabled:
        raise HTTPException(503,'Experimental Talk is disabled')
    engine=runtime(request).talk
    if payload.task=='chat' and (not payload.messages or payload.messages[-1].role!='user' or sum(len(x.content) for x in payload.messages)>20000):
        raise HTTPException(422,'Invalid conversation')
    if payload.task == 'speak' and (not payload.texts or any(not t.strip() or len(t)>12000 for t in payload.texts) or sum(map(len,payload.texts))>12000):
        raise HTTPException(422,'Invalid sentence batch')
    cancelled=threading.Event()
    def execute():
        if payload.task=='warm':return engine.start(payload.sessionId,cancelled) if hasattr(engine,'runtime') else engine.start(payload.sessionId)
        if payload.task=='close':engine.stop(payload.sessionId);return {'closed':True}
        if payload.task=='pulse':engine.require(payload.sessionId);return {'active':True}
        if payload.task=='support_check' and hasattr(engine,'support_check'):return engine.support_check(payload.sessionId,payload.text,cancelled)
        if payload.task=='support_check':
            engine.require(payload.sessionId)
            with engine.core.lock:return engine.cpu_classifier.classify(payload.text)
        if payload.task=='chat':return engine.chat(payload.sessionId,[x.model_dump() for x in payload.messages],cancelled)
        return engine.speech(payload.sessionId,{'task':payload.task,'audio':payload.audio,'audioFormat':payload.audioFormat,'text':payload.text,'texts':payload.texts or [payload.text],'language':payload.language,'speechMode':payload.speechMode},cancelled)
    task=asyncio.create_task(asyncio.to_thread(execute))
    try:
        while not task.done():
            if await request.is_disconnected():cancelled.set()
            await asyncio.wait({task},timeout=.1)
        result=invoke(task.result)
        if cancelled.is_set() and payload.task=='warm':await asyncio.to_thread(engine.stop,payload.sessionId)
        return result
    finally:
        cancelled.set()
        if not task.done():
            try:await task
            except Exception:pass
