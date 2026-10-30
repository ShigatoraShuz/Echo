from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from app.core.security import require_internal_token

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
    model_config=ConfigDict(extra='forbid')
    task:Literal['transcribe','speak']
    audio:str=Field(default='',max_length=13981016)
    text:str=Field(default='',max_length=12000)

@router.post('/v2/speech')
async def speech(payload:SpeechInput,request:Request):
    if payload.task=='speak' and not payload.text.strip():raise HTTPException(422,'Empty speech')
    if payload.task=='transcribe' and not payload.audio:raise HTTPException(422,'Empty audio')
    import asyncio,threading
    cancelled=threading.Event()
    task=asyncio.create_task(asyncio.to_thread(runtime(request).speech,payload.model_dump(),cancelled))
    try:
        while not task.done():
            if await request.is_disconnected():cancelled.set()
            await asyncio.wait({task},timeout=0.1)
        return invoke(task.result)
    finally:
        cancelled.set()
        if not task.done():
            try:await task
            except Exception:pass

@router.post('/v3/screening')
def screening(payload:TextInput,request:Request):
    return invoke(lambda:runtime(request).screening(payload.text))
