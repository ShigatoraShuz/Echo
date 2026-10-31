from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from app.core.security import require_internal_token
from app.core.exceptions import TalkBusyError

router = APIRouter(dependencies=[Depends(require_internal_token)])


class TextInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=20000)
    language: Literal["en", "fil", "taglish", "unknown"] = "unknown"


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
    except Exception:  # noqa: BLE001 -- internal boundary must not expose model inputs or loader paths
        raise HTTPException(503, "Local inference is unavailable.") from None


@router.post("/v2/analyze")
def analyze(payload: TextInput, request: Request):
    return invoke(lambda: runtime(request).analyze(payload.text, payload.language))


@router.post("/v2/classify")
def classify(payload: TextInput, request: Request):
    return invoke(lambda: runtime(request).classify(payload.text, payload.language))


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
    task: Literal['warm','close','pulse','transcribe','speak','chat','support_check']
    audio: str = Field(default='',max_length=2560000)
    text: str = Field(default='',max_length=280)
    language: Literal['eng','tgl'] = 'eng'
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
    cancelled=threading.Event()
    def execute():
        if payload.task=='warm':return engine.start(payload.sessionId)
        if payload.task=='close':engine.stop(payload.sessionId);return {'closed':True}
        if payload.task=='pulse':engine.require(payload.sessionId);return {'active':True}
        if payload.task=='support_check':
            engine.require(payload.sessionId)
            with engine.core.lock:return engine.cpu_classifier.classify(payload.text)
        if payload.task=='chat':return engine.chat(payload.sessionId,[x.model_dump() for x in payload.messages],cancelled)
        return engine.speech(payload.sessionId,{'task':payload.task,'audio':payload.audio,'text':payload.text,'language':payload.language},cancelled)
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
