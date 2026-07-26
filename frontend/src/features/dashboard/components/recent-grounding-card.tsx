"use client";
import { Wind } from "lucide-react";

interface GroundingActivity {
  id: string;
  type: string;
  duration: number;
  completedAt: string;
}

interface RecentGroundingProps {
  activities: GroundingActivity[];
}

export function RecentGroundingCard({ activities }: RecentGroundingProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Wind className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Grounding activity</p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">No grounding exercises completed yet. Try one when you need to feel present.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Wind className="h-5 w-5 text-primary" />
        <p className="text-sm font-medium text-foreground">Recent grounding</p>
      </div>
      <div className="mt-4 space-y-2">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-center justify-between rounded-xl bg-secondary/20 p-3">
            <div>
              <p className="text-sm font-medium text-foreground capitalize">{activity.type.replace(/-/g, " ")}</p>
              <p className="text-xs text-muted-foreground">{Math.ceil(activity.duration / 60)} min</p>
            </div>
            <span className="text-xs text-muted-foreground">{activity.completedAt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
