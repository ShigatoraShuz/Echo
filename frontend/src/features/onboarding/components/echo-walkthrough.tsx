"use client";

import { useState } from "react";
import { Bell, BookOpen, LayoutDashboard, MessageCircle } from "lucide-react";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";

const steps = [
  { icon: LayoutDashboard, title: "Start at your Dashboard", description: "See your recent reflections and wellbeing activity. The daily distress check-in is optional and lets you describe how today feels." },
  { icon: BookOpen, title: "Write in Journal, revisit in Insights", description: "Save a private reflection. If journal analysis is enabled and available, open its report from Insights to revisit your results and suggested next steps." },
  { icon: MessageCircle, title: "Make space to talk", description: "Open Buddy to chat when access is available. Grounding and Find Help are also in the navigation whenever you want another kind of support." },
  { icon: Bell, title: "Find your updates in the bell", description: "The bell shows in-app updates, like when a report is ready. You can change notification and privacy preferences in Settings." },
];

export function EchoWalkthrough({ onFinish }: { onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const { icon: Icon, title, description } = steps[index];
  const last = index === steps.length - 1;

  return (
    <EchoDialog open onClose={onFinish} title="Welcome to ECHO" description="A quick look around your private space.">
      <div className="space-y-5">
        <div aria-live="polite" aria-atomic="true" className="rounded-2xl border border-primary/15 bg-gradient-to-br from-secondary/70 to-background p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon size={22} aria-hidden="true" /></span>
            <span className="text-xs font-semibold text-muted-foreground">Step {index + 1} of {steps.length}</span>
          </div>
          <h3 className="mt-4 text-xl font-semibold text-foreground">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="echo-button-secondary" onClick={onFinish}>Skip tour</button>
          <div className="flex gap-2">
            {index > 0 && <button type="button" className="echo-button-secondary" onClick={() => setIndex(index - 1)}>Back</button>}
            <button type="button" className="echo-button-primary" onClick={last ? onFinish : () => setIndex(index + 1)}>
              {last ? "Go to Dashboard" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </EchoDialog>
  );
}
