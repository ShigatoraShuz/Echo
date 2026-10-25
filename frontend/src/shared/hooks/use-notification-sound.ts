"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAuthService } from "@/services/authentication/auth-service.factory";
import { settingsService } from "@/services/settings/settings.service";
import {
  clearNotificationSound,
  observeNotificationSound,
  soundActor,
} from "@/services/notifications/notification-sound";
export function useNotificationSound(userId?: string) {
  const [actor, setActor] = useState(userId ?? "");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    let mounted = true;
    if (userId) {
      soundActor(userId);
      setActor(userId);
    } else
      void Promise.resolve()
        .then(() => getAuthService().getCurrentSession())
        .then((result) => {
          if (mounted && active.current) {
            const id = result.success ? (result.data?.user.id ?? "") : "";
            soundActor(id);
            setActor(id);
          }
        })
        .catch(() => {});
    const clear = () => {
      active.current = false;
      setActor("");
      clearNotificationSound();
    };
    window.addEventListener("echo:sensitive-state-cleared", clear);
    window.addEventListener("echo:professional-access-lost", clear);
    return () => {
      mounted = false;
      active.current = false;
      window.removeEventListener("echo:sensitive-state-cleared", clear);
      window.removeEventListener("echo:professional-access-lost", clear);
    };
  }, [userId]);
  const observe = useCallback(
    (source: string, items: { id: string; createdAt: string; readAt: string | null }[]) => {
      if (active.current && actor)
        void observeNotificationSound(actor, source, items, async () => (await settingsService.get()).notifications);
    },
    [actor],
  );
  return { actor, observe };
}
