import { useEffect } from "react";

interface KeyboardAction {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  handler: () => void;
}

export function useKeyboardNavigation(actions: KeyboardAction[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const action of actions) {
        const ctrlMatch = (action.ctrlKey ?? false) === e.ctrlKey;
        const metaMatch = (action.metaKey ?? false) === e.metaKey;
        const shiftMatch = (action.shiftKey ?? false) === e.shiftKey;
        if (e.key === action.key && ctrlMatch && metaMatch && shiftMatch) {
          e.preventDefault();
          action.handler();
          return;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actions, enabled]);
}
