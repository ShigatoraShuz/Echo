"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudOff } from "lucide-react";

export function SyncStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const Icon = isOnline ? Cloud : CloudOff;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      {isOnline ? "Synced locally" : "Offline mode"}
    </div>
  );
}
