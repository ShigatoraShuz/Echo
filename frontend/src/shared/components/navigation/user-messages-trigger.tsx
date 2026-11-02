"use client";

import { MessageCircle } from "lucide-react";
import { UserMessageDrawer } from "./user-message-drawer";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";



export function UserMessagesTrigger() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const clear = () => setOpen(false);
    window.addEventListener("echo:sensitive-state-cleared", clear);
    return () => window.removeEventListener("echo:sensitive-state-cleared", clear);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        aria-label="Professional messages"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary outline-none transition-[background-color,transform] duration-150 hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.94]"
      >
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && <UserMessageDrawer open onClose={() => setOpen(false)} />}
    </>
  );
}
