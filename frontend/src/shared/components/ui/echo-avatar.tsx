import Image from "next/image";
import { cn } from "@/lib/utils";
import { UserRound } from "lucide-react";

type AvatarSize = "small" | "medium" | "large";

interface EchoAvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, { container: string; icon: string; text: string }> = {
  small: { container: "h-8 w-8", icon: "h-4 w-4", text: "text-xs" },
  medium: { container: "h-10 w-10", icon: "h-5 w-5", text: "text-sm" },
  large: { container: "h-14 w-14", icon: "h-7 w-7", text: "text-lg" },
};

export function EchoAvatar({ src, alt, initials, size = "medium", className }: EchoAvatarProps) {
  const styles = sizeClasses[size];

  if (src) {
    return (
      <Image
        src={src}
        alt={alt || ""}
    width={size === "large" ? 56 : size === "medium" ? 40 : 32}
    height={size === "large" ? 56 : size === "medium" ? 40 : 32}
    className={cn("rounded-full object-cover bg-secondary", styles.container, className)}
      />
    );
  }

  if (initials) {
    return (
      <span className={cn(
        "inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold",
        styles.container, styles.text, className
      )}>
        {initials}
      </span>
    );
  }

  return (
    <span className={cn(
      "inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground",
      styles.container, className
    )}>
      <UserRound className={styles.icon} aria-hidden="true" />
    </span>
  );
}
