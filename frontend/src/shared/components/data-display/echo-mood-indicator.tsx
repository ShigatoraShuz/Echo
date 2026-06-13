import { cn } from "@/lib/utils";
import { Frown, Meh, Smile, Heart, Angry, EyeOff } from "lucide-react";

type MoodLevel = "awful" | "bad" | "okay" | "good" | "great" | "unknown";

interface EchoMoodIndicatorProps {
  mood: MoodLevel;
  size?: "small" | "medium" | "large";
  showLabel?: boolean;
  className?: string;
}

const moodConfig: Record<MoodLevel, { icon: React.ReactNode; label: string; color: string }> = {
  awful: { icon: <Angry className="h-full w-full" aria-hidden="true" />, label: "Awful", color: "text-danger" },
  bad: { icon: <Frown className="h-full w-full" aria-hidden="true" />, label: "Bad", color: "text-emotion-sad" },
  okay: { icon: <Meh className="h-full w-full" aria-hidden="true" />, label: "Okay", color: "text-emotion-neutral" },
  good: { icon: <Smile className="h-full w-full" aria-hidden="true" />, label: "Good", color: "text-emotion-happy" },
  great: { icon: <Heart className="h-full w-full" aria-hidden="true" />, label: "Great", color: "text-emotion-loved" },
  unknown: { icon: <EyeOff className="h-full w-full" aria-hidden="true" />, label: "Unknown", color: "text-muted-foreground" },
};

const sizeClasses = {
  small: "h-5 w-5",
  medium: "h-7 w-7",
  large: "h-10 w-10",
};

export function EchoMoodIndicator({ mood, size = "medium", showLabel = false, className }: EchoMoodIndicatorProps) {
  const config = moodConfig[mood] || moodConfig.unknown;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} aria-label={`Mood: ${config.label}`}>
      <span className={cn(config.color, sizeClasses[size])}>
        {config.icon}
      </span>
      {showLabel && (
        <span className={cn("text-sm font-medium", config.color)}>{config.label}</span>
      )}
    </span>
  );
}
