import { createContext, useContext } from "react";

export type MotionLevel = "full" | "reduced" | "none";

export const MotionContext = createContext<MotionLevel>("full");

export function useMotionLevel(): MotionLevel {
  return useContext(MotionContext);
}

export function useMotionSafeValue<T>(full: T, reduced: T, none: T): T {
  const level = useMotionLevel();
  if (level === "none") return none;
  if (level === "reduced") return reduced;
  return full;
}
