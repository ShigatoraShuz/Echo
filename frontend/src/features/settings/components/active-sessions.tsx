"use client";
import { Monitor, Smartphone, XCircle } from "lucide-react";

interface Session {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

interface ActiveSessionsProps {
  sessions: Session[];
  onRevoke: (sessionId: string) => void;
  isRevoking: boolean;
}

export function ActiveSessionsList({ sessions, onRevoke, isRevoking }: ActiveSessionsProps) {
  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <div key={session.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            {session.device === "mobile" ? <Smartphone className="h-5 w-5 text-muted-foreground" /> : <Monitor className="h-5 w-5 text-muted-foreground" />}
            <div>
              <p className="text-sm font-medium text-foreground">{session.browser} on {session.device} {session.isCurrent && "(current)"}</p>
              <p className="text-xs text-muted-foreground">{session.location} - {session.lastActive}</p>
            </div>
          </div>
          {!session.isCurrent && (
            <button type="button" onClick={() => onRevoke(session.id)} disabled={isRevoking} className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-danger/10 hover:text-danger disabled:opacity-50">
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
