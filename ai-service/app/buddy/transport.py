"""Expose only fixed Buddy operations over the existing private IPC owner."""
class TalkProxy:
    def __init__(self, runtime):
        self.runtime = runtime

    def start(self, session, cancelled=None, voice_mode="fast"):
        return self.runtime._call("buddy", session, {"task": "warm", **({"voiceMode":voice_mode} if voice_mode!="fast" else {})}, cancelled=cancelled)

    def stop(self, session):
        return self.runtime._call("buddy", session, {"task": "close"})

    def require(self, session):
        return self.runtime.pulse(session)

    def chat(self, session, messages, cancelled=None):
        return self.runtime._call("buddy", session, {"task": "chat", "messages": messages}, cancelled=cancelled)

    def speech(self, session, payload, cancelled=None):
        return self.runtime._call("buddy", session, payload, cancelled=cancelled)

    def support_check(self, session, text, cancelled=None):
        return self.runtime._call("buddy", session, {"task": "support_check", "text": text}, cancelled=cancelled)

