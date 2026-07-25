"use client";

interface TimerProgressProps {
  elapsed: number;
  total: number;
  state: string;
}

export function TimerProgress({ elapsed, total, state }: TimerProgressProps) {
  const remaining = Math.max(0, total - elapsed);
  const remainingSec = Math.ceil(remaining / 1000);
  const progress = total > 0 ? (elapsed / total) * 100 : 0;

  function formatTime(ms: number): string {
    const sec = Math.ceil(ms / 1000);
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return ${min}:;
  }

  if (state === "idle") return null;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{formatTime(elapsed)}</span>
        <span className="font-medium text-foreground">{formatTime(remaining)} remaining</span>
      </div>
      <div className="h-2.5 rounded-full bg-secondary/50 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-200"
          style={{ width: ${progress}% }}
        />
      </div>
    </div>
  );
}
