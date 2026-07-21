import { Bot, UserRound } from "lucide-react";
import type { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

export function ChatBubble({ message }: { message: ChatMessage }) {
  const isBuddy = message.role === "buddy";
  const Icon = isBuddy ? Bot : UserRound;

  return (
    <div className={cn("flex gap-3", !isBuddy && "justify-end")}>
      {isBuddy ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      ) : null}
      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-subtle",
          isBuddy
            ? "rounded-tl-md border border-border/70 bg-background text-foreground"
            : "rounded-tr-md bg-secondary text-secondary-foreground",
        )}
      >
        <p>{message.content}</p>
        <p className="mt-2 text-[11px] font-medium text-muted-foreground">{message.timestamp}</p>
      </div>
    </div>
  );
}
