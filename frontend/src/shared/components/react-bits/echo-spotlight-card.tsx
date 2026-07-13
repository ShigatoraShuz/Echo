"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface EchoSpotlightCardProps {
  children: React.ReactNode;
  className?: string;
}

export function EchoSpotlightCard({ children, className }: EchoSpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden motion-reduce:shadow-subtle", className)}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300 motion-reduce:opacity-0"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, hsl(var(--primary) / 0.06), transparent 60%)`,
        }}
      />
      {children}
    </div>
  );
}
